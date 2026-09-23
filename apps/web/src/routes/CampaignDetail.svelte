<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api/client.js';
  import StatusChip from '../lib/components/StatusChip.svelte';

  let { params = {} } = $props();

  let campaign = $state(null);
  let recipients = $state([]);
  let totalRecipients = $state(0);
  let isLoading = $state(true);
  let isCancelling = $state(false);
  let errorMsg = $state('');
  let successMsg = $state('');

  onMount(async () => {
    await loadCampaignDetails();
  });

  async function loadCampaignDetails() {
    isLoading = true;
    errorMsg = '';
    try {
      const [campRes, recRes] = await Promise.all([
        api.get(`/api/campaigns/${params.id}`),
        api.get(`/api/campaigns/${params.id}/recipients?limit=50`)
      ]);
      campaign = campRes?.campaign || null;
      recipients = recRes?.data || [];
      totalRecipients = recRes?.pagination?.total || 0;
    } catch (err) {
      errorMsg = err.message || 'Gagal memuat detail campaign';
    } finally {
      isLoading = false;
    }
  }

  async function handleCancel() {
    if (!confirm('Apakah Anda yakin ingin membatalkan campaign ini?')) return;
    isCancelling = true;
    try {
      const res = await api.post(`/api/campaigns/${params.id}/cancel`);
      successMsg = res.message || 'Campaign berhasil dibatalkan';
      await loadCampaignDetails();
    } catch (err) {
      errorMsg = err.message || 'Gagal membatalkan campaign';
    } finally {
      isCancelling = false;
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

<div class="p-6 lg:p-8 flex flex-col gap-6 max-w-5xl mx-auto">
  <!-- Top Navigation -->
  <div class="flex items-center justify-between pb-4 border-b border-[#DCE2DF]">
    <div class="flex items-center gap-3">
      <a href="#/campaigns" class="px-3 py-1.5 rounded-lg border border-[#DCE2DF] text-xs font-semibold hover:bg-gray-50">
        ← Kembali
      </a>
      <div>
        <h1 class="text-xl font-bold text-[#172020]">{campaign?.title || 'Detail Campaign'}</h1>
        <span class="text-xs text-[#66706F]">ID: {params.id}</span>
      </div>
    </div>

    {#if campaign?.status === 'scheduled' || campaign?.status === 'processing'}
      <button
        type="button"
        onclick={handleCancel}
        disabled={isCancelling}
        class="px-4 py-2 rounded-lg bg-[#FEF3F2] text-[#B42318] hover:bg-[#B42318] hover:text-white transition-colors text-xs font-bold disabled:opacity-50"
      >
        {isCancelling ? 'Membatalkan...' : 'Batalkan Campaign'}
      </button>
    {/if}
  </div>

  {#if successMsg}
    <div class="p-3 bg-[#E0EAE9] text-[#007979] rounded-xl text-xs flex items-center justify-between">
      <span>✓ {successMsg}</span>
      <button type="button" onclick={() => { successMsg = ''; }}>✕</button>
    </div>
  {/if}

  {#if errorMsg}
    <div class="p-3 bg-[#FEF3F2] border border-[#ffdad6] text-[#B42318] rounded-xl text-xs flex items-center justify-between">
      <span>⚠ {errorMsg}</span>
      <button type="button" onclick={loadCampaignDetails}>✕</button>
    </div>
  {/if}

  {#if isLoading}
    <div class="p-12 text-center text-[#66706F]">
      <div class="w-8 h-8 border-3 border-[#007979] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
      <p class="text-xs">Memuat data detail campaign...</p>
    </div>
  {:else if campaign}
    <!-- Funnel Strip -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <div class="bg-white p-3.5 rounded-xl border border-[#DCE2DF] text-center shadow-sm">
        <span class="text-[10px] uppercase font-bold text-[#66706F]">TOTAL AUDIENS</span>
        <div class="text-xl font-bold text-[#172020] mt-1">{campaign.total_recipients || 0}</div>
      </div>
      <div class="bg-white p-3.5 rounded-xl border border-[#DCE2DF] text-center shadow-sm">
        <span class="text-[10px] uppercase font-bold text-[#66706F]">TERKIRIM (SENT)</span>
        <div class="text-xl font-bold text-[#007979] mt-1">{campaign.sent_count || 0}</div>
      </div>
      <div class="bg-white p-3.5 rounded-xl border border-[#DCE2DF] text-center shadow-sm">
        <span class="text-[10px] uppercase font-bold text-[#66706F]">DITERIMA (DELIVERED)</span>
        <div class="text-xl font-bold text-[#24B1B1] mt-1">{campaign.delivered_count || 0}</div>
      </div>
      <div class="bg-white p-3.5 rounded-xl border border-[#DCE2DF] text-center shadow-sm">
        <span class="text-[10px] uppercase font-bold text-[#66706F]">DIBACA (READ)</span>
        <div class="text-xl font-bold text-blue-600 mt-1">{campaign.read_count || 0}</div>
      </div>
      <div class="bg-white p-3.5 rounded-xl border border-[#DCE2DF] text-center shadow-sm">
        <span class="text-[10px] uppercase font-bold text-[#66706F]">GAGAL / SUPRESI</span>
        <div class="text-xl font-bold text-[#ba1a1a] mt-1">{campaign.failed_count || 0}</div>
      </div>
    </div>

    <!-- Campaign Details Card -->
    <div class="bg-white rounded-2xl border border-[#DCE2DF] p-6 shadow-sm space-y-4 text-xs">
      <div class="flex items-center justify-between border-b border-[#DCE2DF] pb-3">
        <h2 class="text-sm font-bold text-[#172020]">Informasi Siaran</h2>
        <StatusChip status={campaign.status} />
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <span class="text-[#66706F] block">Template Meta WABA:</span>
          <strong class="font-mono text-[#172020]">{campaign.template_name || '-'}</strong>
        </div>
        <div>
          <span class="text-[#66706F] block">Tipe Pengiriman:</span>
          <strong class="capitalize text-[#172020]">{campaign.type}</strong>
        </div>
        <div>
          <span class="text-[#66706F] block">Waktu Terjadwal:</span>
          <span class="text-[#172020]">{formatWita(campaign.scheduled_at)}</span>
        </div>
        <div>
          <span class="text-[#66706F] block">Waktu Selesai:</span>
          <span class="text-[#172020]">{formatWita(campaign.completed_at)}</span>
        </div>
      </div>
    </div>

    <!-- Recipients Table -->
    <div class="bg-white rounded-2xl border border-[#DCE2DF] shadow-sm overflow-hidden">
      <div class="p-4 border-b border-[#DCE2DF]">
        <h3 class="text-sm font-bold text-[#172020]">Daftar Penerima Snapshot ({totalRecipients})</h3>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-[#F7F7F3] border-b border-[#DCE2DF] text-[#66706F] uppercase font-semibold">
            <tr>
              <th class="py-3 px-4">Nama Kontak</th>
              <th class="py-3 px-4">Nomor WhatsApp</th>
              <th class="py-3 px-4">Tipe</th>
              <th class="py-3 px-4">Status Kelayakan</th>
              <th class="py-3 px-4">Alasan Pengecualian</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#DCE2DF]">
            {#if recipients.length === 0}
              <tr>
                <td colspan="5" class="py-6 text-center text-[#66706F]">Belum ada daftar audiens diekspansi.</td>
              </tr>
            {:else}
              {#each recipients as r}
                <tr class="hover:bg-[#F7F7F3] transition-colors">
                  <td class="py-3 px-4 font-semibold text-[#172020]">{r.contact_name}</td>
                  <td class="py-3 px-4 font-mono text-[#66706F]">{r.phone_e164}</td>
                  <td class="py-3 px-4 uppercase text-[11px]">{r.contact_type}</td>
                  <td class="py-3 px-4">
                    <span class="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold {r.status === 'eligible' ? 'bg-[#E0EAE9] text-[#007979]' : 'bg-[#FEF3F2] text-[#B42318]'}">
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-[#66706F]">{r.exclusion_reason || '-'}</td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
