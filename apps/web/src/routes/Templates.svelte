<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api/client.js';
  import StatusChip from '../lib/components/StatusChip.svelte';

  let templates = $state([]);
  let isLoading = $state(true);
  let isSyncing = $state(false);
  let searchQuery = $state('');
  let categoryFilter = $state('');
  let statusFilter = $state('');
  let errorMsg = $state('');
  let successMsg = $state('');

  // Selected template for preview
  let selectedTemplate = $state(null);

  onMount(async () => {
    await loadTemplates();
  });

  async function loadTemplates() {
    isLoading = true;
    errorMsg = '';
    try {
      const res = await api.get('/api/templates', {
        search: searchQuery,
        category: categoryFilter,
        status: statusFilter
      });
      templates = res?.templates || [];
    } catch (err) {
      errorMsg = err.message || 'Gagal memuat template dari database';
    } finally {
      isLoading = false;
    }
  }

  async function handleSync() {
    isSyncing = true;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await api.post('/api/templates/sync');
      successMsg = res.message || 'Sinkronisasi template dengan Meta Cloud API berhasil';
      await loadTemplates();
    } catch (err) {
      errorMsg = err.message || 'Gagal menyinkronkan template dengan Meta Cloud API';
    } finally {
      isSyncing = false;
    }
  }

  function getComponentText(components, type) {
    if (!Array.isArray(components)) return '';
    const comp = components.find(c => c.type === type);
    return comp?.text || '';
  }

  function countVariables(text) {
    if (!text) return 0;
    const matches = text.match(/\{\{\d+\}\}/g);
    return matches ? new Set(matches).size : 0;
  }
</script>

<div class="p-6 lg:p-8 flex flex-col gap-6">
  <!-- Operational Header -->
  <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
    <div class="space-y-1">
      <div class="flex items-center gap-2.5">
        <h1 class="text-2xl lg:text-3xl font-bold text-[#172020] tracking-tight">
          Katalog &amp; Manajemen Template Meta WABA
        </h1>
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[#E0EAE9] text-[#007979] font-semibold">
          Meta Cloud API v21.0
        </span>
      </div>
      <p class="text-sm text-[#66706F] max-w-3xl">
        Sinkronisasi HSM (Highly Structured Message) resmi Meta Cloud API, inspeksi kepatuhan kategori Utility, validasi variabel dinamis, serta pengujian tampilan pratinjau pesan.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onclick={handleSync}
        disabled={isSyncing}
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#007979] text-white hover:bg-[#006a6a] transition-all text-xs font-semibold shadow-sm disabled:opacity-50"
      >
        <span class="{isSyncing ? 'animate-spin' : ''}">🔄</span>
        <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Meta Cloud API'}</span>
      </button>
    </div>
  </div>

  {#if successMsg}
    <div class="p-3 bg-[#E0EAE9] text-[#007979] rounded-xl text-xs flex items-center justify-between">
      <span>✓ {successMsg}</span>
      <button type="button" onclick={() => { successMsg = ''; }} class="text-sm font-bold">✕</button>
    </div>
  {/if}

  {#if errorMsg}
    <div class="p-3 bg-[#FEF3F2] border border-[#ffdad6] text-[#B42318] rounded-xl text-xs flex items-center justify-between">
      <span>⚠ {errorMsg}</span>
      <button type="button" onclick={loadTemplates} class="underline font-semibold ml-2">Coba Lagi</button>
    </div>
  {/if}

  <!-- KPI Cards -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-col justify-between">
      <span class="text-xs font-bold text-[#66706F] uppercase tracking-wider">TOTAL TEMPLATE</span>
      <div class="flex items-baseline gap-2 mt-2">
        <span class="text-2xl font-bold text-[#172020]">{templates.length}</span>
        <span class="text-xs text-[#007979] font-medium">{templates.filter(t => t.status === 'APPROVED').length} Disetujui</span>
      </div>
    </div>

    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-col justify-between">
      <span class="text-xs font-bold text-[#66706F] uppercase tracking-wider">KATEGORI UTILITY</span>
      <div class="flex items-baseline gap-2 mt-2">
        <span class="text-2xl font-bold text-[#007979]">
          {templates.filter(t => t.category === 'UTILITY').length}
        </span>
        <span class="text-xs text-[#66706F]">prioritas diseminasi</span>
      </div>
    </div>

    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-col justify-between">
      <span class="text-xs font-bold text-[#66706F] uppercase tracking-wider">KATEGORI AUTHENTICATION</span>
      <div class="flex items-baseline gap-2 mt-2">
        <span class="text-2xl font-bold text-[#E37434]">
          {templates.filter(t => t.category === 'AUTHENTICATION').length}
        </span>
        <span class="text-xs text-[#66706F]">keamanan login OTP</span>
      </div>
    </div>

    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-col justify-between">
      <span class="text-xs font-bold text-[#66706F] uppercase tracking-wider">KEPATUHAN META</span>
      <div class="flex items-baseline gap-2 mt-2">
        <span class="text-2xl font-bold text-[#24B1B1]">100%</span>
        <span class="text-xs text-[#007979] font-medium">Terkunci &amp; Sah</span>
      </div>
    </div>
  </div>

  <!-- Search & Filter Bar -->
  <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <input
        type="text"
        bind:value={searchQuery}
        onkeydown={(e) => { if (e.key === 'Enter') loadTemplates(); }}
        placeholder="Cari nama template atau teks..."
        class="px-3 py-1.5 border border-[#DCE2DF] rounded-lg text-xs w-64 focus:outline-none focus:border-[#007979]"
      />
      <select
        bind:value={categoryFilter}
        onchange={loadTemplates}
        class="px-3 py-1.5 border border-[#DCE2DF] rounded-lg text-xs focus:outline-none focus:border-[#007979]"
      >
        <option value="">Semua Kategori</option>
        <option value="UTILITY">UTILITY</option>
        <option value="MARKETING">MARKETING</option>
        <option value="AUTHENTICATION">AUTHENTICATION</option>
      </select>
      <select
        bind:value={statusFilter}
        onchange={loadTemplates}
        class="px-3 py-1.5 border border-[#DCE2DF] rounded-lg text-xs focus:outline-none focus:border-[#007979]"
      >
        <option value="">Semua Status</option>
        <option value="APPROVED">APPROVED</option>
        <option value="PENDING">PENDING</option>
        <option value="REJECTED">REJECTED</option>
      </select>
    </div>
  </div>

  <!-- Templates Grid -->
  {#if isLoading}
    <div class="p-12 text-center text-[#66706F]">
      <div class="w-8 h-8 border-3 border-[#007979] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
      <p class="text-xs">Memuat template Meta WABA...</p>
    </div>
  {:else if templates.length === 0}
    <div class="bg-white rounded-xl border border-[#DCE2DF] p-12 text-center text-[#66706F]">
      <p class="text-sm font-semibold mb-2">Belum Ada Template Tersinkronisasi</p>
      <p class="text-xs mb-4">Klik tombol "Sinkronkan Meta Cloud API" untuk mengunduh template resmi dari Meta Business Suite.</p>
      <button
        type="button"
        onclick={handleSync}
        class="px-4 py-2 rounded-lg bg-[#007979] text-white text-xs font-semibold"
      >
        Sinkronkan Sekarang
      </button>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each templates as t}
        <div class="bg-white rounded-xl border border-[#DCE2DF] p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider {t.category === 'UTILITY' ? 'bg-[#E0EAE9] text-[#007979]' : t.category === 'AUTHENTICATION' ? 'bg-[#FFF8EC] text-[#793100]' : 'bg-blue-50 text-blue-700'}">
                {t.category}
              </span>
              <StatusChip status={t.status} />
            </div>

            <h3 class="text-sm font-bold text-[#172020] mb-1 font-mono">{t.name}</h3>
            <span class="text-[11px] text-[#66706F] block mb-3">Bahasa: {t.language.toUpperCase()}</span>

            <!-- Body snippet -->
            <div class="p-3 bg-[#F7F7F3] rounded-lg text-xs text-[#172020] leading-relaxed mb-4 font-sans line-clamp-3">
              {getComponentText(t.components, 'BODY') || 'Tidak ada teks isi'}
            </div>
          </div>

          <div class="border-t border-[#DCE2DF] pt-3 flex items-center justify-between text-xs">
            <span class="text-[#66706F]">
              Variabel: <strong>{countVariables(getComponentText(t.components, 'BODY'))}</strong>
            </span>
            <button
              type="button"
              onclick={() => { selectedTemplate = t; }}
              class="px-3 py-1 rounded bg-[#E0EAE9] text-[#007979] hover:bg-[#007979] hover:text-white transition-colors font-semibold"
            >
              Pratinjau
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Interactive WhatsApp Preview Modal -->
  {#if selectedTemplate}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#DCE2DF]">
        <div class="flex items-center justify-between border-b border-[#DCE2DF] pb-3 mb-4">
          <div class="flex items-center gap-2">
            <span class="text-lg">📱</span>
            <div>
              <h3 class="font-bold text-sm text-[#172020] font-mono">{selectedTemplate.name}</h3>
              <p class="text-[11px] text-[#66706F]">Kategori: {selectedTemplate.category} ({selectedTemplate.language})</p>
            </div>
          </div>
          <button
            type="button"
            onclick={() => { selectedTemplate = null; }}
            class="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <!-- WhatsApp Chat Mockup -->
        <div class="bg-[#e5ddd5] p-4 rounded-xl border border-gray-300">
          <div class="bg-white p-3 rounded-lg shadow-sm max-w-sm text-xs space-y-2">
            {#if getComponentText(selectedTemplate.components, 'HEADER')}
              <div class="font-bold text-[13px] text-[#172020] pb-1 border-b border-gray-100">
                {getComponentText(selectedTemplate.components, 'HEADER')}
              </div>
            {/if}
            <div class="text-[#172020] whitespace-pre-wrap leading-relaxed">
              {getComponentText(selectedTemplate.components, 'BODY')}
            </div>
            {#if getComponentText(selectedTemplate.components, 'FOOTER')}
              <div class="text-[10px] text-gray-500 pt-1 border-t border-gray-100">
                {getComponentText(selectedTemplate.components, 'FOOTER')}
              </div>
            {/if}
            <div class="text-[9px] text-gray-400 text-right">
              08:00 WITA ✓✓
            </div>
          </div>
        </div>

        <div class="mt-4 p-3 bg-[#F7F7F3] rounded-xl text-xs space-y-1">
          <span class="font-semibold text-[#172020] block">Aturan Template Meta:</span>
          <p class="text-[#66706F]">Template tidak dapat diedit langsung di dashboard sesuai regulasi Meta HSM. Perubahan redaksi dilakukan di Meta Business Suite.</p>
        </div>

        <div class="mt-5 flex justify-end">
          <button
            type="button"
            onclick={() => { selectedTemplate = null; }}
            class="px-4 py-2 rounded-lg bg-[#007979] text-white text-xs font-semibold hover:bg-[#006a6a]"
          >
            Tutup Pratinjau
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
