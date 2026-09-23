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
  import './styles/global.css';

  let initialized = $state(false);

  onMount(async () => {
    await initSession();
    initialized = true;

    // Route guard on initial load
    if (!$session.isAuthenticated && $location !== '/login') {
      push('/login');
    }
  });

  // Reactive route guard when location changes
  $effect(() => {
    if (initialized) {
      if (!$session.isAuthenticated && $location !== '/login') {
        push('/login');
      } else if ($session.isAuthenticated && $location === '/login') {
        push('/');
      }
    }
  });

  const routes = {
    '/login': Login,
    '/': wrap({ component: Overview }),
    '/overview': wrap({ component: Overview }),
    '/contacts': wrap({ component: Contacts }),
    '/contacts/:id': wrap({ component: ContactDetail }),
    '/imports/contacts/:id': wrap({ component: ImportReview }),
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
{:else if $location === '/login'}
  <Router {routes} />
{:else}
  <AppShell>
    <Router {routes} />
  </AppShell>
{/if}
