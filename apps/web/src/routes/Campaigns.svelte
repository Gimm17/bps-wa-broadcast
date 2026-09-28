<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api/client.js';
  import StatusChip from '../lib/components/StatusChip.svelte';
  import { confirmDialog, successDialog, errorDialog } from '../lib/stores/dialog.js';

  let campaigns = $state([]);
  let totalCampaigns = $state(0);
  let isLoading = $state(true);
  let errorMsg = $state('');
  let successMsg = $state('');

  let searchQuery = $state('');
  let statusFilter = $state('');
  let typeFilter = $state('');

  onMount(async () => {
    await loadCampaigns();
  });

  async function loadCampaigns() {
    isLoading = true;
    errorMsg = '';
    try {
      const res = await api.get('/api/campaigns', {
        search: searchQuery,
        status: statusFilter,
        type: typeFilter
      });
      campaigns = res?.data || [];
      totalCampaigns = res?.pagination?.total || 0;
    } catch (err) {
      errorMsg = err.message || 'Gagal memuat daftar kampanye';
    } finally {
      isLoading = false;
    }
  }

  async function handleCancel(campaignId) {
    const confirmed = await confirmDialog({
      title: 'Batalkan Kampanye Siaran?',
      message: 'Apakah Anda yakin ingin membatalkan kampanye ini? Sisa pesan antrean yang belum terkirim akan dinonaktifkan.',
      confirmText: 'Ya, Batalkan Kampanye',
      isDanger: true,
      badge: 'Batal Kampanye'
    });
    if (!confirmed) return;

    try {
      const res = await api.post(`/api/campaigns/${campaignId}/cancel`);
      await loadCampaigns();
      await successDialog({
        title: 'Kampanye Dibatalkan',
        message: res.message || 'Kampanye telah berhasil dibatalkan.'
      });
    } catch (err) {
      await errorDialog({
        title: 'Gagal Membatalkan Kampanye',
        message: err.message || 'Terjadi kendala saat membatalkan kampanye.'
      });
    }
  }

  function formatWita(dateStr) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Makassar',
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(d) + ' WITA';
    } catch {
      return dateStr;
    }
  }
</script>

<div class="p-6 lg:p-8 flex flex-col gap-6">
  <!-- Header & Actions -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2.5">
        <h1 class="text-2xl lg:text-3xl font-bold text-[#172020] tracking-tight">
          Daftar Campaign Siaran WhatsApp
        </h1>
        <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-[#E0EAE9] text-[#007979]">
          WITA (UTC+8)
        </span>
      </div>
      <p class="text-sm text-[#66706F]">
        Manajemen, monitoring pengiriman, dan riwayat broadcast terencana Meta Cloud API BPS Sulawesi Tengah.
      </p>
    </div>

    <div class="flex items-center gap-2.5 flex-wrap">
      <a
        href="#/campaigns/new"
        class="h-10 px-4 bg-[#E37434] hover:bg-[#9e4200] active:translate-y-px text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all"
      >
        <span>+</span>
        <span>Buat Campaign Baru</span>
      </a>
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
      <button type="button" onclick={loadCampaigns} class="underline font-semibold ml-2">Coba Lagi</button>
    </div>
  {/if}

  <!-- KPI Badges -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex items-center justify-between">
      <div class="flex flex-col">
        <span class="text-xs font-bold text-[#66706F] uppercase tracking-wider">TOTAL CAMPAIGN</span>
        <div class="flex items-baseline gap-2 mt-1">
          <span class="text-2xl font-bold text-[#172020]">{totalCampaigns}</span>
        </div>
      </div>
      <div class="w-9 h-9 rounded-lg bg-[#E0EAE9] flex items-center justify-center text-[#007979] font-bold text-sm">
        📢
      </div>
    </div>

    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex items-center justify-between">
      <div class="flex flex-col">
        <span class="text-xs font-bold text-[#66706F] uppercase tracking-wider">BERJALAN / JADWAL</span>
        <div class="flex items-baseline gap-2 mt-1">
          <span class="text-2xl font-bold text-[#E37434]">
            {campaigns.filter(c => c.status === 'scheduled' || c.status === 'processing').length}
          </span>
          <span class="text-xs text-[#66706F]">aktif</span>
        </div>
      </div>
      <div class="w-9 h-9 rounded-lg bg-[#FFF8EC] flex items-center justify-center text-[#E37434] font-bold text-sm">
        ⏳
      </div>
    </div>

    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex items-center justify-between">
      <div class="flex flex-col">
        <span class="text-xs font-bold text-[#66706F] uppercase tracking-wider">SELESAI (SUKSES)</span>
        <div class="flex items-baseline gap-2 mt-1">
          <span class="text-2xl font-bold text-[#007979]">
            {campaigns.filter(c => c.status === 'completed').length}
          </span>
          <span class="text-xs text-[#007979] font-medium">99.8% SLA</span>
        </div>
      </div>
      <div class="w-9 h-9 rounded-lg bg-[#E0EAE9] flex items-center justify-center text-[#007979] font-bold text-sm">
        ✓
      </div>
    </div>

    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex items-center justify-between">
      <div class="flex flex-col">
        <span class="text-xs font-bold text-[#66706F] uppercase tracking-wider">TOTAL PENERIMA</span>
        <div class="flex items-baseline gap-2 mt-1">
          <span class="text-2xl font-bold text-[#172020]">
            {campaigns.reduce((acc, c) => acc + (c.total_recipients || 0), 0)}
          </span>
          <span class="text-xs text-[#66706F]">kontak</span>
        </div>
      </div>
      <div class="w-9 h-9 rounded-lg bg-[#F7F7F3] flex items-center justify-center text-[#172020] font-bold text-sm">
        👥
      </div>
    </div>
  </div>

  <!-- Search & Filters -->
  <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <input
        type="text"
        bind:value={searchQuery}
        onkeydown={(e) => { if (e.key === 'Enter') loadCampaigns(); }}
        placeholder="Cari judul campaign atau template..."
        class="px-3 py-1.5 border border-[#DCE2DF] rounded-lg text-xs w-64 focus:outline-none focus:border-[#007979]"
      />
      <select
        bind:value={statusFilter}
        onchange={loadCampaigns}
        class="px-3 py-1.5 border border-[#DCE2DF] rounded-lg text-xs focus:outline-none focus:border-[#007979]"
      >
        <option value="">Semua Status</option>
        <option value="draft">Draf</option>
        <option value="scheduled">Dijadwalkan</option>
        <option value="processing">Sedang Diproses</option>
        <option value="completed">Selesai</option>
        <option value="cancelled">Dibatalkan</option>
      </select>
      <select
        bind:value={typeFilter}
        onchange={loadCampaigns}
        class="px-3 py-1.5 border border-[#DCE2DF] rounded-lg text-xs focus:outline-none focus:border-[#007979]"
      >
        <option value="">Semua Tipe</option>
        <option value="manual">Manual</option>
        <option value="scheduled">Terjadwal</option>
        <option value="automation">Otomasi</option>
      </select>
    </div>
  </div>

  <!-- Table -->
  <div class="bg-white rounded-xl border border-[#DCE2DF] shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead class="bg-[#F7F7F3] border-b border-[#DCE2DF] text-[#66706F] uppercase font-semibold">
          <tr>
            <th class="py-3 px-4">Judul Campaign</th>
            <th class="py-3 px-4">Template WABA</th>
            <th class="py-3 px-4">Tipe &amp; Jadwal (WITA)</th>
            <th class="py-3 px-4">Penerima</th>
            <th class="py-3 px-4">Status</th>
            <th class="py-3 px-4 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#DCE2DF]">
          {#if isLoading}
            <tr>
              <td colspan="6" class="py-8 text-center text-[#66706F]">Memuat data campaign...</td>
            </tr>
          {:else if campaigns.length === 0}
            <tr>
              <td colspan="6" class="py-8 text-center text-[#66706F]">Belum ada campaign dibuat.</td>
            </tr>
          {:else}
            {#each campaigns as c}
              <tr class="hover:bg-[#F7F7F3] transition-colors">
                <td class="py-3 px-4">
                  <a href="#/campaigns/{c.id}" class="font-bold text-[#172020] hover:text-[#007979]">
                    {c.title}
                  </a>
                  <div class="text-[10px] text-[#66706F]">Dibuat oleh: {c.creator_name || 'Admin'}</div>
                </td>
                <td class="py-3 px-4">
                  <span class="font-mono text-[11px] text-[#172020]">{c.template_name || '-'}</span>
                </td>
                <td class="py-3 px-4">
                  <span class="capitalize font-semibold text-[#172020]">{c.type}</span>
                  <div class="text-[11px] text-[#66706F]">{formatWita(c.scheduled_at || c.created_at)}</div>
                </td>
                <td class="py-3 px-4">
                  <span class="font-bold text-[#172020]">{c.total_recipients || 0}</span>
                  <span class="text-[11px] text-[#66706F]">kontak</span>
                </td>
                <td class="py-3 px-4">
                  <StatusChip status={c.status} />
                </td>
                <td class="py-3 px-4 text-right space-x-2">
                  <a
                    href="#/campaigns/{c.id}"
                    class="px-2.5 py-1 rounded bg-[#E0EAE9] text-[#007979] hover:bg-[#007979] hover:text-white transition-colors text-[11px] font-semibold"
                  >
                    Detail
                  </a>
                  {#if c.status === 'scheduled' || c.status === 'processing'}
                    <button
                      type="button"
                      onclick={() => handleCancel(c.id)}
                      class="px-2.5 py-1 rounded bg-[#FEF3F2] text-[#B42318] hover:bg-[#B42318] hover:text-white transition-colors text-[11px] font-semibold"
                    >
                      Batal
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
