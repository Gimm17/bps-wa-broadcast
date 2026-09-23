<script>
  import { session, logoutUser } from '../stores/session.js';
  import { push } from 'svelte-spa-router';

  let { onToggleSidebar = () => {} } = $props();

  async function handleLogout() {
    await logoutUser();
    push('/login');
  }
</script>

<header class="fixed top-0 left-0 lg:left-64 right-0 h-14 bg-white/95 backdrop-blur-md border-b border-[#DCE2DF] z-40 px-4 lg:px-6 flex items-center justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
  <!-- Left Side: Mobile Menu & Cluster Diagnostics -->
  <div class="flex items-center gap-3">
    <!-- Hamburger button for mobile -->
    <button
      type="button"
      class="lg:hidden p-2 text-[#66706F] hover:text-[#172020] hover:bg-[#F7F7F3] rounded-lg min-touch-target flex items-center justify-center"
      onclick={onToggleSidebar}
      aria-label="Buka menu navigasi"
    >
      <span class="text-[20px] font-bold">☰</span>
    </button>

    <div class="flex items-center gap-2">
      <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#007979]/10 text-[#007979] border border-[#007979]/20 tracking-wide font-mono">
        PROD - Palu Cluster
      </span>
    </div>

    <div class="h-4 w-px bg-[#DCE2DF] hidden md:block"></div>

    <div class="hidden sm:flex items-center gap-2 text-[12px] text-[#66706F]">
      <div class="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#ecf6f5] border border-[#DCE2DF]">
        <span class="w-1.5 h-1.5 rounded-full bg-[#24B1B1]"></span>
        <span class="text-[11px] font-medium text-[#172020]">WABA: Terhubung</span>
      </div>
      <div class="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#ecf6f5] border border-[#DCE2DF] hidden md:flex">
        <span class="w-1.5 h-1.5 rounded-full bg-[#24B1B1]"></span>
        <span class="text-[11px] font-medium text-[#172020]">Cron: Aktif</span>
      </div>
      <div class="flex items-center gap-1 px-1.5 text-[#66706F] font-mono text-[11px]">
        <span>Asia/Makassar (WITA)</span>
      </div>
    </div>
  </div>

  <!-- Right Side: User Profile & Actions -->
  <div class="flex items-center gap-3">
    {#if $session.user}
      <div class="flex items-center gap-2.5">
        <div class="flex flex-col text-right hidden sm:flex">
          <span class="text-[13px] font-semibold text-[#172020] leading-tight">{$session.user.name}</span>
          <span class="text-[11px] text-[#66706F] leading-none capitalize">
            {$session.user.roles?.[0]?.replace('_', ' ') || 'Petugas BPS'}
          </span>
        </div>
        <div class="w-8 h-8 rounded-full bg-[#007979] text-white flex items-center justify-center font-semibold text-[13px]">
          {$session.user.name ? $session.user.name[0].toUpperCase() : 'U'}
        </div>
        <button
          type="button"
          class="ml-1 px-2.5 py-1 text-[12px] font-medium text-[#B42318] hover:bg-[#FEF3F2] rounded border border-[#B42318]/30 transition-colors"
          onclick={handleLogout}
        >
          Keluar
        </button>
      </div>
    {/if}
  </div>
</header>
