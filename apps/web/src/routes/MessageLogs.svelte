<script>
  import { onMount } from 'svelte';
  import { apiFetch } from '../lib/api/client.js';
  import MessageTimeline from '../lib/components/MessageTimeline.svelte';

  // Svelte 5 State Runes
  let messages = $state([]);
  let nextCursor = $state(null);
  let loading = $state(true);
  let error = $state(null);
  let searchQuery = $state('');
  let statusFilter = $state('');
  let selectedMessage = $state(null);
  let loadingDetail = $state(false);

  async function loadMessages(cursor = null) {
    loading = true;
    error = null;
    try {
      let url = '/api/messages?limit=25';
      if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const res = await apiFetch(url);
      if (cursor) {
        messages = [...messages, ...(res.items || [])];
      } else {
        messages = res.items || [];
      }
      nextCursor = res.nextCursor;
    } catch (err) {
      error = err.message || 'Gagal memuat log pesan';
    } finally {
      loading = false;
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    loadMessages();
  }

  function handleStatusChange() {
    loadMessages();
  }

  function resetFilters() {
    searchQuery = '';
    statusFilter = '';
    loadMessages();
  }

  async function openDetail(messageId) {
    loadingDetail = true;
    selectedMessage = null;
    try {
      const res = await apiFetch(`/api/messages/${messageId}`);
      selectedMessage = res.data;
    } catch (err) {
      alert('Gagal memuat detail pesan: ' + err.message);
    } finally {
      loadingDetail = false;
    }
  }

  function downloadCsv() {
    window.open('/api/reports/messages/csv', '_blank');
  }

  function getStatusStyle(status) {
    switch (status) {
      case 'read': return 'bg-[#24B1B1]/20 text-[#007979] border-[#24B1B1]/40';
      case 'delivered': return 'bg-[#007979]/15 text-[#007979] border-[#007979]/30';
      case 'sent': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'sending': return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'queued': return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'failed': return 'bg-[#FEF3F2] text-[#B42318] border-[#B42318]/30';
      case 'suppressed': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'cancelled': return 'bg-gray-100 text-gray-500 border-gray-300';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  }

  function formatTime(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleString('id-ID', {
      timeZone: 'Asia/Makassar',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' WITA';
  }

  onMount(() => {
    loadMessages();
  });
</script>

<div class="space-y-6">
  <!-- Top Banner & Actions -->
  <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white rounded-xl p-5 shadow-sm border border-[#DCE2DF]">
    <div class="flex flex-col gap-1.5 max-w-3xl">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="px-2 py-0.5 rounded bg-[#007979]/10 text-[#007979] text-[12px] font-semibold">Audit Jejak Siaran</span>
        <span class="px-2 py-0.5 rounded bg-[#ecf6f5] text-[#007979] text-[12px] font-mono">Privasi UU PDP Terlindungi</span>
        <span class="inline-flex items-center gap-1 text-[#24B1B1] text-[12px] font-medium">
          <span class="w-2 h-2 rounded-full bg-[#24B1B1] animate-pulse"></span>
          Sinkronisasi Webhook Meta Aktif
        </span>
      </div>
      <h1 class="text-[26px] font-bold text-[#172020] tracking-tight">Log & Jejak Pengiriman Pesan</h1>
      <p class="text-[14px] text-[#66706F] leading-relaxed">
        Pemeriksaan riwayat pengiriman siaran WhatsApp secara granular, penelusuran status penerimaan Meta Cloud API, dan investigasi alasan kegagalan pesan.
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2.5">
      <button
        onclick={downloadCsv}
        class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white hover:bg-[#ecf6f5] text-[#172020] text-[13px] font-medium border border-[#DCE2DF] shadow-sm transition-colors"
        type="button"
      >
        <span>📥</span>
        <span>Ekspor CSV (Aman)</span>
      </button>
      <button
        onclick={() => loadMessages()}
        class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#f2fbfb] hover:bg-[#e0eae9] text-[#007979] text-[13px] font-medium border border-[#DCE2DF] transition-colors"
        type="button"
      >
        <span>🔄</span>
        <span>Segarkan</span>
      </button>
    </div>
  </div>

  <!-- Search & Filter Controls -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#DCE2DF]">
    <form onsubmit={handleSearch} class="flex items-center gap-2 flex-1 max-w-md">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Cari penerima, nama, atau ID Meta..."
        class="w-full px-3 py-1.5 rounded-lg bg-[#f2fbfb] border border-[#DCE2DF] text-[13px] text-[#172020] focus:outline-none focus:border-[#E37434]"
      />
      <button
        type="submit"
        class="px-3.5 py-1.5 rounded-lg bg-[#007979] text-white text-[13px] font-medium hover:bg-[#006a6a]"
      >
        Cari
      </button>
    </form>

    <div class="flex items-center gap-2">
      <select
        bind:value={statusFilter}
        onchange={handleStatusChange}
        class="px-3 py-1.5 rounded-lg bg-[#f2fbfb] border border-[#DCE2DF] text-[13px] text-[#172020] focus:outline-none focus:border-[#E37434]"
      >
        <option value="">Semua Status</option>
        <option value="read">Dibaca (Read)</option>
        <option value="delivered">Terkirim (Delivered)</option>
        <option value="sent">Diterima Meta (Sent)</option>
        <option value="failed">Gagal (Failed)</option>
        <option value="queued">Dalam Antrean (Queued)</option>
        <option value="suppressed">Ditekan (Opt-Out)</option>
      </select>
      <button
        onclick={resetFilters}
        class="p-2 border border-[#DCE2DF] rounded-lg text-[#66706F] hover:bg-[#ecf6f5]"
        title="Reset filter"
        type="button"
      >
        ↺
      </button>
    </div>
  </div>

  <!-- Messages Table -->
  <div class="bg-white rounded-xl border border-[#DCE2DF] shadow-sm overflow-hidden flex flex-col">
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-[#f2fbfb] border-b border-[#DCE2DF] text-[#66706F] text-[11px] uppercase tracking-wider font-semibold">
            <th class="py-3 px-4 w-[220px]">Penerima & Kontak</th>
            <th class="py-3 px-4 w-[180px]">Template Meta</th>
            <th class="py-3 px-4 w-[140px] text-center">Status</th>
            <th class="py-3 px-4 w-[110px] text-center">Percobaan</th>
            <th class="py-3 px-4 w-[180px]">Waktu Pengiriman</th>
            <th class="py-3 px-4 text-right w-[110px]">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#DCE2DF] text-[13px] text-[#172020]">
          {#if loading && messages.length === 0}
            <tr>
              <td colspan="6" class="py-8 text-center text-[#66706F]">Memuat log pesan...</td>
            </tr>
          {:else if messages.length === 0}
            <tr>
              <td colspan="6" class="py-8 text-center text-[#66706F]">Tidak ada pesan yang ditemukan.</td>
            </tr>
          {:else}
            {#each messages as msg}
              <tr class="hover:bg-[#ecf6f5]/40 transition-colors">
                <td class="py-3 px-4">
                  <div class="flex flex-col">
                    <span class="font-bold text-[#172020]">{msg.contact_name || 'Tanpa Nama'}</span>
                    <span class="font-mono text-[12px] text-[#007979]">{msg.phone_e164}</span>
                    <span class="text-[10px] text-[#66706F] uppercase tracking-wider">{msg.contact_type}</span>
                  </div>
                </td>
                <td class="py-3 px-4">
                  <span class="font-mono text-[12px] text-[#172020] block">{msg.template_name || '—'}</span>
                  {#if msg.campaign_title}
                    <span class="text-[11px] text-[#66706F] truncate block max-w-[160px]">{msg.campaign_title}</span>
                  {/if}
                </td>
                <td class="py-3 px-4 text-center">
                  <span class="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border {getStatusStyle(msg.status)}">
                    {msg.status}
                  </span>
                </td>
                <td class="py-3 px-4 text-center font-mono text-[12px]">
                  {msg.attempt_count || 1}x
                </td>
                <td class="py-3 px-4 font-mono text-[12px] text-[#66706F]">
                  {formatTime(msg.created_at)}
                </td>
                <td class="py-3 px-4 text-right">
                  <button
                    onclick={() => openDetail(msg.id)}
                    class="px-2.5 py-1 rounded bg-[#ecf6f5] hover:bg-[#dbe4e4] text-[#007979] text-[12px] font-medium border border-[#DCE2DF]"
                    type="button"
                  >
                    Detail
                  </button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Pagination load more -->
    {#if nextCursor}
      <div class="p-3 bg-[#f2fbfb] border-t border-[#DCE2DF] text-center">
        <button
          onclick={() => loadMessages(nextCursor)}
          disabled={loading}
          class="px-4 py-1.5 rounded-lg bg-white border border-[#DCE2DF] text-[13px] text-[#007979] font-medium hover:bg-[#ecf6f5]"
          type="button"
        >
          {loading ? 'Memuat...' : 'Muat Pesan Sebelumnya'}
        </button>
      </div>
    {/if}
  </div>
</div>

<!-- Modal Detail Pesan & Timeline -->
{#if selectedMessage}
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl border border-[#DCE2DF] space-y-5 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between border-b border-[#DCE2DF] pb-3">
        <div>
          <h3 class="text-[16px] font-bold text-[#172020]">Detail Jejak Pesan</h3>
          <span class="font-mono text-[11px] text-[#66706F]">ID: {selectedMessage.id}</span>
        </div>
        <button
          onclick={() => selectedMessage = null}
          class="text-[#66706F] hover:text-[#172020] text-[18px] font-bold"
          type="button"
        >
          ✕
        </button>
      </div>

      <!-- Info Grid -->
      <div class="grid grid-cols-2 gap-3 text-[13px] bg-[#f2fbfb] p-3 rounded-lg border border-[#DCE2DF]">
        <div>
          <span class="text-[#66706F] block text-[11px]">Nama Kontak:</span>
          <span class="font-medium text-[#172020]">{selectedMessage.contact_name}</span>
        </div>
        <div>
          <span class="text-[#66706F] block text-[11px]">Nomor WhatsApp:</span>
          <span class="font-mono text-[#007979] font-semibold">{selectedMessage.phone_e164}</span>
        </div>
        <div>
          <span class="text-[#66706F] block text-[11px]">Template:</span>
          <span class="font-mono text-[#172020]">{selectedMessage.template_name}</span>
        </div>
        <div>
          <span class="text-[#66706F] block text-[11px]">Status Terkini:</span>
          <span class="font-bold text-[#007979] uppercase">{selectedMessage.status}</span>
        </div>
        {#if selectedMessage.meta_message_id}
          <div class="col-span-2">
            <span class="text-[#66706F] block text-[11px]">ID Pesan Meta WABA:</span>
            <span class="font-mono text-[11px] text-[#172020] break-all">{selectedMessage.meta_message_id}</span>
          </div>
        {/if}
        {#if selectedMessage.last_error_message}
          <div class="col-span-2 p-2 bg-[#FEF3F2] border border-[#B42318]/30 rounded text-[#B42318] text-[12px]">
            <strong>Error:</strong> [{selectedMessage.last_error_code}] {selectedMessage.last_error_message}
          </div>
        {/if}
      </div>

      <!-- Chronological Events Timeline -->
      <div class="space-y-2">
        <h4 class="text-[13px] font-bold text-[#172020]">Kronologi Perubahan Status</h4>
        <MessageTimeline events={selectedMessage.statusEvents || []} />
      </div>

      <div class="flex justify-end pt-3 border-t border-[#DCE2DF]">
        <button
          onclick={() => selectedMessage = null}
          class="px-4 py-2 bg-[#ecf6f5] hover:bg-[#dbe4e4] text-[#007979] rounded-lg text-[13px] font-medium"
          type="button"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
{/if}
