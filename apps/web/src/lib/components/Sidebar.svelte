<script>
  import { location } from 'svelte-spa-router';

  let { isOpen = false, onClose = () => {} } = $props();

  const navSections = [
    {
      title: 'Diseminasi & Komunikasi',
      items: [
        { path: '/', label: 'Overview', icon: 'dashboard' },
        { path: '/campaigns', label: 'Campaigns', icon: 'campaign' },
        { path: '/direct-send', label: 'Kirim Manual / Test', icon: 'send' },
        { path: '/automations', label: 'Automations', icon: 'smart_toy' },
        { path: '/templates', label: 'Templates', icon: 'quickreply' }
      ]
    },
    {
      title: 'Direktori & Distribusi',
      items: [
        { path: '/contacts', label: 'Contacts', icon: 'contacts' },
        { path: '/subscriptions', label: 'Subscriptions', icon: 'mark_email_read' },
        { path: '/schedules', label: 'Schedules & Calendar', icon: 'calendar_clock' },
        { path: '/message-logs', label: 'Message Logs', icon: 'receipt_long' }
      ]
    },
    {
      title: 'Infrastruktur & Sistem',
      items: [
        { path: '/integrations', label: 'Integrations', icon: 'hub' },
        { path: '/users-and-roles', label: 'Users & Roles', icon: 'manage_accounts' },
        { path: '/audit-and-settings', label: 'Audit & Settings', icon: 'admin_panel_settings' }
      ]
    }
  ];

  function isActive(currentPath, itemPath) {
    if (itemPath === '/') {
      return currentPath === '/' || currentPath === '' || currentPath === '/overview';
    }
    return currentPath.startsWith(itemPath);
  }
</script>

<!-- Mobile Overlay Backdrop -->
{#if isOpen}
  <div
    class="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
    onclick={onClose}
    onkeydown={(e) => e.key === 'Escape' && onClose()}
    role="button"
    tabindex="-1"
    aria-label="Tutup menu navigasi"
  ></div>
{/if}

<aside
  class="fixed left-0 top-0 h-screen w-64 bg-[#007979] text-[#FFFFFF] z-50 flex flex-col justify-between overflow-y-auto border-r border-[#DCE2DF]/20 shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-transform duration-200 ease-in-out {isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}"
  aria-label="Navigasi utama"
>
  <div class="flex flex-col">
    <!-- Brand Emblem Header -->
    <div class="h-14 px-4 flex items-center gap-3 border-b border-white/10 bg-[#006a6a]/20">
      <div class="relative w-8 h-8 flex-shrink-0 flex items-center justify-center">
        <svg class="w-8 h-8" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <rect fill="#FFFFFF" height="31" rx="2" transform="rotate(45 24 2)" width="31" x="24" y="2"></rect>
          <rect fill="#24B1B1" height="21" rx="1.5" transform="rotate(45 24 9)" width="21" x="24" y="9"></rect>
          <rect fill="#E37434" height="11" rx="1" transform="rotate(45 24 16)" width="11" x="24" y="16"></rect>
        </svg>
      </div>
      <div class="flex flex-col min-w-0">
        <span class="text-[14px] font-semibold text-[#FFFFFF] truncate tracking-tight">BPS Sulteng</span>
        <span class="text-[11px] text-[#97f2f1] opacity-90 truncate leading-none">WhatsApp Operations</span>
      </div>
    </div>

    <!-- Navigation Sections -->
    {#each navSections as section}
      <div class="px-3 py-2.5">
        <div class="text-[10px] uppercase tracking-wider font-semibold text-[#97f2f1]/80 px-3 mb-1.5 font-mono">
          {section.title}
        </div>
        <nav class="flex flex-col gap-0.5">
          {#each section.items as item}
            {@const active = isActive($location, item.path)}
            <a
              href="#{item.path}"
              onclick={onClose}
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors {active ? 'bg-[#E37434] text-white shadow-sm font-semibold' : 'text-[#97f2f1] hover:bg-white/10 hover:text-white'}"
              aria-current={active ? 'page' : undefined}
            >
              <span class="text-[14px] font-mono">▸</span>
              <span>{item.label}</span>
            </a>
          {/each}
        </nav>
      </div>
    {/each}
  </div>

  <!-- Footer Version Strip -->
  <div class="p-3 border-t border-white/10 bg-[#006a6a]/30">
    <div class="flex items-center justify-between text-[11px] text-[#97f2f1]/90">
      <span class="font-mono">BPS WABA v2.4</span>
      <span class="px-1.5 py-0.5 rounded bg-[#007979] border border-[#97f2f1]/30 text-[10px] text-white font-mono font-semibold">PROD</span>
    </div>
  </div>
</aside>
