<script lang="ts">
  import { store } from '../stores';
  import type { ToolType } from '../types';

  let $tool: ToolType;
  let $selectedIds: string[];
  let $zoom: number;

  store.tool.subscribe(v => $tool = v);
  store.selectedIds.subscribe(v => $selectedIds = v);
  store.zoom.subscribe(v => $zoom = v);

  const tools: { id: ToolType; label: string; icon: string }[] = [
    { id: 'select', label: '选择', icon: 'M15.04 12.195l4.95 7.66-3.81 2.46-4.94-7.66-3.08 4.77-.01 4.85H5.13V3.14h3.03l6.88 9.054zM8.17 11.845l3.04-4h2.46l-3.04 4h-2.46z' },
    { id: 'rectangle', label: '矩形', icon: 'M4 4h16v16H4V4zm2 2v12h12V6H6z' },
    { id: 'ellipse', label: '椭圆', icon: 'M12 4c-4.418 0-8 3.582-8 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-8zm0 14c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z' },
    { id: 'line', label: '线段', icon: 'M4 19.5L20 4.5' },
    { id: 'arrow', label: '箭头', icon: 'M4 12h12m0 0l-5-5m5 5l-5 5' },
    { id: 'pen', label: '手绘', icon: 'M3 21l4.5-1.5L18 9l-6-6L4.5 16.5 3 21zm10.5-10.5l-3 3' },
    { id: 'text', label: '文字', icon: 'M5 5v14h2v-4h10v4h2V5h-2v8H7V5H5z' },
    { id: 'sticky', label: '便签', icon: 'M4 4h12l4 4v12H4V4zm12 2v4h4l-4-4z' },
    { id: 'image', label: '图片', icon: 'M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2l3 4 2-2 3 4H8V8z' },
    { id: 'eraser', label: '橡皮擦', icon: 'M3 17l9-9 4 4-9 9H6l-3-3zm11-11l4 4-2 2-4-4 2-2z' }
  ];

  function setTool(tool: ToolType) {
    store.tool.set(tool);
    if (tool !== 'select') {
      store.selectedIds.set([]);
    }
  }

  function zoomIn() {
    store.zoom.update(z => Math.min(z * 1.2, 8));
  }

  function zoomOut() {
    store.zoom.update(z => Math.max(z / 1.2, 0.1));
  }

  function resetView() {
    store.zoom.set(1);
    store.panX.set(0);
    store.panY.set(0);
  }

  function undo() {
    store.undo();
  }

  function redo() {
    store.redo();
  }

  function group() {
    if ($selectedIds.length >= 2) {
      store.group($selectedIds);
    }
  }

  function ungroup() {
    if ($selectedIds.length === 1) {
      store.ungroup($selectedIds[0]);
    }
  }

  function copy() {
    store.copy();
  }

  function paste() {
    store.paste();
  }

  function deleteSelected() {
    store.deleteSelected();
  }
</script>

<div class="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1.5 z-50">
  {#each tools as t}
    <button
      class={`p-2 rounded transition-colors ${$tool === t.id ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}
      title={t.label}
      on:click={() => setTool(t.id)}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d={t.icon} />
      </svg>
    </button>
  {/each}

  <div class="w-px h-8 bg-gray-200 mx-1" />

  <button class="p-2 rounded hover:bg-gray-100 text-gray-600" title="撤销 (Cmd+Z)" on:click={undo}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  </button>
  <button class="p-2 rounded hover:bg-gray-100 text-gray-600" title="重做 (Cmd+Shift+Z)" on:click={redo}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
    </svg>
  </button>

  <div class="w-px h-8 bg-gray-200 mx-1" />

  <button class="p-2 rounded hover:bg-gray-100 text-gray-600" title="组合 (Cmd+G)" on:click={group} disabled={$selectedIds.length < 2}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  </button>
  <button class="p-2 rounded hover:bg-gray-100 text-gray-600" title="取消组合" on:click={ungroup} disabled={$selectedIds.length !== 1}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="8" y="8" width="8" height="8" />
      <rect x="3" y="3" width="5" height="5" />
      <rect x="16" y="3" width="5" height="5" />
      <rect x="3" y="16" width="5" height="5" />
      <rect x="16" y="16" width="5" height="5" />
    </svg>
  </button>

  <div class="w-px h-8 bg-gray-200 mx-1" />

  <button class="p-2 rounded hover:bg-gray-100 text-gray-600" title="复制 (Cmd+C)" on:click={copy}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  </button>
  <button class="p-2 rounded hover:bg-gray-100 text-gray-600" title="粘贴 (Cmd+V)" on:click={paste}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
    </svg>
  </button>
  <button class="p-2 rounded hover:bg-gray-100 text-red-500" title="删除 (Delete)" on:click={deleteSelected} disabled={$selectedIds.length === 0}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  </button>

  <div class="w-px h-8 bg-gray-200 mx-1" />

  <button class="p-2 rounded hover:bg-gray-100 text-gray-600" title="缩小" on:click={zoomOut}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  </button>
  <span class="text-sm text-gray-600 min-w-[50px] text-center">{Math.round($zoom * 100)}%</span>
  <button class="p-2 rounded hover:bg-gray-100 text-gray-600" title="放大" on:click={zoomIn}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  </button>
  <button class="p-2 rounded hover:bg-gray-100 text-gray-600" title="重置视图" on:click={resetView}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  </button>
</div>
