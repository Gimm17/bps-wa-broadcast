<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api/client.js';
  import StatusChip from '../lib/components/StatusChip.svelte';

  let activeTab = $state('subscriptions'); // 'subscriptions' | 'topics' | 'ledger'
  let subscriptions = $state([]);
  let topics = $state([]);
  let consentEvents = $state([]);
  let totalSubs = $state(0);
  let isLoading = $state(true);
  let errorMsg = $state('');

  // Selected ledger event for modal
  let selectedEvent = $state(null);

  // Search & filter
  let searchQuery = $state('');
  let statusFilter = $state('');

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    isLoading = true;
    errorMsg = '';
    try {
      const [subsRes, topicsRes, eventsRes] = await Promise.all([
        api.get('/api/subscriptions', { search: searchQuery, status: statusFilter }),
        api.get('/api/subscriptions/admin/topics'),
        api.get('/api/subscriptions/events')
      ]);

      subscriptions = subsRes?.data || [];
      totalSubs = subsRes?.pagination?.total || 0;
      topics = topicsRes?.topics || [];
      consentEvents = eventsRes?.events || [];
    } catch (err) {
      errorMsg = err.message || 'Gagal memuat data langganan';
    } finally {
      isLoading = false;
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

  function getActiveSubsCount() {
    return subscriptions.filter(s => s.status === 'active').length;
  }

  function getOptOutCount() {
    return subscriptions.filter(s => s.status === 'unsubscribed').length;
  }
</script>

<div class="p-6 lg:p-8 flex flex-col gap-6">
  <!-- Header -->
  <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
    <div class="flex flex-col gap-1.5 max-w-3xl">
      <div class="flex flex-wrap items-center gap-2.5">
        <h1 class="text-2xl lg:text-3xl font-bold text-[#172020] tracking-tight">
          Manajemen Langganan &amp; Konsensus UU PDP
        </h1>
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E0EAE9] text-[#007979] text-xs font-semibold">
          ✓ UU PDP No. 27/2022 Terverifikasi
        </span>
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-gray-100 text-[#66706F]">
          WITA (UTC+8)
        </span>
      </div>
      <p class="text-sm text-[#66706F]">
        Pengelolaan topik siaran statistik resmi, pemantauan status opt-in/opt-out publik, dan buku besar digital (chronological consent ledger) kepatuhan perlindungan data pribadi BPS Provinsi Sulawesi Tengah.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2.5">
      <a
        href="#/subscribe"
        target="_blank"
        class="px-4 py-2 rounded-lg text-xs font-semibold bg-[#E37434] text-white hover:bg-[#9e4200] transition-colors shadow-sm flex items-center gap-1.5"
      >
        <span>Buka Portal Publik</span>
        <span>↗</span>
      </a>
    </div>
  </div>

  {#if errorMsg}
    <div class="p-3 bg-[#FEF3F2] border border-[#ffdad6] text-[#B42318] rounded-xl text-xs flex items-center justify-between">
      <span>⚠ {errorMsg}</span>
      <button type="button" onclick={loadData} class="underline font-semibold ml-2">Coba Lagi</button>
    </div>
  {/if}

  <!-- KPI Cards -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-col justify-between">
      <span class="text-xs font-bold text-[#66706F] uppercase tracking-wider">TOTAL SUBSCRIPTION</span>
      <div class="flex items-baseline gap-2 mt-2">
        <span class="text-2xl font-bold text-[#172020]">{totalSubs}</span>
        <span class="text-xs text-[#007979] font-medium">{getActiveSubsCount()} aktif</span>
      </div>
    </div>

    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-col justify-between">
      <span class="text-xs font-bold text-[#66706F] uppercase tracking-wider">TOPIK SIARAN AKTIF</span>
      <div class="flex items-baseline gap-2 mt-2">
        <span class="text-2xl font-bold text-[#007979]">{topics.length}</span>
        <span class="text-xs text-[#66706F]">katalog resmi</span>
      </div>
    </div>

    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-col justify-between">
      <span class="text-xs font-bold text-[#66706F] uppercase tracking-wider">SUPRESI / OPT-OUT</span>
      <div class="flex items-baseline gap-2 mt-2">
        <span class="text-2xl font-bold text-[#ba1a1a]">{getOptOutCount()}</span>
        <span class="text-xs text-[#66706F]">otomatis terlindungi</span>
      </div>
    </div>

    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-col justify-between">
      <span class="text-xs font-bold text-[#66706F] uppercase tracking-wider">LEMBAR KONSENSUS PDP</span>
      <div class="flex items-baseline gap-2 mt-2">
        <span class="text-2xl font-bold text-[#24B1B1]">{consentEvents.length}</span>
        <span class="text-xs text-[#007979] font-medium">100% tamper-proof</span>
      </div>
    </div>
  </div>

  <!-- Tabs Navigation -->
  <div class="border-b border-[#DCE2DF] flex items-center gap-6">
    <button
      type="button"
      onclick={() => { activeTab = 'subscriptions'; }}
      class="pb-3 text-sm font-semibold transition-all relative {activeTab === 'subscriptions' ? 'text-[#007979] border-b-2 border-[#007979]' : 'text-[#66706F] hover:text-[#172020]'}"
    >
      Daftar Langganan ({subscriptions.length})
    </button>
    <button
      type="button"
      onclick={() => { activeTab = 'topics'; }}
      class="pb-3 text-sm font-semibold transition-all relative {activeTab === 'topics' ? 'text-[#007979] border-b-2 border-[#007979]' : 'text-[#66706F] hover:text-[#172020]'}"
    >
      Direktori Topik ({topics.length})
    </button>
    <button
      type="button"
      onclick={() => { activeTab = 'ledger'; }}
      class="pb-3 text-sm font-semibold transition-all relative {activeTab === 'ledger' ? 'text-[#007979] border-b-2 border-[#007979]' : 'text-[#66706F] hover:text-[#172020]'}"
    >
      Buku Besar Konsensus UU PDP ({consentEvents.length})
    </button>
  </div>

  <!-- Tab 1: Subscriptions Table -->
  {#if activeTab === 'subscriptions'}
    <div class="bg-white rounded-xl border border-[#DCE2DF] shadow-sm overflow-hidden">
      <div class="p-4 border-b border-[#DCE2DF] flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <input
            type="text"
            bind:value={searchQuery}
            onkeydown={(e) => { if (e.key === 'Enter') loadData(); }}
            placeholder="Cari nama atau nomor kontak..."
            class="px-3 py-1.5 border border-[#DCE2DF] rounded-lg text-xs w-64 focus:outline-none focus:border-[#007979]"
          />
          <select
            bind:value={statusFilter}
            onchange={loadData}
            class="px-3 py-1.5 border border-[#DCE2DF] rounded-lg text-xs focus:outline-none focus:border-[#007979]"
          >
            <option value="">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="unsubscribed">Berhenti</option>
          </select>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-[#F7F7F3] border-b border-[#DCE2DF] text-[#66706F] uppercase font-semibold">
            <tr>
              <th class="py-3 px-4">Kontak</th>
              <th class="py-3 px-4">Topik</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4">Saluran</th>
              <th class="py-3 px-4">Terakhir Diperbarui</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#DCE2DF]">
            {#if isLoading}
              <tr>
                <td colspan="5" class="py-8 text-center text-[#66706F]">Memuat data langganan...</td>
              </tr>
            {:else if subscriptions.length === 0}
              <tr>
                <td colspan="5" class="py-8 text-center text-[#66706F]">Tidak ada data langganan ditemukan.</td>
              </tr>
            {:else}
              {#each subscriptions as sub}
                <tr class="hover:bg-[#F7F7F3] transition-colors">
                  <td class="py-3 px-4">
                    <div class="font-semibold text-[#172020]">{sub.contact_name}</div>
                    <div class="text-[11px] font-mono text-[#66706F]">{sub.phone_e164}</div>
                  </td>
                  <td class="py-3 px-4">
                    <span class="font-medium text-[#172020]">{sub.topic_title || sub.topic_code}</span>
                  </td>
                  <td class="py-3 px-4">
                    <StatusChip status={sub.status} />
                  </td>
                  <td class="py-3 px-4 uppercase font-mono text-[11px] text-[#66706F]">
                    {sub.channel}
                  </td>
                  <td class="py-3 px-4 text-[#66706F]">
                    {formatWita(sub.updated_at)}
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <!-- Tab 2: Topics Directory -->
  {#if activeTab === 'topics'}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each topics as topic}
        <div class="bg-white rounded-xl border border-[#DCE2DF] p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E0EAE9] text-[#007979]">
                {topic.code.toUpperCase()}
              </span>
              <span class="w-2 h-2 rounded-full {topic.is_active ? 'bg-[#24B1B1]' : 'bg-gray-400'}"></span>
            </div>
            <h3 class="text-sm font-bold text-[#172020] mb-1">{topic.title}</h3>
            <p class="text-xs text-[#66706F] leading-relaxed mb-4">{topic.description || 'Tidak ada deskripsi topik.'}</p>
          </div>

          <div class="border-t border-[#DCE2DF] pt-3 flex items-center justify-between text-xs">
            <span class="text-[#66706F]">Pelanggan Aktif:</span>
            <span class="font-bold text-[#007979]">{topic.active_subscribers_count || 0} Kontak</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Tab 3: Consent Ledger (Buku Besar Konsensus) -->
  {#if activeTab === 'ledger'}
    <div class="bg-white rounded-xl border border-[#DCE2DF] shadow-sm overflow-hidden">
      <div class="p-4 bg-[#FFF8EC] border-b border-[#FFE2AF] text-xs text-[#793100]">
        <strong>Buku Besar Kepatuhan UU PDP No. 27/2022:</strong> Setiap peristiwa pendaftaran (opt-in), penarikan izin (opt-out), dan penolakan dicatat secara kronologis tanpa manipulasi (append-only) sebagai bukti forensik kepatuhan hukum perlindungan data pribadi.
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-[#F7F7F3] border-b border-[#DCE2DF] text-[#66706F] uppercase font-semibold">
            <tr>
              <th class="py-3 px-4">Kontak</th>
              <th class="py-3 px-4">Peristiwa (Event)</th>
              <th class="py-3 px-4">Saluran</th>
              <th class="py-3 px-4">Bukti / Keterangan</th>
              <th class="py-3 px-4">Waktu (WITA)</th>
              <th class="py-3 px-4">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#DCE2DF]">
            {#if consentEvents.length === 0}
              <tr>
                <td colspan="6" class="py-8 text-center text-[#66706F]">Belum ada riwayat konsensus tercatat.</td>
              </tr>
            {:else}
              {#each consentEvents as ev}
                <tr class="hover:bg-[#F7F7F3] transition-colors">
                  <td class="py-3 px-4">
                    <div class="font-semibold text-[#172020]">{ev.contact_name}</div>
                    <div class="text-[11px] font-mono text-[#66706F]">{ev.phone_e164}</div>
                  </td>
                  <td class="py-3 px-4">
                    <span class="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold {ev.event_type.includes('opt_out') || ev.event_type.includes('unsubscribe') ? 'bg-[#FEF3F2] text-[#B42318]' : 'bg-[#E0EAE9] text-[#007979]'}">
                      {ev.event_type.toUpperCase()}
                    </span>
                  </td>
                  <td class="py-3 px-4 font-mono uppercase text-[11px] text-[#66706F]">
                    {ev.channel}
                  </td>
                  <td class="py-3 px-4 text-[#172020] max-w-xs truncate">
                    {ev.proof || '-'}
                  </td>
                  <td class="py-3 px-4 text-[#66706F]">
                    {formatWita(ev.created_at)}
                  </td>
                  <td class="py-3 px-4">
                    <button
                      type="button"
                      onclick={() => { selectedEvent = ev; }}
                      class="px-2.5 py-1 rounded bg-[#E0EAE9] text-[#007979] hover:bg-[#007979] hover:text-white transition-colors text-[11px] font-semibold"
                    >
                      Audit
                    </button>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <!-- Consent Event Detail Modal -->
  {#if selectedEvent}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#DCE2DF]">
        <div class="flex items-center justify-between border-b border-[#DCE2DF] pb-4 mb-4">
          <div class="flex items-center gap-2">
            <span class="text-xl">🛡️</span>
            <div>
              <h3 class="font-bold text-sm text-[#172020]">Detail Rekaman Konsensus UU PDP</h3>
              <p class="text-[11px] font-mono text-[#66706F]">ID: {selectedEvent.id}</p>
            </div>
          </div>
          <button
            type="button"
            onclick={() => { selectedEvent = null; }}
            class="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div class="p-3 bg-[#F7F7F3] rounded-xl space-y-1.5">
            <div class="flex justify-between">
              <span class="text-[#66706F]">Subjek Data:</span>
              <strong class="text-[#172020]">{selectedEvent.contact_name}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-[#66706F]">Nomor Telepon:</span>
              <span class="font-mono text-[#172020]">{selectedEvent.phone_e164}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-[#66706F]">Jenis Peristiwa:</span>
              <span class="font-bold text-[#007979] uppercase">{selectedEvent.event_type}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-[#66706F]">Saluran Akuisisi:</span>
              <span class="font-mono uppercase">{selectedEvent.channel}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-[#66706F]">Waktu Pencatatan:</span>
              <span>{formatWita(selectedEvent.created_at)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-[#66706F]">Alamat IP:</span>
              <span class="font-mono">{selectedEvent.ip_address || 'Terekam via Webhook'}</span>
            </div>
          </div>

          <div class="p-3 bg-[#FFF8EC] rounded-xl border border-[#FFE2AF]">
            <span class="font-bold text-[#793100] block mb-1">Bukti Eksplisit Konsensus:</span>
            <p class="text-[#793100] leading-relaxed">{selectedEvent.proof || 'Konfirmasi langsung melalui interaksi pengguna'}</p>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <button
            type="button"
            onclick={() => { selectedEvent = null; }}
            class="px-4 py-2 rounded-lg bg-[#007979] text-white text-xs font-semibold hover:bg-[#006a6a] transition-colors"
          >
            Tutup Rincian
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
