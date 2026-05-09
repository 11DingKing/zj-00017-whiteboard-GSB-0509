<script lang="ts">
  import Canvas from '../lib/components/Canvas.svelte';
  import Toolbar from '../lib/components/Toolbar.svelte';
  import PropertiesPanel from '../lib/components/PropertiesPanel.svelte';
  import TopMenu from '../lib/components/TopMenu.svelte';
</script>

<div class="w-full h-full bg-gray-100 relative overflow-hidden">
  <Canvas />
  <Toolbar />
  <PropertiesPanel />
  <TopMenu />
</div>
