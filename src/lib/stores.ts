import { writable, derived, get } from "svelte/store";
import type {
  ToolType,
  Shape,
  Style,
  Operation,
  UserCursor,
  Project,
} from "./types";
import { DEFAULT_STYLE } from "./types";
import { generateId, deepClone } from "./utils";

function createStore() {
  const userId = writable<string>(generateId());
  const userName = writable<string>("用户 " + Math.floor(Math.random() * 1000));
  const tool = writable<ToolType>("select");
  const currentStyle = writable<Style>({ ...DEFAULT_STYLE });
  const shapes = writable<Shape[]>([]);
  const selectedIds = writable<string[]>([]);
  const zoom = writable<number>(1);
  const panX = writable<number>(0);
  const panY = writable<number>(0);
  const undoStack = writable<Operation[]>([]);
  const redoStack = writable<Operation[]>([]);
  const gridEnabled = writable<boolean>(true);
  const gridSize = writable<number>(20);
  const snapToGrid = writable<boolean>(true);
  const cursors = writable<Record<string, UserCursor>>({});
  const clipboard = writable<Shape[]>([]);

  const MAX_HISTORY = 100;
  let debouncedUpdateOp: Operation | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const DEBOUNCE_DELAY = 200;

  const selectedShapes = derived(
    [shapes, selectedIds],
    ([$shapes, $selectedIds]) => {
      return $shapes.filter((s) => $selectedIds.includes(s.id));
    },
  );

  function addShape(shape: Shape, broadcast: boolean = true) {
    const op: Operation = {
      id: generateId(),
      type: "add",
      shapes: [deepClone(shape)],
      userId: get(userId),
      timestamp: Date.now(),
    };
    shapes.update((s) => [...s, shape]);
    if (broadcast) {
      pushUndo(op);
      broadcastOperation(op);
    }
  }

  function addShapes(newShapes: Shape[], broadcast: boolean = true) {
    if (newShapes.length === 0) return;
    const op: Operation = {
      id: generateId(),
      type: "add",
      shapes: newShapes.map((s) => deepClone(s)),
      userId: get(userId),
      timestamp: Date.now(),
    };
    shapes.update((s) => [...s, ...newShapes]);
    if (broadcast) {
      pushUndo(op);
      broadcastOperation(op);
    }
  }

  function removeShape(id: string, broadcast: boolean = true) {
    const shape = get(shapes).find((s) => s.id === id);
    if (!shape) return;
    const op: Operation = {
      id: generateId(),
      type: "remove",
      shapes: [deepClone(shape)],
      userId: get(userId),
      timestamp: Date.now(),
    };
    shapes.update((s) => s.filter((item) => item.id !== id));
    selectedIds.update((ids) => ids.filter((i) => i !== id));
    if (broadcast) {
      pushUndo(op);
      broadcastOperation(op);
    }
  }

  function removeShapes(ids: string[], broadcast: boolean = true) {
    if (ids.length === 0) return;
    const removedShapes = get(shapes).filter((s) => ids.includes(s.id));
    if (removedShapes.length === 0) return;
    const op: Operation = {
      id: generateId(),
      type: "remove",
      shapes: removedShapes.map((s) => deepClone(s)),
      userId: get(userId),
      timestamp: Date.now(),
    };
    shapes.update((s) => s.filter((item) => !ids.includes(item.id)));
    selectedIds.update((i) => i.filter((id) => !ids.includes(id)));
    if (broadcast) {
      pushUndo(op);
      broadcastOperation(op);
    }
  }

  function updateShape(
    id: string,
    updates: Partial<Shape>,
    broadcast: boolean = true,
  ) {
    const current = get(shapes).find((s) => s.id === id);
    if (!current) return;
    const prev = deepClone(current);
    const op: Operation = {
      id: generateId(),
      type: "update",
      shapes: [{ ...prev, ...updates }],
      previousShapes: [prev],
      userId: get(userId),
      timestamp: Date.now(),
    };
    shapes.update((s) =>
      s.map((item) =>
        item.id === id
          ? {
              ...item,
              ...updates,
              updatedAt: Date.now(),
              timestamp: Date.now(),
            }
          : item,
      ),
    );
    if (broadcast) {
      pushUndo(op);
      broadcastOperation(op);
    }
  }

  function updateShapes(
    updates: Array<{ id: string; updates: Partial<Shape> }>,
    broadcast: boolean = true,
  ) {
    if (updates.length === 0) return;
    const $shapes = get(shapes);
    const prevShapes: Shape[] = [];
    const newShapes: Shape[] = [];
    for (const { id, updates: u } of updates) {
      const current = $shapes.find((s) => s.id === id);
      if (current) {
        prevShapes.push(deepClone(current));
        newShapes.push({
          ...current,
          ...u,
          updatedAt: Date.now(),
          timestamp: Date.now(),
        });
      }
    }
    if (prevShapes.length === 0) return;
    const op: Operation = {
      id: generateId(),
      type: "update",
      shapes: newShapes,
      previousShapes: prevShapes,
      userId: get(userId),
      timestamp: Date.now(),
    };
    const idMap = new Map(updates.map((u) => [u.id, u.updates]));
    shapes.update((s) =>
      s.map((item) => {
        const u = idMap.get(item.id);
        if (u) {
          return {
            ...item,
            ...u,
            updatedAt: Date.now(),
            timestamp: Date.now(),
          };
        }
        return item;
      }),
    );
    if (broadcast) {
      pushUndo(op);
      broadcastOperation(op);
    }
  }

  function flushDebouncedUpdate() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (debouncedUpdateOp) {
      undoStack.update((stack) => {
        const newStack = [...stack, debouncedUpdateOp as Operation];
        if (newStack.length > MAX_HISTORY) {
          newStack.shift();
        }
        return newStack;
      });
      debouncedUpdateOp = null;
    }
  }

  function pushUndo(op: Operation) {
    if (op.userId !== get(userId)) return;

    if (op.type === "update") {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (debouncedUpdateOp) {
        debouncedUpdateOp.shapes = op.shapes;
        debouncedUpdateOp.timestamp = op.timestamp;
      } else {
        debouncedUpdateOp = op;
      }
      debounceTimer = setTimeout(() => {
        flushDebouncedUpdate();
        redoStack.set([]);
      }, DEBOUNCE_DELAY);
    } else {
      flushDebouncedUpdate();
      undoStack.update((stack) => {
        const newStack = [...stack, op];
        if (newStack.length > MAX_HISTORY) {
          newStack.shift();
        }
        return newStack;
      });
      redoStack.set([]);
    }
  }

  function undo() {
    flushDebouncedUpdate();
    const $undoStack = get(undoStack);
    if ($undoStack.length === 0) return;
    const op = $undoStack[$undoStack.length - 1];
    if (op.userId !== get(userId)) {
      undoStack.update((s) => s.slice(0, -1));
      return;
    }
    executeReverse(op);
    undoStack.update((s) => s.slice(0, -1));
    redoStack.update((s) => [...s, op]);
  }

  function redo() {
    flushDebouncedUpdate();
    const $redoStack = get(redoStack);
    if ($redoStack.length === 0) return;
    const op = $redoStack[$redoStack.length - 1];
    if (op.userId !== get(userId)) {
      redoStack.update((s) => s.slice(0, -1));
      return;
    }
    execute(op);
    redoStack.update((s) => s.slice(0, -1));
    undoStack.update((s) => [...s, op]);
  }

  function execute(op: Operation) {
    switch (op.type) {
      case "add":
        addShapes(op.shapes, false);
        break;
      case "remove":
        removeShapes(
          op.shapes.map((s) => s.id),
          false,
        );
        break;
      case "update":
        for (const shape of op.shapes) {
          updateShape(shape.id, shape, false);
        }
        break;
      case "group":
        executeGroup(op, false);
        break;
      case "ungroup":
        executeUngroup(op, false);
        break;
    }
  }

  function executeReverse(op: Operation) {
    switch (op.type) {
      case "add":
        removeShapes(
          op.shapes.map((s) => s.id),
          false,
        );
        break;
      case "remove":
        addShapes(op.shapes, false);
        break;
      case "update":
        if (op.previousShapes) {
          for (const prev of op.previousShapes) {
            updateShape(prev.id, prev, false);
          }
        }
        break;
      case "group":
        executeUngroup(op, false);
        break;
      case "ungroup":
        executeGroup(op, false);
        break;
    }
  }

  function group(selectedIdsArray: string[]): string | null {
    if (selectedIdsArray.length < 2) return null;
    const $shapes = get(shapes);
    const children = $shapes.filter((s) => selectedIdsArray.includes(s.id));
    if (children.length < 2) return null;
    const minX = Math.min(...children.map((s) => s.x));
    const minY = Math.min(...children.map((s) => s.y));
    const maxX = Math.max(...children.map((s) => s.x + s.width));
    const maxY = Math.max(...children.map((s) => s.y + s.height));
    const groupId = generateId();
    const group: Shape = {
      id: groupId,
      type: "group",
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: 0,
      style: { ...DEFAULT_STYLE },
      zIndex: Math.max(...children.map((s) => s.zIndex)) + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userId: get(userId),
      timestamp: Date.now(),
      childrenIds: selectedIdsArray,
    };
    const op: Operation = {
      id: generateId(),
      type: "group",
      shapes: [group],
      previousShapes: children.map((c) => deepClone(c)),
      userId: get(userId),
      timestamp: Date.now(),
    };
    executeGroup(op, true);
    pushUndo(op);
    broadcastOperation(op);
    return groupId;
  }

  function executeGroup(op: Operation, broadcast: boolean) {
    const group = op.shapes[0];
    if (group.type !== "group") return;
    const childrenIds = group.childrenIds || [];
    const $shapes = get(shapes);
    const remaining = $shapes.filter((s) => !childrenIds.includes(s.id));
    shapes.set([...remaining, group]);
    selectedIds.set([group.id]);
  }

  function ungroup(groupId: string) {
    const $shapes = get(shapes);
    const group = $shapes.find((s) => s.id === groupId);
    if (!group || group.type !== "group") return;
    const childrenIds = group.childrenIds || [];
    const childrenCopy = $shapes.filter((s) => childrenIds.includes(s.id));
    const op: Operation = {
      id: generateId(),
      type: "ungroup",
      shapes: childrenCopy.map((c) => deepClone(c)),
      previousShapes: [deepClone(group)],
      userId: get(userId),
      timestamp: Date.now(),
    };
    executeUngroup(op, true);
    pushUndo(op);
    broadcastOperation(op);
  }

  function executeUngroup(op: Operation, broadcast: boolean) {
    const group = op.previousShapes?.[0];
    if (!group || group.type !== "group") return;
    const $shapes = get(shapes);
    const remaining = $shapes.filter((s) => s.id !== group.id);
    shapes.set([...remaining, ...op.shapes]);
    selectedIds.set(op.shapes.map((s) => s.id));
  }

  function broadcastOperation(op: Operation) {
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const channel = new BroadcastChannel("whiteboard-sync");
        channel.postMessage({ type: "operation", data: op });
        channel.close();
      } catch (e) {
        console.error("Broadcast error:", e);
      }
    }
  }

  function broadcastCursor(cursor: UserCursor) {
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const channel = new BroadcastChannel("whiteboard-sync");
        channel.postMessage({ type: "cursor", data: cursor });
        channel.close();
      } catch (e) {
        console.error("Broadcast cursor error:", e);
      }
    }
  }

  function receiveOperation(op: Operation) {
    if (op.userId === get(userId)) return;
    const $shapes = get(shapes);
    const existingIds = new Set($shapes.map((s) => s.id));
    const existing = $shapes.find((s) => s.id === (op.shapes[0]?.id || ""));
    if (existing && op.type === "update") {
      if (op.timestamp > existing.timestamp) {
        execute(op);
      }
    } else if (!existingIds.has(op.shapes[0]?.id || "")) {
      execute(op);
    } else if (op.type === "add") {
      const existingShape = $shapes.find((s) => s.id === op.shapes[0]?.id);
      if (existingShape && op.timestamp > existingShape.timestamp) {
        shapes.update((s) =>
          s.map((item) =>
            item.id === op.shapes[0].id
              ? { ...op.shapes[0], updatedAt: Date.now() }
              : item,
          ),
        );
      }
    }
  }

  function setZIndex(
    ids: string[],
    direction: "front" | "back" | "up" | "down",
  ) {
    const $shapes = get(shapes);
    const sorted = [...$shapes].sort((a, b) => a.zIndex - b.zIndex);
    const maxZ = sorted.length > 0 ? sorted[sorted.length - 1].zIndex + 1 : 1;
    const updates: Array<{ id: string; updates: Partial<Shape> }> = [];
    if (direction === "front") {
      for (const id of ids) {
        updates.push({ id, updates: { zIndex: maxZ + ids.indexOf(id) } });
      }
    } else if (direction === "back") {
      for (let i = ids.length - 1; i >= 0; i--) {
        updates.push({ id: ids[i], updates: { zIndex: i } });
      }
    } else {
      const idSet = new Set(ids);
      const others = sorted.filter((s) => !idSet.has(s.id));
      const selected = sorted.filter((s) => idSet.has(s.id));
      if (direction === "up") {
        for (let i = 0; i < selected.length; i++) {
          const idx = sorted.indexOf(selected[i]);
          if (idx < sorted.length - 1 && !idSet.has(sorted[idx + 1].id)) {
            [sorted[idx], sorted[idx + 1]] = [sorted[idx + 1], sorted[idx]];
          }
        }
      } else {
        for (let i = selected.length - 1; i >= 0; i--) {
          const idx = sorted.indexOf(selected[i]);
          if (idx > 0 && !idSet.has(sorted[idx - 1].id)) {
            [sorted[idx], sorted[idx - 1]] = [sorted[idx - 1], sorted[idx]];
          }
        }
      }
      for (let i = 0; i < sorted.length; i++) {
        updates.push({ id: sorted[i].id, updates: { zIndex: i } });
      }
    }
    updateShapes(updates);
  }

  function copy() {
    const selected = get(selectedShapes);
    clipboard.set(selected.map((s) => deepClone(s)));
  }

  function paste() {
    const $clipboard = get(clipboard);
    if ($clipboard.length === 0) return;
    const offset = 20;
    const copies = $clipboard.map((s) => ({
      ...deepClone(s),
      id: generateId(),
      x: s.x + offset,
      y: s.y + offset,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userId: get(userId),
      timestamp: Date.now(),
    }));
    addShapes(copies);
    selectedIds.set(copies.map((c) => c.id));
  }

  function deleteSelected() {
    const $selected = get(selectedIds);
    removeShapes($selected);
  }

  function clearAll() {
    const $shapes = get(shapes);
    if ($shapes.length === 0) return;
    const op: Operation = {
      id: generateId(),
      type: "remove",
      shapes: $shapes.map((s) => deepClone(s)),
      userId: get(userId),
      timestamp: Date.now(),
    };
    shapes.set([]);
    selectedIds.set([]);
    pushUndo(op);
    broadcastOperation(op);
  }

  function exportProject(): Project {
    return {
      id: generateId(),
      name: "白板工程",
      shapes: get(shapes),
      viewport: {
        zoom: get(zoom),
        panX: get(panX),
        panY: get(panY),
      },
    };
  }

  function importProject(project: Project) {
    clearAll();
    shapes.set(project.shapes);
    zoom.set(project.viewport.zoom);
    panX.set(project.viewport.panX);
    panY.set(project.viewport.panY);
  }

  function loadShapes(newShapes: Shape[]) {
    clearAll();
    shapes.set(newShapes);
  }

  return {
    userId,
    userName,
    tool,
    currentStyle,
    shapes,
    selectedIds,
    selectedShapes,
    zoom,
    panX,
    panY,
    undoStack,
    redoStack,
    gridEnabled,
    gridSize,
    snapToGrid,
    cursors,
    clipboard,
    addShape,
    addShapes,
    removeShape,
    removeShapes,
    updateShape,
    updateShapes,
    undo,
    redo,
    group,
    ungroup,
    receiveOperation,
    broadcastCursor,
    setZIndex,
    copy,
    paste,
    deleteSelected,
    clearAll,
    exportProject,
    importProject,
    loadShapes,
    MAX_HISTORY,
  };
}

export const store = createStore();
