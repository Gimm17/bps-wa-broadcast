<script>
  import { fade, scale } from 'svelte/transition';
  import { dialogStore } from '../stores/dialog.js';

  let showDetails = $state(false);

  function handleKeydown(e) {
    if (!$dialogStore) return;
    if (e.key === 'Escape') {
      if ($dialogStore.onCancel) {
        $dialogStore.onCancel();
      } else if ($dialogStore.onConfirm) {
        $dialogStore.onConfirm();
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      if ($dialogStore.onConfirm) {
        $dialogStore.onConfirm();
      }
    }
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) {
      if ($dialogStore.onCancel) {
        $dialogStore.onCancel();
      } else if ($dialogStore.onConfirm) {
        $dialogStore.onConfirm();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if $dialogStore}
  <!-- Backdrop with deep blur and frosted glass lighting -->
  <div
    class="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-[#0b1313]/60 backdrop-blur-md"
    transition:fade={{ duration: 180 }}
    onclick={handleBackdropClick}
    role="presentation"
  >
    <!-- Dialog Card -->
    <div
      class="relative w-full max-w-lg bg-white/95 backdrop-blur-2xl rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.35)] border border-white/80 overflow-hidden text-left focus:outline-none"
      transition:scale={{ duration: 200, start: 0.95 }}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Top Colored Accent Gradient Strip -->
      <div
        class="h-1.5 w-full bg-gradient-to-r"
        class:from-emerald-400={!$dialogStore.isDanger && $dialogStore.type === 'success'}
        class:via-teal-500={!$dialogStore.isDanger && $dialogStore.type === 'success'}
        class:to-emerald-600={!$dialogStore.isDanger && $dialogStore.type === 'success'}
        class:from-rose-500={$dialogStore.isDanger || $dialogStore.type === 'error'}
        class:via-red-500={$dialogStore.isDanger || $dialogStore.type === 'error'}
        class:to-rose-600={$dialogStore.isDanger || $dialogStore.type === 'error'}
        class:from-[#E37434]={!$dialogStore.isDanger && $dialogStore.type === 'confirm'}
        class:via-amber-500={!$dialogStore.isDanger && $dialogStore.type === 'confirm'}
        class:to-orange-600={!$dialogStore.isDanger && $dialogStore.type === 'confirm'}
        class:from-[#007979]={$dialogStore.type === 'info'}
        class:via-cyan-600={$dialogStore.type === 'info'}
        class:to-[#24B1B1]={$dialogStore.type === 'info'}
      ></div>

      <!-- Close button on top right -->
      <button
        type="button"
        onclick={() => ($dialogStore.onCancel ? $dialogStore.onCancel() : $dialogStore.onConfirm())}
        class="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Tutup dialog"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div class="p-6 sm:p-7 space-y-5">
        <!-- Header with Type Badge and Icon -->
        <div class="flex items-start gap-4">
          <!-- Icon Container -->
          {#if $dialogStore.type === 'success'}
            <div class="w-13 h-13 sm:w-14 sm:h-14 shrink-0 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-600 flex items-center justify-center shadow-sm">
              <svg class="w-7 h-7 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          {:else if $dialogStore.type === 'error' || $dialogStore.isDanger}
            <div class="w-13 h-13 sm:w-14 sm:h-14 shrink-0 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-600 flex items-center justify-center shadow-sm">
              <svg class="w-7 h-7 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          {:else if $dialogStore.type === 'confirm'}
            <div class="w-13 h-13 sm:w-14 sm:h-14 shrink-0 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center shadow-sm">
              <svg class="w-7 h-7 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          {:else}
            <div class="w-13 h-13 sm:w-14 sm:h-14 shrink-0 rounded-2xl bg-teal-50 border border-teal-200/80 text-[#007979] flex items-center justify-center shadow-sm">
              <svg class="w-7 h-7 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          {/if}

          <!-- Text Details -->
          <div class="flex-1 min-w-0 pr-6">
            <div class="flex items-center gap-2 mb-1">
              <span
                class="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border"
                class:bg-emerald-50={!$dialogStore.isDanger && $dialogStore.type === 'success'}
                class:text-emerald-700={!$dialogStore.isDanger && $dialogStore.type === 'success'}
                class:border-emerald-200={!$dialogStore.isDanger && $dialogStore.type === 'success'}
                class:bg-rose-50={$dialogStore.isDanger || $dialogStore.type === 'error'}
                class:text-rose-700={$dialogStore.isDanger || $dialogStore.type === 'error'}
                class:border-rose-200={$dialogStore.isDanger || $dialogStore.type === 'error'}
                class:bg-amber-50={!$dialogStore.isDanger && $dialogStore.type === 'confirm'}
                class:text-amber-700={!$dialogStore.isDanger && $dialogStore.type === 'confirm'}
                class:border-amber-200={!$dialogStore.isDanger && $dialogStore.type === 'confirm'}
                class:bg-teal-50={$dialogStore.type === 'info'}
                class:text-teal-700={$dialogStore.type === 'info'}
                class:border-teal-200={$dialogStore.type === 'info'}
              >
                {$dialogStore.badge}
              </span>
            </div>
            <h2 class="text-[18px] sm:text-[20px] font-bold text-[#172020] tracking-tight leading-snug">
              {$dialogStore.title}
            </h2>
            <p class="mt-2 text-[14px] text-[#55605F] leading-relaxed whitespace-pre-wrap">
              {$dialogStore.message}
            </p>
          </div>
        </div>

        <!-- Optional Error Details Box -->
        {#if $dialogStore.details}
          <div class="mt-2">
            <button
              type="button"
              onclick={() => showDetails = !showDetails}
              class="text-[12px] font-medium text-[#007979] hover:underline flex items-center gap-1"
            >
              <span>{showDetails ? 'Sembunyikan Rincian Teknis' : 'Tampilkan Rincian Teknis'}</span>
              <span class="text-[10px]">{showDetails ? '▲' : '▼'}</span>
            </button>
            {#if showDetails}
              <div class="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-[12px] font-mono text-gray-700 max-h-40 overflow-y-auto whitespace-pre-wrap">
                {$dialogStore.details}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Action Buttons -->
        <div class="pt-3 border-t border-[#E8ECE9] flex items-center justify-end gap-2.5">
          {#if $dialogStore.type === 'confirm'}
            <button
              type="button"
              onclick={$dialogStore.onCancel}
              class="px-4 py-2.5 rounded-xl border border-[#DCE2DF] text-[#66706F] hover:bg-[#F2FBFB] hover:text-[#172020] text-[13px] font-medium transition-all"
            >
              {$dialogStore.cancelText || 'Batal'}
            </button>
            <button
              type="button"
              onclick={$dialogStore.onConfirm}
              class="px-5 py-2.5 rounded-xl text-white text-[13px] font-semibold shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
              class:bg-gradient-to-r={$dialogStore.isDanger}
              class:from-red-600={$dialogStore.isDanger}
              class:to-rose-600={$dialogStore.isDanger}
              class:hover:from-red-700={$dialogStore.isDanger}
              class:hover:to-rose-700={$dialogStore.isDanger}
              class:bg-[#E37434]={!$dialogStore.isDanger}
              class:hover:bg-[#c96227]={!$dialogStore.isDanger}
            >
              {$dialogStore.confirmText || 'Ya, Lanjutkan'}
            </button>
          {:else}
            <button
              type="button"
              onclick={$dialogStore.onConfirm}
              class="px-5 py-2.5 rounded-xl text-white text-[13px] font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
              class:bg-emerald-600={$dialogStore.type === 'success'}
              class:hover:bg-emerald-700={$dialogStore.type === 'success'}
              class:bg-rose-600={$dialogStore.type === 'error'}
              class:hover:bg-rose-700={$dialogStore.type === 'error'}
              class:bg-[#007979]={$dialogStore.type === 'info'}
              class:hover:bg-[#006262]={$dialogStore.type === 'info'}
            >
              {$dialogStore.buttonText || 'OK, Mengerti'}
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
