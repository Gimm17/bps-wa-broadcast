<script>
  import { onMount } from 'svelte';
  import Router, { push, location } from 'svelte-spa-router';
  import { wrap } from 'svelte-spa-router/wrap';
  import { session, initSession } from './lib/stores/session.js';
  import AppShell from './lib/components/AppShell.svelte';
  import Login from './routes/Login.svelte';
  import Overview from './routes/Overview.svelte';
  import Contacts from './routes/Contacts.svelte';
  import ContactDetail from './routes/ContactDetail.svelte';
  import ImportReview from './routes/ImportReview.svelte';
  import Subscriptions from './routes/Subscriptions.svelte';
  import Templates from './routes/Templates.svelte';
  import Integrations from './routes/Integrations.svelte';
  import Campaigns from './routes/Campaigns.svelte';
  import CampaignCreate from './routes/CampaignCreate.svelte';
  import CampaignDetail from './routes/CampaignDetail.svelte';
  import Automations from './routes/Automations.svelte';
  import AutomationEdit from './routes/AutomationEdit.svelte';
  import DirectSend from './routes/DirectSend.svelte';
  import Schedules from './routes/Schedules.svelte';
  import MessageLogs from './routes/MessageLogs.svelte';
  import AuditLog from './routes/AuditLog.svelte';
  import Subscribe from './routes/public/Subscribe.svelte';
  import ManageSubscription from './routes/public/ManageSubscription.svelte';
  import UnsubscribeResult from './routes/public/UnsubscribeResult.svelte';
  import CustomDialog from './lib/components/CustomDialog.svelte';
  import './styles/global.css';

  let initialized = $state(false);

  function isPublicPath(path) {
    if (!path) return false;
    return path === '/login' ||
      path.startsWith('/subscribe') ||
      path.startsWith('/manage-subscription') ||
      path.startsWith('/unsubscribe');
  }

  onMount(async () => {
    await initSession();
    initialized = true;

    // Route guard on initial load
    if (!$session.isAuthenticated && !isPublicPath($location)) {
      push('/login');
    }
  });

  // Reactive route guard when location changes
  $effect(() => {
    if (initialized) {
      if (!$session.isAuthenticated && !isPublicPath($location)) {
        push('/login');
      } else if ($session.isAuthenticated && $location === '/login') {
        push('/');
      }
    }
  });

  const routes = {
    '/login': Login,
    '/subscribe': Subscribe,
    '/manage-subscription': ManageSubscription,
    '/unsubscribe': UnsubscribeResult,
    '/': wrap({ component: Overview }),
    '/overview': wrap({ component: Overview }),
    '/contacts': wrap({ component: Contacts }),
    '/contacts/:id': wrap({ component: ContactDetail }),
    '/imports/contacts/:id': wrap({ component: ImportReview }),
    '/subscriptions': wrap({ component: Subscriptions }),
    '/templates': wrap({ component: Templates }),
    '/integrations': wrap({ component: Integrations }),
    '/campaigns': wrap({ component: Campaigns }),
    '/campaigns/new': wrap({ component: CampaignCreate }),
    '/campaigns/:id': wrap({ component: CampaignDetail }),
    '/direct-send': wrap({ component: DirectSend }),
    '/automations': wrap({ component: Automations }),
    '/automations/new': wrap({ component: AutomationEdit }),
    '/automations/:id': wrap({ component: AutomationEdit }),
    '/schedules': wrap({ component: Schedules }),
    '/message-logs': wrap({ component: MessageLogs }),
    '/audit-and-settings': wrap({ component: AuditLog }),
    '*': wrap({ component: Overview })
  };
</script>

{#if !initialized}
  <div class="min-h-screen bg-[#F7F7F3] flex flex-col items-center justify-center font-sans text-[#66706F] gap-4">
    <div class="w-16 h-16 rounded-2xl overflow-hidden border border-[#DCE2DF] bg-white p-2 shadow-sm animate-pulse flex items-center justify-center">
      <img src="/logo-sapa.jpg" alt="Logo SAPA BPS Sulteng" class="w-full h-full object-contain rounded-xl" />
    </div>
    <div class="flex items-center gap-3">
      <div class="w-2.5 h-2.5 rounded-full bg-[#007979] animate-ping"></div>
      <span class="text-[13px] font-mono font-medium text-[#172020]">Memuat SAPA BPS Sulteng (Sistem Automasi Pesan &amp; Agenda)...</span>
    </div>
  </div>
{:else if isPublicPath($location)}
  <Router {routes} />
{:else}
  <AppShell>
    <Router {routes} />
  </AppShell>
{/if}

<CustomDialog />
