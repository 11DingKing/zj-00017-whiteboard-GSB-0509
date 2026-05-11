<script lang="ts">
  import { store } from '../stores';
  import { getBounds, getCenter } from '../utils';
  import type { Shape, Point, Bounds } from '../types';

  let $shapes: Shape[];
  let $selectedIds: string[];
  let $zoom: number;
  let $panX: number;
  let $panY: number;

  store.shapes.subscribe(v => $shapes = v);
  store.selectedIds.subscribe(v => $selectedIds = v);
  store.zoom.subscribe(v => $zoom = v);
  store.panX.subscribe(v => $panX = v);
  store.panY.subscribe(v => $panY = v);

  function getRotatedCorners(shape: Shape): Point[] {
    const center = getCenter(shape);
    const angle = shape.rotation * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const corners = [
      { x: shape.x, y: shape.y },
      { x: shape.x + shape.width, y: shape.y },
      { x: shape.x + shape.width, y: shape.y + shape.height },
      { x: shape.x, y: shape.y + shape.height }
    ];
    return corners.map(corner => {
      const dx = corner.x - center.x;
      const dy = corner.y - center.y;
      return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos
      };
    });
  }

  function getSelectionBounds(shapes: Shape[]): Bounds | null {
    if (shapes.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const shape of shapes) {
      const corners = getRotatedCorners(shape);
      for (const corner of corners) {
        minX = Math.min(minX, corner.x);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        maxY = Math.max(maxY, corner.y);
      }
    }
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  let isDragging = false;
  let dragHandle: string | null = null;
  let startPoint = { x: 0, y: 0 };
  let startBounds = { x: 0, y: 0, width: 0, height: 0 };
  let startShapes: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
  let startRotation = 0;

  $: selectedShapes = $shapes.filter(s => $selectedIds.includes(s.id));
  $: bounds = getSelectionBounds(selectedShapes);
  $: center = bounds ? getCenter({ ...bounds, rotation: 0 } as any) : null;
  $: screenX = bounds ? $panX + bounds.x * $zoom : 0;
  $: screenY = bounds ? $panY + bounds.y * $zoom : 0;
  $: screenWidth = bounds ? bounds.width * $zoom : 0;
  $: screenHeight = bounds ? bounds.height * $zoom : 0;

  const handles = [
    { id: 'nw', cursor: 'nwse-resize', x: 0, y: 0 },
    { id: 'n', cursor: 'ns-resize', x: 0.5, y: 0 },
    { id: 'ne', cursor: 'nesw-resize', x: 1, y: 0 },
    { id: 'e', cursor: 'ew-resize', x: 1, y: 0.5 },
    { id: 'se', cursor: 'nwse-resize', x: 1, y: 1 },
    { id: 's', cursor: 'ns-resize', x: 0.5, y: 1 },
    { id: 'sw', cursor: 'nesw-resize', x: 0, y: 1 },
    { id: 'w', cursor: 'ew-resize', x: 0, y: 0.5 }
  ];

  function handleMouseDown(e: MouseEvent, handle: string) {
    e.stopPropagation();
    isDragging = true;
    dragHandle = handle;
    startPoint = { x: e.clientX, y: e.clientY };
    if (bounds) {
      startBounds = { ...bounds };
    }
    startShapes = selectedShapes.map(s => ({
      id: s.id,
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height
    }));
    if (selectedShapes.length === 1) {
      startRotation = selectedShapes[0].rotation;
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging || !bounds) return;
    const dx = (e.clientX - startPoint.x) / $zoom;
    const dy = (e.clientY - startPoint.y) / $zoom;

    if (dragHandle === 'rotate') {
      if (center && selectedShapes.length === 1) {
        const angle1 = Math.atan2(startPoint.y - ($panY + center.y * $zoom), startPoint.x - ($panX + center.x * $zoom));
        const angle2 = Math.atan2(e.clientY - ($panY + center.y * $zoom), e.clientX - ($panX + center.x * $zoom));
        const deltaDeg = (angle2 - angle1) * 180 / Math.PI;
        store.updateShape(selectedShapes[0].id, { rotation: startRotation + deltaDeg }, false);
      }
      return;
    }

    let newX = startBounds.x;
    let newY = startBounds.y;
    let newW = startBounds.width;
    let newH = startBounds.height;

    switch (dragHandle) {
      case 'nw':
        newX += dx;
        newY += dy;
        newW -= dx;
        newH -= dy;
        break;
      case 'n':
        newY += dy;
        newH -= dy;
        break;
      case 'ne':
        newY += dy;
        newW += dx;
        newH -= dy;
        break;
      case 'e':
        newW += dx;
        break;
      case 'se':
        newW += dx;
        newH += dy;
        break;
      case 's':
        newH += dy;
        break;
      case 'sw':
        newX += dx;
        newW -= dx;
        newH += dy;
        break;
      case 'w':
        newX += dx;
        newW -= dx;
        break;
    }

    if (newW < 5) newW = 5;
    if (newH < 5) newH = 5;

    const scaleX = newW / startBounds.width;
    const scaleY = newH / startBounds.height;

    const updates = startShapes.map(s => {
      const relX = (s.x - startBounds.x) / startBounds.width;
      const relY = (s.y - startBounds.y) / startBounds.height;
      const newShapeX = newX + relX * newW;
      const newShapeY = newY + relY * newH;
      const newShapeW = s.width * scaleX;
      const newShapeH = s.height * scaleY;
      return {
        id: s.id,
        updates: {
          x: newShapeX,
          y: newShapeY,
          width: newShapeW,
          height: newShapeH
        }
      };
    });

    store.updateShapes(updates, false);
  }

  function handleMouseUp() {
    if (isDragging) {
      const updates = selectedShapes.map(s => ({
        id: s.id,
        updates: {}
      }));
      if (updates.length > 0) {
        store.updateShapes(updates, true);
      }
    }
    isDragging = false;
    dragHandle = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }
</script>

{#if bounds && selectedShapes.length > 0}
  <div
    class="absolute border-2 border-blue-500 pointer-events-none"
    style="
      left: {screenX}px;
      top: {screenY}px;
      width: {screenWidth}px;
      height: {screenHeight}px;
    "
  >
    {#each handles as h}
      <div
        class="absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-{h.cursor} pointer-events-auto hover:bg-blue-100"
        style="
          left: {h.x * 100}%;
          top: {h.y * 100}%;
          transform: translate(-50%, -50%);
          cursor: {h.cursor};
        "
        on:mousedown={(e) => handleMouseDown(e, h.id)}
      />
    {/each}

    {#if selectedShapes.length === 1}
      <div
        class="absolute w-0.5 bg-blue-500 pointer-events-none"
        style="
          left: 50%;
          top: -20px;
          height: 20px;
          transform: translateX(-50%);
        "
      />
      <div
        class="absolute w-4 h-4 bg-blue-500 rounded-full cursor-pointer pointer-events-auto hover:bg-blue-600"
        style="
          left: 50%;
          top: -20px;
          transform: translate(-50%, -50%);
          cursor: grab;
        "
        on:mousedown={(e) => handleMouseDown(e, 'rotate')}
      />
    {/if}
  </div>
{/if}
