<script lang="ts">
  import { store } from '../stores';
  import { exportPNG, exportSVG, exportJSON, downloadFile } from '../exporter';
  import { templates } from '../templates';
  import { get } from 'svelte/store';
  import type { Shape, Project } from '../types';
  import { generateId } from '../utils';

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

  let showTemplates = false;
  let showUserMenu = false;
  let userName = get(store.userName);

  async function handleExportPNG() {
    try {
      const onlySelection = $selectedIds.length > 0;
      const exportShapes = onlySelection ? $shapes.filter(s => $selectedIds.includes(s.id)) : $shapes;
      if (exportShapes.length === 0) {
        alert('没有可导出的内容');
        return;
      }
      const dataUrl = await exportPNG(exportShapes, onlySelection);
      downloadFile(dataUrl, 'whiteboard.png', 'image/png');
    } catch (e) {
      console.error('Export PNG error:', e);
      alert('导出失败');
    }
  }

  function handleExportSVG() {
    try {
      const onlySelection = $selectedIds.length > 0;
      const exportShapes = onlySelection ? $shapes.filter(s => $selectedIds.includes(s.id)) : $shapes;
      if (exportShapes.length === 0) {
        alert('没有可导出的内容');
        return;
      }
      const svg = exportSVG(exportShapes, onlySelection);
      downloadFile(svg, 'whiteboard.svg', 'image/svg+xml');
    } catch (e) {
      console.error('Export SVG error:', e);
      alert('导出失败');
    }
  }

  function handleExportJSON() {
    try {
      const project: Project = {
        id: generateId(),
        name: '白板工程',
        shapes: $shapes,
        viewport: { zoom: $zoom, panX: $panX, panY: $panY }
      };
      const json = exportJSON(project);
      downloadFile(json, 'whiteboard.json', 'application/json');
    } catch (e) {
      console.error('Export JSON error:', e);
      alert('导出失败');
    }
  }

  function handleImportJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const project = JSON.parse(text) as Project;
        store.importProject(project);
      } catch (err) {
        console.error('Import error:', err);
        alert('导入失败，请检查文件格式');
      }
    };
    input.click();
  }

  function applyTemplate(templateId: string) {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    store.clearAll();
    const shapes = template.shapes.map(s => ({
      ...s,
      id: generateId(),
      userId: get(store.userId),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      timestamp: Date.now()
    }));
    store.addShapes(shapes);
    showTemplates = false;
  }

  function handleClear() {
    if (confirm('确定要清空画布吗？')) {
      store.clearAll();
    }
  }

  function toggleGrid() {
    store.gridEnabled.update(v => !v);
  }

  function toggleSnap() {
    store.snapToGrid.update(v => !v);
  }

  function updateUserName() {
    store.userName.set(userName);
    showUserMenu = false;
  }

  let $gridEnabled: boolean;
  let $snapToGrid: boolean;
  store.gridEnabled.subscribe(v => $gridEnabled = v);
  store.snapToGrid.subscribe(v => $snapToGrid = v);
</script>

<div class="absolute top-4 left-4 flex items-center gap-2 z-50">
  <div class="flex items-center gap-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1">
    <button class="px-3 py-2 rounded hover:bg-gray-100 text-sm text-gray-600" on:click={() => showTemplates = !showTemplates}>
      <span class="flex items-center gap-1">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
        模板
      </span>
    </button>
    <div class="w-px h-6 bg-gray-200" />
    <button class="px-3 py-2 rounded hover:bg-gray-100 text-sm text-gray-600" on:click={handleExportPNG}>导出 PNG</button>
    <button class="px-3 py-2 rounded hover:bg-gray-100 text-sm text-gray-600" on:click={handleExportSVG}>导出 SVG</button>
    <button class="px-3 py-2 rounded hover:bg-gray-100 text-sm text-gray-600" on:click={handleExportJSON}>导出 JSON</button>
    <button class="px-3 py-2 rounded hover:bg-gray-100 text-sm text-gray-600" on:click={handleImportJSON}>导入 JSON</button>
    <div class="w-px h-6 bg-gray-200" />
    <button class={`px-3 py-2 rounded text-sm ${$gridEnabled ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`} on:click={toggleGrid}>网格</button>
    <button class={`px-3 py-2 rounded text-sm ${$snapToGrid ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`} on:click={toggleSnap}>吸附</button>
    <div class="w-px h-6 bg-gray-200" />
    <button class="px-3 py-2 rounded hover:bg-red-50 text-sm text-red-500" on:click={handleClear}>清空</button>
  </div>

  <div class="relative">
    <button
      class="flex items-center gap-2 bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
      on:click={() => showUserMenu = !showUserMenu}
    >
      <div class="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
        {userName.charAt(0)}
      </div>
      <span class="text-sm text-gray-600">{userName}</span>
    </button>
    {#if showUserMenu}
      <div class="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]">
        <label class="block text-xs text-gray-500 mb-1">用户名</label>
        <input
          type="text"
          bind:value={userName}
          class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm mb-2 focus:outline-none focus:border-blue-500"
          on:keydown={(e) => e.key === 'Enter' && updateUserName()}
        />
        <button
          class="w-full px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          on:click={updateUserName}
        >
          保存
        </button>
      </div>
    {/if}
  </div>
</div>

{#if showTemplates}
  <div class="absolute top-20 left-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50 max-w-md">
    <h3 class="text-sm font-medium text-gray-700 mb-3">选择模板</h3>
    <div class="grid grid-cols-2 gap-3">
      {#each templates as t}
        <button
          class="p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left transition-colors"
          on:click={() => applyTemplate(t.id)}
        >
          <div class="w-8 h-8 mb-2 text-gray-500">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d={t.icon} />
            </svg>
          </div>
          <div class="text-sm font-medium text-gray-700">{t.name}</div>
          <div class="text-xs text-gray-400 mt-0.5">{t.description}</div>
        </button>
      {/each}
    </div>
    <button
      class="mt-3 w-full px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
      on:click={() => showTemplates = false}
    >
      取消
    </button>
  </div>
{/if}
