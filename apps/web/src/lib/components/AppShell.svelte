<script>
  import Sidebar from './Sidebar.svelte';
  import TopBar from './TopBar.svelte';

  let { children } = $props();
  let isSidebarOpen = $state(false);

  function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
  }

  function closeSidebar() {
    isSidebarOpen = false;
  }
</script>

<div class="min-h-screen bg-[#F7F7F3] flex flex-col font-sans">
  <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

  <div class="pl-0 lg:pl-64 flex flex-col min-h-screen">
    <TopBar onToggleSidebar={toggleSidebar} />

    <main class="w-full pt-14 flex-1">
      <div class="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
        {@render children?.()}
      </div>
    </main>
  </div>
</div>
