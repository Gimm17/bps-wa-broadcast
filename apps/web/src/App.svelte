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
  import Subscribe from './routes/public/Subscribe.svelte';
  import ManageSubscription from './routes/public/ManageSubscription.svelte';
  import UnsubscribeResult from './routes/public/UnsubscribeResult.svelte';
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
    '*': wrap({ component: Overview })
  };
</script>

{#if !initialized}
  <div class="min-h-screen bg-[#F7F7F3] flex items-center justify-center font-sans text-[#66706F]">
    <div class="flex items-center gap-3">
      <div class="w-3 h-3 rounded-full bg-[#007979] animate-ping"></div>
      <span class="text-[14px] font-mono">Memuat BPS WhatsApp Operations...</span>
    </div>
  </div>
{:else if isPublicPath($location)}
  <Router {routes} />
{:else}
  <AppShell>
    <Router {routes} />
  </AppShell>
{/if}
