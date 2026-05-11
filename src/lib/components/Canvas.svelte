<script lang="ts">
  import { onMount, onDestroy, tick, afterUpdate } from 'svelte';
  import { store } from '../stores';
  import type { Shape, Point, StickyColor, ToolType } from '../types';
  import { STICKY_COLORS, DEFAULT_STYLE } from '../types';
  import { snapToGrid, clamp, getCenter, pointInRotatedBounds, pointInBounds, pointOnLine, deepClone, generateId } from '../utils';
import { get } from 'svelte/store';
  import SelectionHandles from './SelectionHandles.svelte';

  let canvas: HTMLCanvasElement;
  let container: HTMLDivElement;

  let $userId: string;
  let $userName: string;
  let $tool: ToolType;
  let $currentStyle: typeof DEFAULT_STYLE;
  let $shapes: Shape[];
  let $selectedIds: string[];
  let $zoom: number;
  let $panX: number;
  let $panY: number;
  let $gridEnabled: boolean;
  let $gridSize: number;
  let $snapToGrid: boolean;
  let $cursors: Record<string, { userId: string; name: string; x: number; y: number; color: string; timestamp: number }>;

  store.userId.subscribe(v => $userId = v);
  store.userName.subscribe(v => $userName = v);
  store.tool.subscribe(v => $tool = v);
  store.currentStyle.subscribe(v => $currentStyle = v);
  store.shapes.subscribe(v => $shapes = v);
  store.selectedIds.subscribe(v => $selectedIds = v);
  store.zoom.subscribe(v => $zoom = v);
  store.panX.subscribe(v => $panX = v);
  store.panY.subscribe(v => $panY = v);
  store.gridEnabled.subscribe(v => $gridEnabled = v);
  store.gridSize.subscribe(v => $gridSize = v);
  store.snapToGrid.subscribe(v => $snapToGrid = v);
  store.cursors.subscribe(v => $cursors = v);

  let width = 0;
  let height = 0;
  let isDragging = false;
  let isPanning = false;
  let spacePressed = false;
  let startPoint: Point | null = null;
  let currentPoint: Point | null = null;
  let previewShape: Shape | null = null;
  let penPoints: Point[] = [];
  let panStartX = 0;
  let panStartY = 0;
  let panStartPanX = 0;
  let panStartPanY = 0;
  let broadcastChannel: BroadcastChannel | null = null;
  let selectionStart: Point | null = null;
  let selectionBox: { x: number; y: number; width: number; height: number } | null = null;
  let dragStart: Point | null = null;
  let dragShapesStart: Array<{ id: string; x: number; y: number }> = [];
  let isEditingText = false;
  let editingShapeId: string | null = null;

  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 8;

  function getCanvasPoint(clientX: number, clientY: number): Point {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - $panX) / $zoom;
    const y = (clientY - rect.top - $panY) / $zoom;
    return {
      x: $snapToGrid ? snapToGrid(x, $gridSize) : x,
      y: $snapToGrid ? snapToGrid(y, $gridSize) : y
    };
  }

  function screenToCanvas(screenX: number, screenY: number): Point {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (screenX - rect.left - $panX) / $zoom,
      y: (screenY - rect.top - $panY) / $zoom
    };
  }

  function handleResize() {
    if (!container) return;
    width = container.clientWidth;
    height = container.clientHeight;
    if (canvas) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function handleMouseDown(e: MouseEvent) {
    if (isEditingText) return;
    if (e.button === 1 || (e.button === 0 && spacePressed)) {
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    const point = getCanvasPoint(e.clientX, e.clientY);
    startPoint = point;
    currentPoint = point;

    if ($tool === 'select') {
      handleSelectMouseDown(e, point);
    } else if ($tool === 'rectangle') {
      previewShape = createPreviewRectangle(point);
    } else if ($tool === 'ellipse') {
      previewShape = createPreviewEllipse(point);
    } else if ($tool === 'line') {
      previewShape = createPreviewLine(point);
    } else if ($tool === 'arrow') {
      previewShape = createPreviewArrow(point);
    } else if ($tool === 'pen') {
      penPoints = [point];
    } else if ($tool === 'text') {
      handleTextClick(point);
    } else if ($tool === 'sticky') {
      handleStickyClick(point);
    } else if ($tool === 'eraser') {
      handleEraserClick(point);
    }
    isDragging = true;
  }

  function handleSelectMouseDown(e: MouseEvent, point: Point) {
    const clickedShape = findShapeAtPoint(point);
    const isShift = e.shiftKey;

    if (clickedShape) {
      if (!$selectedIds.includes(clickedShape.id)) {
        if (isShift) {
          store.selectedIds.update(ids => [...ids, clickedShape.id]);
        } else {
          store.selectedIds.set([clickedShape.id]);
        }
      } else if (isShift) {
        store.selectedIds.update(ids => ids.filter(id => id !== clickedShape.id));
      }
      const currentSelected = $shapes.filter(s => $selectedIds.includes(s.id));
      if (currentSelected.length > 0 || clickedShape) {
        startDrag(point);
      }
    } else {
      if (!isShift) {
        store.selectedIds.set([]);
      }
      selectionStart = point;
      selectionBox = { x: point.x, y: point.y, width: 0, height: 0 };
    }
  }

  function startDrag(point: Point) {
    dragStart = point;
    const $selected = $shapes.filter(s => $selectedIds.includes(s.id));
    dragShapesStart = $selected.map(s => ({ id: s.id, x: s.x, y: s.y }));
  }

  function handleMouseMove(e: MouseEvent) {
    broadcastCursorPosition(e);
    if (isPanning) {
      const dx = e.clientX - panStartX;
      const dy = e.clientY - panStartY;
      store.panX.set(panStartPanX + dx);
      store.panY.set(panStartPanY + dy);
      return;
    }
    if (!isDragging || !startPoint) return;
    const point = getCanvasPoint(e.clientX, e.clientY);
    currentPoint = point;

    if ($tool === 'select') {
      handleSelectMouseMove(point);
    } else if (previewShape) {
      updatePreviewShape(point);
    } else if ($tool === 'pen') {
      penPoints.push(point);
    } else if ($tool === 'eraser') {
      handleEraserMove(point);
    }
  }

  function handleSelectMouseMove(point: Point) {
    if (selectionStart && selectionBox) {
      const minX = Math.min(selectionStart.x, point.x);
      const minY = Math.min(selectionStart.y, point.y);
      const maxX = Math.max(selectionStart.x, point.x);
      const maxY = Math.max(selectionStart.y, point.y);
      selectionBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    } else if (dragStart && $selectedIds.length > 0) {
      const dx = point.x - dragStart.x;
      const dy = point.y - dragStart.y;
      const updates = dragShapesStart.map(s => ({
        id: s.id,
        updates: { x: s.x + dx, y: s.y + dy }
      }));
      store.updateShapes(updates, false);
    }
  }

  function handleMouseUp(e: MouseEvent) {
    if (isPanning) {
      isPanning = false;
      return;
    }
    if (!isDragging) return;
    isDragging = false;

    if ($tool === 'select') {
      handleSelectMouseUp(e);
    } else if (previewShape) {
      if (isValidShape(previewShape)) {
        store.addShape(previewShape);
      }
      previewShape = null;
    } else if ($tool === 'pen' && penPoints.length > 1) {
      const penShape = createPenShape();
      if (isValidShape(penShape)) {
        store.addShape(penShape);
      }
      penPoints = [];
    }
    startPoint = null;
    currentPoint = null;
    selectionStart = null;
    selectionBox = null;
    dragStart = null;
    dragShapesStart = [];
  }

  function handleSelectMouseUp(e: MouseEvent) {
    if (selectionBox && selectionBox.width > 5 && selectionBox.height > 5) {
      const contained = $shapes.filter(s => {
        const center = getCenter(s);
        return pointInBounds(center, selectionBox!);
      });
      const newIds = contained.map(s => s.id);
      if (e.shiftKey) {
        store.selectedIds.update(ids => {
          const set = new Set([...ids, ...newIds]);
          return Array.from(set);
        });
      } else {
        store.selectedIds.set(newIds);
      }
    } else if (dragStart && currentPoint) {
      const dx = currentPoint.x - dragStart.x;
      const dy = currentPoint.y - dragStart.y;
      if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
        const updates = dragShapesStart.map(s => ({
          id: s.id,
          updates: { x: s.x + dx, y: s.y + dy }
        }));
        store.updateShapes(updates, true);
      }
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.metaKey || e.ctrlKey) {
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = clamp($zoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);
      const mouseX = e.clientX - canvas.getBoundingClientRect().left;
      const mouseY = e.clientY - canvas.getBoundingClientRect().top;
      const zoomRatio = newZoom / $zoom;
      store.panX.set(mouseX - (mouseX - $panX) * zoomRatio);
      store.panY.set(mouseY - (mouseY - $panY) * zoomRatio);
      store.zoom.set(newZoom);
    } else {
      store.panX.update(v => v - e.deltaX);
      store.panY.update(v => v - e.deltaY);
    }
  }

  function startPan(e: MouseEvent) {
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    panStartPanX = get(store.panX);
    panStartPanY = get(store.panY);
  }

  function broadcastCursorPosition(e: MouseEvent) {
    const canvasPoint = screenToCanvas(e.clientX, e.clientY);
    const cursor = {
      userId: $userId,
      name: $userName,
      x: canvasPoint.x,
      y: canvasPoint.y,
      color: getRandomColor($userId),
      timestamp: Date.now()
    };
    store.broadcastCursor(cursor);
  }

  function getRandomColor(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
      '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
    ];
    return colors[Math.abs(hash) % colors.length];
  }

  function findShapeAtPoint(point: Point): Shape | null {
    const sorted = [...$shapes].sort((a, b) => b.zIndex - a.zIndex);
    for (const shape of sorted) {
      if (shape.type === 'group') continue;
      if (isPointInShape(point, shape)) {
        return shape;
      }
    }
    return null;
  }

  function isPointInShape(point: Point, shape: Shape): boolean {
    const threshold = 5 / $zoom;
    if (shape.rotation !== 0) {
      return pointInRotatedBounds(point, shape);
    }
    if (shape.type === 'line' || shape.type === 'arrow') {
      const points = (shape as any).points || [{ x: shape.x, y: shape.y }, { x: shape.x + shape.width, y: shape.y + shape.height }];
      for (let i = 0; i < points.length - 1; i++) {
        if (pointOnLine(point, points[i], points[i + 1], threshold)) {
          return true;
        }
      }
      return false;
    }
    if (shape.type === 'pen') {
      const points = (shape as any).points || [];
      for (let i = 0; i < points.length - 1; i++) {
        if (pointOnLine(point, points[i], points[i + 1], threshold)) {
          return true;
        }
      }
      return false;
    }
    return pointInBounds(point, { x: shape.x, y: shape.y, width: shape.width, height: shape.height }, threshold);
  }

  function createPreviewRectangle(point: Point): Shape {
    return {
      id: generateId(), type: 'rectangle',
      x: point.x, y: point.y, width: 0, height: 0, rotation: 0,
      style: { ...$currentStyle }, zIndex: $shapes.length,
      createdAt: Date.now(), updatedAt: Date.now(),
      userId: $userId, timestamp: Date.now()
    };
  }

  function createPreviewEllipse(point: Point): Shape {
    return {
      id: generateId(), type: 'ellipse',
      x: point.x, y: point.y, width: 0, height: 0, rotation: 0,
      style: { ...$currentStyle }, zIndex: $shapes.length,
      createdAt: Date.now(), updatedAt: Date.now(),
      userId: $userId, timestamp: Date.now()
    };
  }

  function createPreviewLine(point: Point): Shape {
    return {
      id: generateId(), type: 'line',
      x: point.x, y: point.y, width: 0, height: 0, rotation: 0,
      style: { ...$currentStyle }, zIndex: $shapes.length,
      createdAt: Date.now(), updatedAt: Date.now(),
      userId: $userId, timestamp: Date.now(),
      points: [point, point]
    } as Shape;
  }

  function createPreviewArrow(point: Point): Shape {
    return {
      id: generateId(), type: 'arrow',
      x: point.x, y: point.y, width: 0, height: 0, rotation: 0,
      style: { ...$currentStyle }, zIndex: $shapes.length,
      createdAt: Date.now(), updatedAt: Date.now(),
      userId: $userId, timestamp: Date.now(),
      points: [point, point]
    } as Shape;
  }

  function createPenShape(): Shape {
    const minX = Math.min(...penPoints.map(p => p.x));
    const minY = Math.min(...penPoints.map(p => p.y));
    const maxX = Math.max(...penPoints.map(p => p.x));
    const maxY = Math.max(...penPoints.map(p => p.y));
    return {
      id: generateId(), type: 'pen',
      x: minX, y: minY,
      width: Math.max(maxX - minX, 1),
      height: Math.max(maxY - minY, 1),
      rotation: 0,
      style: { ...$currentStyle }, zIndex: $shapes.length,
      createdAt: Date.now(), updatedAt: Date.now(),
      userId: $userId, timestamp: Date.now(),
      points: penPoints.map(p => ({ x: p.x, y: p.y })),
      pressure: new Array(penPoints.length).fill(0.5)
    } as Shape;
  }

  function updatePreviewShape(point: Point) {
    if (!previewShape || !startPoint) return;
    const dx = point.x - startPoint.x;
    const dy = point.y - startPoint.y;
    if (previewShape.type === 'line' || previewShape.type === 'arrow') {
      const minX = Math.min(startPoint.x, point.x);
      const minY = Math.min(startPoint.y, point.y);
      previewShape.x = minX;
      previewShape.y = minY;
      previewShape.width = Math.abs(dx) || 1;
      previewShape.height = Math.abs(dy) || 1;
      (previewShape as any).points = [startPoint, point];
    } else {
      previewShape.x = dx > 0 ? startPoint.x : point.x;
      previewShape.y = dy > 0 ? startPoint.y : point.y;
      previewShape.width = Math.abs(dx) || 1;
      previewShape.height = Math.abs(dy) || 1;
    }
  }

  function isValidShape(shape: Shape): boolean {
    return shape.width > 1 || shape.height > 1;
  }

  function handleTextClick(point: Point) {
    const textShape: Shape = {
      id: generateId(), type: 'text',
      x: point.x, y: point.y, width: 200, height: 30, rotation: 0,
      style: { ...$currentStyle }, zIndex: $shapes.length,
      createdAt: Date.now(), updatedAt: Date.now(),
      userId: $userId, timestamp: Date.now(),
      text: '', isEditing: true
    } as Shape;
    store.addShape(textShape);
    editingShapeId = textShape.id;
    isEditingText = true;
    tick().then(() => {
      const input = document.querySelector(`[data-text-id="${textShape.id}"]`) as HTMLInputElement;
      if (input) input.focus();
    });
  }

  function handleStickyClick(point: Point) {
    const colors: StickyColor[] = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const stickyShape: Shape = {
      id: generateId(), type: 'sticky',
      x: point.x, y: point.y, width: 200, height: 150, rotation: 0,
      style: { ...$currentStyle, backgroundColor: STICKY_COLORS[color] },
      zIndex: $shapes.length,
      createdAt: Date.now(), updatedAt: Date.now(),
      userId: $userId, timestamp: Date.now(),
      text: '', color, isEditing: true
    } as Shape;
    store.addShape(stickyShape);
    editingShapeId = stickyShape.id;
    isEditingText = true;
    tick().then(() => {
      const textarea = document.querySelector(`[data-sticky-id="${stickyShape.id}"]`) as HTMLTextAreaElement;
      if (textarea) textarea.focus();
    });
  }

  function handleEraserClick(point: Point) {
    const shape = findShapeAtPoint(point);
    if (shape) store.removeShape(shape.id);
  }

  function handleEraserMove(point: Point) {
    const shape = findShapeAtPoint(point);
    if (shape) store.removeShape(shape.id);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.code === 'Space' && !isEditingText) {
      e.preventDefault();
      spacePressed = true;
    }
    if (e.key === 'Escape') {
      store.selectedIds.set([]);
      if (isEditingText) finishEditing();
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditingText && $selectedIds.length > 0) {
      e.preventDefault();
      store.deleteSelected();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'c') store.copy();
    if ((e.metaKey || e.ctrlKey) && e.key === 'v') store.paste();
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      store.selectedIds.set($shapes.map(s => s.id));
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'g' && $selectedIds.length >= 2) {
      e.preventDefault();
      store.group($selectedIds);
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') spacePressed = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    if ($tool !== 'image') return;
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const point = screenToCanvas(e.clientX, e.clientY);
        const maxSize = 400;
        let w = img.width;
        let h = img.height;
        if (w > maxSize || h > maxSize) {
          const ratio = Math.min(maxSize / w, maxSize / h);
          w *= ratio;
          h *= ratio;
        }
        const imageShape: Shape = {
          id: generateId(), type: 'image',
          x: point.x - w / 2, y: point.y - h / 2,
          width: w, height: h, rotation: 0,
          style: { ...DEFAULT_STYLE }, zIndex: $shapes.length,
          createdAt: Date.now(), updatedAt: Date.now(),
          userId: $userId, timestamp: Date.now(),
          src, image: img
        } as Shape;
        store.addShape(imageShape);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function finishEditing() {
    if (editingShapeId) {
      store.updateShape(editingShapeId, { isEditing: false });
    }
    isEditingText = false;
    editingShapeId = null;
  }

  function handleTextInput(e: Event, shapeId: string) {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    store.updateShape(shapeId, { text: target.value } as any, false);
  }

  function handleTextBlur(shapeId: string) {
    const shape = $shapes.find(s => s.id === shapeId);
    if (shape && (shape.type === 'text' || shape.type === 'sticky')) {
      const text = (shape as any).text || '';
      if (text.trim() === '') {
        store.removeShape(shapeId);
      } else {
        store.updateShape(shapeId, { isEditing: false });
      }
    }
    isEditingText = false;
    editingShapeId = null;
  }

  function handleDoubleClick(e: MouseEvent) {
    const point = getCanvasPoint(e.clientX, e.clientY);
    const shape = findShapeAtPoint(point);
    if (shape && (shape.type === 'text' || shape.type === 'sticky')) {
      store.updateShape(shape.id, { isEditing: true });
      editingShapeId = shape.id;
      isEditingText = true;
      tick().then(() => {
        const selector = shape.type === 'text' ? `[data-text-id="${shape.id}"]` : `[data-sticky-id="${shape.id}"]`;
        const input = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
        if (input) input.focus();
      });
    }
  }

  function initBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel = new BroadcastChannel('whiteboard-sync');
      broadcastChannel.onmessage = (e) => {
        const { type, data } = e.data;
        if (type === 'operation') {
          store.receiveOperation(data);
        } else if (type === 'cursor') {
          if (data.userId !== $userId) {
            store.cursors.update(c => ({ ...c, [data.userId]: data }));
          }
        }
      };
    }
  }

  function cleanupCursors() {
    const now = Date.now();
    store.cursors.update(c => {
      const newCursors: typeof c = {};
      for (const key in c) {
        if (now - c[key].timestamp < 3000) newCursors[key] = c[key];
      }
      return newCursors;
    });
  }

  function redraw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.translate($panX, $panY);
    ctx.scale($zoom, $zoom);
    if ($gridEnabled) drawGrid(ctx);
    drawShapes(ctx);
    if (previewShape) drawShape(ctx, previewShape, true);
    if (selectionBox) drawSelectionBox(ctx);
    ctx.restore();
  }

  function drawGrid(ctx: CanvasRenderingContext2D) {
    const gridSize = $gridSize;
    let step = gridSize;
    if ($zoom < 0.5) step = gridSize * 5;
    if ($zoom < 0.2) step = gridSize * 10;
    const startX = Math.floor(-$panX / $zoom / step) * step;
    const startY = Math.floor(-$panY / $zoom / step) * step;
    const endX = startX + width / $zoom + step * 2;
    const endY = startY + height / $zoom + step * 2;
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5 / $zoom;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += step) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += step) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();
  }

  function drawShapes(ctx: CanvasRenderingContext2D) {
    const sorted = [...$shapes].sort((a, b) => a.zIndex - b.zIndex);
    for (const shape of sorted) {
      drawShape(ctx, shape, false);
    }
  }

  function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, isPreview: boolean) {
    ctx.save();
    if (shape.rotation !== 0) {
      const center = getCenter(shape);
      ctx.translate(center.x, center.y);
      ctx.rotate(shape.rotation * Math.PI / 180);
      ctx.translate(-center.x, -center.y);
    }
    ctx.lineWidth = shape.style.strokeWidth;
    ctx.strokeStyle = shape.style.strokeColor;
    ctx.fillStyle = shape.style.fillColor;
    if (shape.style.strokeDash.length > 0) ctx.setLineDash(shape.style.strokeDash);
    else ctx.setLineDash([]);
    if (isPreview) ctx.globalAlpha = 0.5;

    switch (shape.type) {
      case 'rectangle': drawRectangle(ctx, shape); break;
      case 'ellipse': drawEllipse(ctx, shape); break;
      case 'line': drawLine(ctx, shape); break;
      case 'arrow': drawArrow(ctx, shape); break;
      case 'pen': drawPen(ctx, shape); break;
      case 'text': drawText(ctx, shape); break;
      case 'sticky': drawSticky(ctx, shape); break;
      case 'image': drawImageShape(ctx, shape); break;
    }
    ctx.restore();
  }

  function drawRectangle(ctx: CanvasRenderingContext2D, shape: Shape) {
    const r = Math.min(shape.style.cornerRadius, shape.width / 2, shape.height / 2);
    ctx.beginPath();
    if (r > 0) {
      ctx.moveTo(shape.x + r, shape.y);
      ctx.lineTo(shape.x + shape.width - r, shape.y);
      ctx.quadraticCurveTo(shape.x + shape.width, shape.y, shape.x + shape.width, shape.y + r);
      ctx.lineTo(shape.x + shape.width, shape.y + shape.height - r);
      ctx.quadraticCurveTo(shape.x + shape.width, shape.y + shape.height, shape.x + shape.width - r, shape.y + shape.height);
      ctx.lineTo(shape.x + r, shape.y + shape.height);
      ctx.quadraticCurveTo(shape.x, shape.y + shape.height, shape.x, shape.y + shape.height - r);
      ctx.lineTo(shape.x, shape.y + r);
      ctx.quadraticCurveTo(shape.x, shape.y, shape.x + r, shape.y);
    } else {
      ctx.rect(shape.x, shape.y, shape.width, shape.height);
    }
    if (shape.style.fillColor !== 'transparent') ctx.fill();
    if (shape.style.strokeWidth > 0) ctx.stroke();
  }

  function drawEllipse(ctx: CanvasRenderingContext2D, shape: Shape) {
    ctx.beginPath();
    ctx.ellipse(shape.x + shape.width / 2, shape.y + shape.height / 2, shape.width / 2, shape.height / 2, 0, 0, Math.PI * 2);
    if (shape.style.fillColor !== 'transparent') ctx.fill();
    if (shape.style.strokeWidth > 0) ctx.stroke();
  }

  function drawLine(ctx: CanvasRenderingContext2D, shape: Shape) {
    const points = (shape as any).points || [{ x: shape.x, y: shape.y }, { x: shape.x + shape.width, y: shape.y + shape.height }];
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }

  function drawArrow(ctx: CanvasRenderingContext2D, shape: Shape) {
    const points = (shape as any).points || [{ x: shape.x, y: shape.y }, { x: shape.x + shape.width, y: shape.y + shape.height }];
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();

    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
    const headLength = 15;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(last.x - headLength * Math.cos(angle - Math.PI / 6), last.y - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(last.x - headLength * Math.cos(angle + Math.PI / 6), last.y - headLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  function drawPen(ctx: CanvasRenderingContext2D, shape: Shape) {
    const points = (shape as any).points || [];
    if (points.length < 2) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
    }
    ctx.stroke();
  }

  function drawText(ctx: CanvasRenderingContext2D, shape: Shape) {
    const text = (shape as any).text || '';
    if (!text || (shape as any).isEditing) return;
    ctx.font = `${shape.style.fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = shape.style.textColor;
    ctx.textBaseline = 'top';
    ctx.textAlign = shape.style.textAlign;
    let x = shape.x;
    if (shape.style.textAlign === 'center') x = shape.x + shape.width / 2;
    if (shape.style.textAlign === 'right') x = shape.x + shape.width;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, shape.y + i * (shape.style.fontSize * 1.2));
    }
  }

  function drawSticky(ctx: CanvasRenderingContext2D, shape: Shape) {
    const text = (shape as any).text || '';
    const isEditing = (shape as any).isEditing;
    ctx.fillStyle = shape.style.backgroundColor;
    ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);

    if (!text || isEditing) return;
    ctx.font = `${shape.style.fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#1e1e1e';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const padding = 10;
    const maxWidth = shape.width - padding * 2;
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      const metrics = ctx.measureText(test);
      if (metrics.width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], shape.x + padding, shape.y + padding + i * (shape.style.fontSize * 1.2));
    }
  }

  function drawImageShape(ctx: CanvasRenderingContext2D, shape: Shape) {
    const imgShape = shape as any;
    if (imgShape.image) {
      ctx.drawImage(imgShape.image, shape.x, shape.y, shape.width, shape.height);
    } else if (imgShape.src) {
      const img = new Image();
      img.onload = () => {
        imgShape.image = img;
        redraw();
      };
      img.src = imgShape.src;
    }
  }

  function drawSelectionBox(ctx: CanvasRenderingContext2D) {
    if (!selectionBox) return;
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1 / $zoom;
    ctx.setLineDash([5 / $zoom, 5 / $zoom]);
    ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
  }

  onMount(() => {
    handleResize();
    initBroadcastChannel();
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    const cleanupInterval = setInterval(cleanupCursors, 1000);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(cleanupInterval);
      if (broadcastChannel) broadcastChannel.close();
    };
  });

  afterUpdate(() => {
    redraw();
  });
</script>

<div
  bind:this={container}
  class="relative w-full h-full overflow-hidden bg-white no-select"
  on:mousedown={handleMouseDown}
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
  on:mouseleave={handleMouseUp}
  on:wheel={handleWheel}
  on:drop={handleDrop}
  on:dragover={handleDragOver}
  on:dblclick={handleDoubleClick}
>
  <canvas
    bind:this={canvas}
    width={width}
    height={height}
    class="absolute top-0 left-0"
  />

  {#each Object.values($cursors) as cursor}
    {#if cursor.userId !== $userId}
      <div
        class="absolute pointer-events-none z-50"
        style="transform: translate({$panX + cursor.x * $zoom}px, {$panY + cursor.y * $zoom}px)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill={cursor.color}>
          <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.86a.5.5 0 0 0-.85.35z"/>
        </svg>
        <span
          class="absolute top-5 left-4 px-2 py-0.5 text-xs text-white rounded whitespace-nowrap"
          style="background-color: {cursor.color}"
        >
          {cursor.name}
        </span>
      </div>
    {/if}
  {/each}

  {#each $shapes as shape}
    {#if shape.type === 'text' && (shape as any).isEditing}
      {@const textShape = shape as any}
      <input
        type="text"
        data-text-id={shape.id}
        value={textShape.text || ''}
        on:input={(e) => handleTextInput(e, shape.id)}
        on:blur={() => handleTextBlur(shape.id)}
        on:keydown={(e) => {
          if (e.key === 'Escape') (e.target as HTMLElement).blur();
        }}
        class="absolute z-40 bg-transparent outline-none border-none p-0 m-0"
        style="
          left: {$panX + shape.x * $zoom}px;
          top: {$panY + shape.y * $zoom}px;
          width: {shape.width * $zoom}px;
          height: {shape.height * $zoom}px;
          font-size: {shape.style.fontSize * $zoom}px;
          color: {shape.style.textColor};
          text-align: {shape.style.textAlign};
          transform: {shape.rotation !== 0 ? `rotate(${shape.rotation}deg)` : ''};
        "
      />
    {/if}
    {#if shape.type === 'sticky' && (shape as any).isEditing}
      {@const stickyShape = shape as any}
      <textarea
        data-sticky-id={shape.id}
        value={stickyShape.text || ''}
        on:input={(e) => handleTextInput(e, shape.id)}
        on:blur={() => handleTextBlur(shape.id)}
        on:keydown={(e) => {
          if (e.key === 'Escape') (e.target as HTMLElement).blur();
        }}
        class="absolute z-40 outline-none border-none p-2.5 resize-none"
        style="
          left: {$panX + shape.x * $zoom}px;
          top: {$panY + shape.y * $zoom}px;
          width: {shape.width * $zoom}px;
          height: {shape.height * $zoom}px;
          font-size: {shape.style.fontSize * $zoom}px;
          background-color: {shape.style.backgroundColor};
        "
      />
    {/if}
  {/each}

  <SelectionHandles />
</div>
