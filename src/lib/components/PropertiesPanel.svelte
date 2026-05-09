<script lang="ts">
  import { store } from '../stores';
  import { DEFAULT_STYLE, STICKY_COLORS } from '../types';
  import type { Style, Shape, StickyColor, TextAlign } from '../types';
  import { deepClone } from '../utils';

  let $selectedShapes: Shape[];
  let $currentStyle: Style;

  store.selectedShapes.subscribe(v => $selectedShapes = v);
  store.currentStyle.subscribe(v => $currentStyle = v);

  const colors = [
    '#1e1e1e', '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
    'transparent'
  ];

  const lineWidths = [1, 2, 3, 5, 8, 12];
  const fontSizes = [12, 14, 16, 18, 20, 24, 32, 48];

  $: hasSelection = $selectedShapes.length > 0;
  $: singleSelection = $selectedShapes.length === 1;
  $: selectedStyle = singleSelection ? $selectedShapes[0].style : $currentStyle;
  $: isText = singleSelection && ($selectedShapes[0].type === 'text' || $selectedShapes[0].type === 'sticky');
  $: isSticky = singleSelection && $selectedShapes[0].type === 'sticky';

  function updateStyle(key: keyof Style, value: any) {
    if (hasSelection) {
      const updates = $selectedShapes.map(s => ({
        id: s.id,
        updates: {
          style: {
            ...s.style,
            [key]: value
          }
        }
      }));
      store.updateShapes(updates);
    } else {
      store.currentStyle.update(s => ({ ...s, [key]: value }));
    }
  }

  function updateStickyColor(color: StickyColor) {
    if (isSticky) {
      store.updateShape($selectedShapes[0].id, {
        color,
        style: {
          ...$selectedShapes[0].style,
          backgroundColor: STICKY_COLORS[color]
        }
      });
    }
  }

  function updateStrokeWidth(w: number) {
    updateStyle('strokeWidth', w);
  }

  function updateFontSize(s: number) {
    updateStyle('fontSize', s);
  }

  function updateTextAlign(align: TextAlign) {
    updateStyle('textAlign', align);
  }

  function updateCornerRadius(r: number) {
    updateStyle('cornerRadius', r);
  }

  function toggleDashed() {
    const current = selectedStyle.strokeDash.length > 0;
    updateStyle('strokeDash', current ? [] : [5, 5]);
  }

  function moveUp() {
    if (hasSelection) {
      store.setZIndex($selectedShapes.map(s => s.id), 'up');
    }
  }

  function moveDown() {
    if (hasSelection) {
      store.setZIndex($selectedShapes.map(s => s.id), 'down');
    }
  }

  function moveFront() {
    if (hasSelection) {
      store.setZIndex($selectedShapes.map(s => s.id), 'front');
    }
  }

  function moveBack() {
    if (hasSelection) {
      store.setZIndex($selectedShapes.map(s => s.id), 'back');
    }
  }

  function alignLeft() {
    if ($selectedShapes.length < 2) return;
    const minX = Math.min(...$selectedShapes.map(s => s.x));
    const updates = $selectedShapes.map(s => ({
      id: s.id,
      updates: { x: minX }
    }));
    store.updateShapes(updates);
  }

  function alignCenter() {
    if ($selectedShapes.length < 2) return;
    const avgX = $selectedShapes.reduce((sum, s) => sum + s.x + s.width / 2, 0) / $selectedShapes.length;
    const updates = $selectedShapes.map(s => ({
      id: s.id,
      updates: { x: avgX - s.width / 2 }
    }));
    store.updateShapes(updates);
  }

  function alignRight() {
    if ($selectedShapes.length < 2) return;
    const maxX = Math.max(...$selectedShapes.map(s => s.x + s.width));
    const updates = $selectedShapes.map(s => ({
      id: s.id,
      updates: { x: maxX - s.width }
    }));
    store.updateShapes(updates);
  }

  function alignTop() {
    if ($selectedShapes.length < 2) return;
    const minY = Math.min(...$selectedShapes.map(s => s.y));
    const updates = $selectedShapes.map(s => ({
      id: s.id,
      updates: { y: minY }
    }));
    store.updateShapes(updates);
  }

  function alignMiddle() {
    if ($selectedShapes.length < 2) return;
    const avgY = $selectedShapes.reduce((sum, s) => sum + s.y + s.height / 2, 0) / $selectedShapes.length;
    const updates = $selectedShapes.map(s => ({
      id: s.id,
      updates: { y: avgY - s.height / 2 }
    }));
    store.updateShapes(updates);
  }

  function alignBottom() {
    if ($selectedShapes.length < 2) return;
    const maxY = Math.max(...$selectedShapes.map(s => s.y + s.height));
    const updates = $selectedShapes.map(s => ({
      id: s.id,
      updates: { y: maxY - s.height }
    }));
    store.updateShapes(updates);
  }
</script>

<div class="absolute top-20 right-4 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50 max-h-[calc(100vh-120px)] overflow-y-auto">
  {#if !hasSelection}
    <div class="text-sm text-gray-500 text-center py-4">选择图形以编辑属性</div>
  {:else}
    <div class="space-y-4">
      {#if isSticky}
        <div>
          <div class="text-xs text-gray-500 mb-2 font-medium">便签颜色</div>
          <div class="flex flex-wrap gap-1">
            {#each Object.entries(STICKY_COLORS) as [name, color]}
              <button
                class={`w-6 h-6 rounded border-2 ${($selectedShapes[0] as any).color === name ? 'border-blue-500' : 'border-gray-200'}`}
                style="background-color: {color}"
                on:click={() => updateStickyColor(name as StickyColor)}
              />
            {/each}
          </div>
        </div>
      {/if}

      <div>
        <div class="text-xs text-gray-500 mb-2 font-medium">描边颜色</div>
        <div class="flex flex-wrap gap-1">
          {#each colors as c}
            <button
              class={`w-6 h-6 rounded border-2 ${selectedStyle.strokeColor === c ? 'border-blue-500' : 'border-gray-200'}`}
              style={c === 'transparent' ? 'background: repeating-linear-gradient(45deg, #ddd, #ddd 3px, #fff 3px, #fff 6px)' : `background-color: ${c}`}
              on:click={() => updateStyle('strokeColor', c)}
            />
          {/each}
        </div>
      </div>

      <div>
        <div class="text-xs text-gray-500 mb-2 font-medium">填充颜色</div>
        <div class="flex flex-wrap gap-1">
          {#each colors as c}
            <button
              class={`w-6 h-6 rounded border-2 ${selectedStyle.fillColor === c ? 'border-blue-500' : 'border-gray-200'}`}
              style={c === 'transparent' ? 'background: repeating-linear-gradient(45deg, #ddd, #ddd 3px, #fff 3px, #fff 6px)' : `background-color: ${c}`}
              on:click={() => updateStyle('fillColor', c)}
            />
          {/each}
        </div>
      </div>

      <div>
        <div class="text-xs text-gray-500 mb-2 font-medium">线条粗细</div>
        <div class="flex gap-1">
          {#each lineWidths as w}
            <button
              class={`flex-1 h-8 rounded flex items-center justify-center ${selectedStyle.strokeWidth === w ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              on:click={() => updateStrokeWidth(w)}
            >
              <div class="w-full h-px bg-current" style="height: {w}px" />
            </button>
          {/each}
        </div>
      </div>

      <div>
        <button
          class={`w-full py-2 px-3 rounded text-sm flex items-center justify-center gap-2 ${selectedStyle.strokeDash.length > 0 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          on:click={toggleDashed}
        >
          <div class="flex gap-0.5">
            <div class="w-2 h-0.5 bg-current" />
            <div class="w-2 h-0.5 bg-transparent" />
            <div class="w-2 h-0.5 bg-current" />
          </div>
          <span>虚线</span>
        </button>
      </div>

      <div>
        <div class="text-xs text-gray-500 mb-2 font-medium">圆角</div>
        <input
          type="range"
          min="0"
          max="50"
          value={selectedStyle.cornerRadius}
          class="w-full"
          on:input={(e) => updateCornerRadius(parseInt((e.target as HTMLInputElement).value))}
        />
        <div class="text-xs text-gray-400 text-center">{selectedStyle.cornerRadius}px</div>
      </div>

      {#if isText}
        <div>
          <div class="text-xs text-gray-500 mb-2 font-medium">字体大小</div>
          <div class="flex flex-wrap gap-1">
            {#each fontSizes as s}
              <button
                class={`px-2 py-1 rounded text-sm ${selectedStyle.fontSize === s ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                on:click={() => updateFontSize(s)}
              >
                {s}
              </button>
            {/each}
          </div>
        </div>

        <div>
          <div class="text-xs text-gray-500 mb-2 font-medium">文字对齐</div>
          <div class="flex gap-1">
            <button
              class={`flex-1 py-2 rounded ${selectedStyle.textAlign === 'left' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              on:click={() => updateTextAlign('left')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="15" y2="12" />
                <line x1="3" y1="18" x2="18" y2="18" />
              </svg>
            </button>
            <button
              class={`flex-1 py-2 rounded ${selectedStyle.textAlign === 'center' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              on:click={() => updateTextAlign('center')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="6" y1="12" x2="18" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
            <button
              class={`flex-1 py-2 rounded ${selectedStyle.textAlign === 'right' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              on:click={() => updateTextAlign('right')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="9" y1="12" x2="21" y2="12" />
                <line x1="6" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div>
          <div class="text-xs text-gray-500 mb-2 font-medium">文字颜色</div>
          <div class="flex flex-wrap gap-1">
            {#each colors as c}
              {#if c !== 'transparent'}
                <button
                  class={`w-6 h-6 rounded border-2 ${selectedStyle.textColor === c ? 'border-blue-500' : 'border-gray-200'}`}
                  style={`background-color: ${c}`}
                  on:click={() => updateStyle('textColor', c)}
                />
              {/if}
            {/each}
          </div>
        </div>
      {/if}

      <div class="border-t border-gray-200 pt-3">
        <div class="text-xs text-gray-500 mb-2 font-medium">排列</div>
        <div class="grid grid-cols-3 gap-1">
          <button class="p-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50" disabled={$selectedShapes.length < 2} on:click={alignLeft} title="左对齐">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="10" height="5" />
              <rect x="3" y="10" width="14" height="5" />
              <rect x="3" y="17" width="8" height="5" />
            </svg>
          </button>
          <button class="p-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50" disabled={$selectedShapes.length < 2} on:click={alignCenter} title="水平居中">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="6" y="3" width="12" height="5" />
              <rect x="4" y="10" width="16" height="5" />
              <rect x="7" y="17" width="10" height="5" />
            </svg>
          </button>
          <button class="p-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50" disabled={$selectedShapes.length < 2} on:click={alignRight} title="右对齐">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="11" y="3" width="10" height="5" />
              <rect x="7" y="10" width="14" height="5" />
              <rect x="13" y="17" width="8" height="5" />
            </svg>
          </button>
          <button class="p-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50" disabled={$selectedShapes.length < 2} on:click={alignTop} title="顶对齐">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="5" height="10" />
              <rect x="10" y="3" width="5" height="14" />
              <rect x="17" y="3" width="5" height="8" />
            </svg>
          </button>
          <button class="p-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50" disabled={$selectedShapes.length < 2} on:click={alignMiddle} title="垂直居中">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="5" width="5" height="10" />
              <rect x="10" y="3" width="5" height="14" />
              <rect x="17" y="6" width="5" height="8" />
            </svg>
          </button>
          <button class="p-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50" disabled={$selectedShapes.length < 2} on:click={alignBottom} title="底对齐">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="8" width="5" height="10" />
              <rect x="10" y="4" width="5" height="14" />
              <rect x="17" y="10" width="5" height="8" />
            </svg>
          </button>
        </div>
      </div>

      <div>
        <div class="text-xs text-gray-500 mb-2 font-medium">层级</div>
        <div class="flex gap-1">
          <button class="flex-1 py-2 rounded bg-gray-100 hover:bg-gray-200 text-xs" on:click={moveFront} title="置顶">
            置顶
          </button>
          <button class="flex-1 py-2 rounded bg-gray-100 hover:bg-gray-200 text-xs" on:click={moveUp} title="上移">
            上移
          </button>
          <button class="flex-1 py-2 rounded bg-gray-100 hover:bg-gray-200 text-xs" on:click={moveDown} title="下移">
            下移
          </button>
          <button class="flex-1 py-2 rounded bg-gray-100 hover:bg-gray-200 text-xs" on:click={moveBack} title="置底">
            置底
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
