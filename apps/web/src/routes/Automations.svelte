<script>
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { apiFetch } from '../lib/api/client.js';
  import { confirmDialog, successDialog, errorDialog } from '../lib/stores/dialog.js';

  // Svelte 5 State Runes
  let rules = $state([]);
  let loading = $state(true);
  let error = $state(null);
  let filterCategory = $state('all');
  let filterStatus = $state('');
  let searchQuery = $state('');

  // Trigger test modal state
  let selectedRuleForTrigger = $state(null);
  let triggering = $state(false);
  let triggerResult = $state(null);

  async function loadRules() {
    loading = true;
    error = null;
    try {
      const res = await apiFetch('/api/automations');
      rules = res.data || [];
    } catch (err) {
      error = err.message || 'Gagal memuat aturan otomasi';
    } finally {
      loading = false;
    }
  }

  // Filtered rules
  let filteredRules = $derived.by(() => {
    return rules.filter((r) => {
      // Category filter
      if (filterCategory === 'internal' && r.type !== 'attendance_presensi') return false;
      if (filterCategory === 'dissemination' && r.type !== 'publication_reminder') return false;
      if (filterCategory === 'silastik' && r.type !== 'silastik_transaction') return false;
      if (filterCategory === 'event' && r.type !== 'event_reminder' && r.type !== 'custom') return false;

      // Status filter
      if (filterStatus === 'active' && !r.is_active) return false;
      if (filterStatus === 'inactive' && r.is_active) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.name?.toLowerCase().includes(q);
        const matchCode = r.code?.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }

      return true;
    });
  });

  // Telemetry metrics
  let totalRules = $derived(rules.length);
  let activeRules = $derived(rules.filter((r) => r.is_active).length);

  function getCategoryLabel(type) {
    switch (type) {
      case 'attendance_presensi': return 'Internal Pegawai';
      case 'publication_reminder': return 'Diseminasi & Publikasi';
      case 'silastik_transaction': return 'Layanan Silastik';
      case 'event_reminder': return 'Event & Pengingat';
      case 'custom': return 'Kustom Mandiri';
      default: return 'Kustom / Khusus';
    }
  }

  function getScheduleLabel(rule) {
    if (rule.type === 'attendance_presensi') {
      return rule.config?.reminderType === 'out'
        ? 'Hari Kerja • 15:45 WITA'
        : 'Hari Kerja • 07:15 WITA';
    }
    if (rule.type === 'publication_reminder') {
      return 'H-30, H-14, H-7, H-1 • 08:00 WITA';
    }
    if (rule.type === 'silastik_transaction') {
      return 'Real-time Event Ingestion';
    }
    if (rule.type === 'event_reminder' || rule.type === 'custom') {
      const cfg = rule.config || {};
      const timeStr = cfg.eventTime ? `${cfg.eventTime} WITA` : '09:30 WITA';
      if (cfg.scheduleType === 'immediate') return `Hari H • Siaran Segera (${timeStr})`;
      if (cfg.scheduleType === 'recurring') return `Rutin • ${timeStr}`;
      return `${cfg.eventDate || 'Hari H'} • ${timeStr}`;
    }
    return 'Terjadwal Sesuai Aturan';
  }

  async function openTriggerModal(rule) {
    selectedRuleForTrigger = rule;
    triggerResult = null;
  }

  async function executeTestTrigger() {
    if (!selectedRuleForTrigger) return;
    triggering = true;
    triggerResult = null;

    try {
      const res = await apiFetch(`/api/automations/${selectedRuleForTrigger.id}/trigger`, {
        method: 'POST'
      });
      triggerResult = res;
      await loadRules();
    } catch (err) {
      triggerResult = { error: err.message || 'Gagal mengeksekusi pemicu simulasi' };
    } finally {
      triggering = false;
    }
  }

  async function toggleRuleActive(rule) {
    const actionName = rule.is_active ? 'menonaktifkan' : 'mengaktifkan';
    const confirmed = await confirmDialog({
      title: `${rule.is_active ? 'Nonaktifkan' : 'Aktifkan'} Aturan?`,
      message: `Apakah Anda yakin ingin ${actionName} aturan otomasi "${rule.name}" (${rule.code})?`,
      confirmText: rule.is_active ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan',
      isDanger: rule.is_active,
      badge: 'Status Aturan'
    });
    if (!confirmed) return;

    try {
      await apiFetch(`/api/automations/${rule.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !rule.is_active })
      });
      await loadRules();
      await successDialog({
        title: 'Status Berhasil Diperbarui',
        message: `Aturan "${rule.name}" berhasil ${rule.is_active ? 'dinonaktifkan' : 'diaktifkan'}.`
      });
    } catch (err) {
      await errorDialog({
        title: 'Gagal Mengubah Status',
        message: 'Terjadi kendala saat mengubah status aturan otomasi.',
        details: err.message
      });
    }
  }

  async function handleDeleteRule(rule) {
    const confirmed = await confirmDialog({
      title: 'Hapus Aturan Otomasi?',
      message: `Apakah Anda yakin ingin menghapus aturan "${rule.name}" (${rule.code})? Seluruh jadwal pengingat dan pesan otomatisasi terkait aturan ini akan dihapus secara permanen.`,
      confirmText: 'Ya, Hapus Aturan',
      cancelText: 'Batal',
      isDanger: true,
      badge: 'Hapus Aturan'
    });
    if (!confirmed) return;

    try {
      await apiFetch(`/api/automations/${rule.id}`, { method: 'DELETE' });
      await loadRules();
      await successDialog({
        title: 'Aturan Telah Dihapus',
        message: `Aturan otomasi "${rule.name}" berhasil dihapus dari sistem.`
      });
    } catch (err) {
      await errorDialog({
        title: 'Gagal Menghapus Aturan',
        message: err.message || 'Terjadi kesalahan saat menghapus aturan otomasi.'
      });
    }
  }

  onMount(() => {
    loadRules();
  });
</script>

<div class="space-y-6">
  <!-- Top Banner & Actions -->
  <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white rounded-xl p-5 shadow-sm border border-[#DCE2DF]">
    <div class="flex flex-col gap-1.5 max-w-3xl">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="px-2 py-0.5 rounded bg-[#007979]/10 text-[#007979] text-[12px] font-semibold">Engine Otomasi BPS</span>
        <span class="px-2 py-0.5 rounded bg-[#ecf6f5] text-[#007979] text-[12px] font-mono">SIMPEG • Silastik • BRS</span>
        <span class="inline-flex items-center gap-1 text-[#24B1B1] text-[12px] font-medium">
          <span class="w-2 h-2 rounded-full bg-[#24B1B1] animate-pulse"></span>
          Freshness Gate Aktif
        </span>
      </div>
      <h1 class="text-[26px] font-bold text-[#172020] tracking-tight">Katalog Aturan Otomasi & Pemicu Siaran</h1>
      <p class="text-[14px] text-[#66706F] leading-relaxed">
        Pusat kendali logika otomasi siaran WhatsApp berbasis trigger peristiwa SIMPEG Presensi, transaksi Silastik PST, dan peringatan batas waktu rilis publikasi BPS Sulawesi Tengah.
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2.5">
      <button
        onclick={() => push('/automations/new')}
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E37434] hover:bg-[#c96227] text-white text-[13px] font-medium shadow-sm transition-all"
        type="button"
      >
        <span>➕</span>
        <span>Buat Aturan Baru</span>
      </button>
    </div>
  </div>

  <!-- 4 Telemetry Metrics Cards -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="bg-white rounded-xl p-4 shadow-sm border border-[#DCE2DF] flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div class="space-y-1">
          <span class="text-[12px] text-[#66706F] block">Total Aturan Otomasi</span>
          <div class="flex items-baseline gap-2">
            <span class="text-[28px] text-[#172020] font-bold font-mono">{totalRules}</span>
            <span class="text-[12px] text-[#007979] font-medium">{activeRules} Aktif</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-lg bg-[#007979]/10 text-[#007979] flex items-center justify-center font-bold">
          ⚡
        </div>
      </div>
      <div class="mt-4 pt-2.5 flex items-center justify-between text-[11px] text-[#66706F] bg-[#ecf6f5] px-2.5 py-1.5 rounded-lg">
        <span class="text-[#007979] font-medium">Bypass Libur Mandiri</span>
        <span class="font-mono">100% Proteksi</span>
      </div>
    </div>

    <div class="bg-white rounded-xl p-4 shadow-sm border border-[#DCE2DF] flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div class="space-y-1">
          <span class="text-[12px] text-[#66706F] block">Target Presensi ASN</span>
          <div class="flex items-baseline gap-2">
            <span class="text-[28px] text-[#172020] font-bold font-mono">84</span>
            <span class="text-[12px] text-[#66706F]">Pegawai Terdaftar</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-lg bg-[#FFE2AF] text-[#793100] flex items-center justify-center">
          👥
        </div>
      </div>
      <div class="mt-4 pt-2.5 flex items-center justify-between text-[11px] text-[#66706F] bg-[#FFF8EC] px-2.5 py-1.5 rounded-lg">
        <span class="text-[#793100] font-medium">SIMPEG Terhubung</span>
        <span class="font-mono">Maks 30 mnt Fresh</span>
      </div>
    </div>

    <div class="bg-white rounded-xl p-4 shadow-sm border border-[#DCE2DF] flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div class="space-y-1">
          <span class="text-[12px] text-[#66706F] block">Keamanan Deduplikasi</span>
          <div class="flex items-baseline gap-2">
            <span class="text-[28px] text-[#007979] font-bold font-mono">100%</span>
            <span class="text-[12px] text-[#24B1B1] font-medium">Aman</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-lg bg-[#007979]/10 text-[#007979] flex items-center justify-center">
          🔒
        </div>
      </div>
      <div class="mt-4 pt-2.5 flex items-center justify-between text-[11px] text-[#66706F] bg-[#ecf6f5] px-2.5 py-1.5 rounded-lg">
        <span class="text-[#172020] font-medium">Idempotency Key Strict</span>
        <span class="font-mono text-[#66706F]">0 Duplikat</span>
      </div>
    </div>

    <div class="bg-white rounded-xl p-4 shadow-sm border border-[#DCE2DF] flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div class="space-y-1">
          <span class="text-[12px] text-[#66706F] block">Konektor Terhubung</span>
          <div class="flex items-baseline gap-2">
            <span class="text-[28px] text-[#172020] font-bold font-mono">3</span>
            <span class="text-[12px] text-[#24B1B1] font-medium">Sistem</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-lg bg-[#ecf6f5] text-[#007979] flex items-center justify-center">
          🔗
        </div>
      </div>
      <div class="mt-4 pt-2.5 flex items-center justify-between text-[11px] text-[#66706F] bg-[#ecf6f5] px-2.5 py-1.5 rounded-lg">
        <span class="truncate font-medium text-[#172020]">SIMPEG, Silastik, Publikasi</span>
        <span class="font-mono text-[#007979]">Status OK</span>
      </div>
    </div>
  </div>

  <!-- Filters & Search Bar -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#DCE2DF]">
    <!-- Tabs -->
    <div class="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
      <button
        onclick={() => filterCategory = 'all'}
        class="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors {filterCategory === 'all' ? 'bg-[#007979] text-white shadow-sm' : 'bg-[#ecf6f5] text-[#172020] hover:bg-[#dbe4e4]'}"
        type="button"
      >
        Semua Otomasi
      </button>
      <button
        onclick={() => filterCategory = 'internal'}
        class="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors {filterCategory === 'internal' ? 'bg-[#007979] text-white shadow-sm' : 'bg-[#ecf6f5] text-[#172020] hover:bg-[#dbe4e4]'}"
        type="button"
      >
        Internal Pegawai
      </button>
      <button
        onclick={() => filterCategory = 'dissemination'}
        class="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors {filterCategory === 'dissemination' ? 'bg-[#007979] text-white shadow-sm' : 'bg-[#ecf6f5] text-[#172020] hover:bg-[#dbe4e4]'}"
        type="button"
      >
        Diseminasi & Publikasi
      </button>
      <button
        onclick={() => filterCategory = 'silastik'}
        class="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors {filterCategory === 'silastik' ? 'bg-[#007979] text-white shadow-sm' : 'bg-[#ecf6f5] text-[#172020] hover:bg-[#dbe4e4]'}"
        type="button"
      >
        Layanan Silastik
      </button>
      <button
        onclick={() => filterCategory = 'event'}
        class="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors {filterCategory === 'event' ? 'bg-[#007979] text-white shadow-sm' : 'bg-[#ecf6f5] text-[#172020] hover:bg-[#dbe4e4]'}"
        type="button"
      >
        📢 Event &amp; Kustom
      </button>
    </div>

    <!-- Search & Status Select -->
    <div class="flex flex-wrap items-center gap-2.5">
      <div class="relative min-w-[200px]">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Cari nama atau kode..."
          class="w-full px-3 py-1.5 rounded-lg bg-[#f2fbfb] border border-[#DCE2DF] text-[13px] text-[#172020] focus:outline-none focus:border-[#E37434]"
        />
      </div>
      <select
        bind:value={filterStatus}
        class="px-3 py-1.5 rounded-lg bg-[#f2fbfb] border border-[#DCE2DF] text-[13px] text-[#172020] focus:outline-none focus:border-[#E37434]"
      >
        <option value="">Status: Semua</option>
        <option value="active">Hanya Aktif</option>
        <option value="inactive">Nonaktif / Dijeda</option>
      </select>
    </div>
  </div>

  <!-- Automations Table -->
  <div class="bg-white rounded-xl border border-[#DCE2DF] shadow-sm overflow-hidden flex flex-col">
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-[#f2fbfb] border-b border-[#DCE2DF] text-[#66706F] text-[11px] uppercase tracking-wider font-semibold">
            <th class="py-3 px-4 w-[280px]">Nama & Kode Otomasi</th>
            <th class="py-3 px-4 w-[240px]">Trigger & Jadwal (WITA)</th>
            <th class="py-3 px-4 w-[200px]">Kategori & Sumber</th>
            <th class="py-3 px-4 w-[180px]">Template Meta</th>
            <th class="py-3 px-4 text-center w-[110px]">Status</th>
            <th class="py-3 px-4 text-right w-[150px]">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#DCE2DF] text-[13px] text-[#172020]">
          {#if loading}
            <tr>
              <td colspan="6" class="py-8 text-center text-[#66706F]">Memuat katalog aturan otomasi...</td>
            </tr>
          {:else if filteredRules.length === 0}
            <tr>
              <td colspan="6" class="py-8 text-center text-[#66706F]">Belum ada aturan otomasi yang sesuai kriteria.</td>
            </tr>
          {:else}
            {#each filteredRules as rule}
              <tr class="hover:bg-[#ecf6f5]/50 transition-colors">
                <td class="py-3.5 px-4">
                  <div class="flex flex-col gap-0.5">
                    <span class="font-bold text-[#172020] hover:text-[#E37434] transition-colors">{rule.name}</span>
                    <span class="font-mono text-[11px] text-[#66706F]">{rule.code}</span>
                  </div>
                </td>
                <td class="py-3.5 px-4 font-mono text-[12px] text-[#172020]">
                  {getScheduleLabel(rule)}
                </td>
                <td class="py-3.5 px-4">
                  <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#007979]/10 text-[#007979]">
                    {getCategoryLabel(rule.type)}
                  </span>
                </td>
                <td class="py-3.5 px-4 text-[12px]">
                  {#if rule.config?.messageMode === 'custom_text' || (!rule.template_name && rule.config?.customMessage)}
                    <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                      <span>💬</span> Pesan Kustom Bebas
                    </span>
                  {:else}
                    <span class="font-mono text-[#66706F]">{rule.template_name || '—'}</span>
                  {/if}
                </td>
                <td class="py-3.5 px-4 text-center">
                  <button
                    onclick={() => toggleRuleActive(rule)}
                    class="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors {rule.is_active ? 'bg-[#24B1B1]/20 text-[#007979] hover:bg-[#24B1B1]/30' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}"
                    type="button"
                  >
                    {rule.is_active ? 'Aktif' : 'Dijeda'}
                  </button>
                </td>
                <td class="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                  <button
                    onclick={() => openTriggerModal(rule)}
                    class="px-2.5 py-1 rounded bg-[#ecf6f5] hover:bg-[#dbe4e4] text-[#007979] text-[12px] font-medium border border-[#DCE2DF] transition-colors"
                    title="Uji simulasi pemicu"
                    type="button"
                  >
                    Uji Pemicu
                  </button>
                  <button
                    onclick={() => push(`/automations/${rule.id}`)}
                    class="px-2.5 py-1 rounded bg-white hover:bg-[#ecf6f5] text-[#172020] text-[12px] font-medium border border-[#DCE2DF] transition-colors"
                    title="Edit konfigurasi aturan"
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    onclick={() => handleDeleteRule(rule)}
                    class="px-2.5 py-1 rounded bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 text-[12px] font-medium border border-rose-200 transition-colors"
                    title="Hapus aturan otomasi ini"
                    type="button"
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- Modal Uji Pemicu Simulasi -->
{#if selectedRuleForTrigger}
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-[#DCE2DF] space-y-4">
      <div class="flex items-center justify-between border-b border-[#DCE2DF] pb-3">
        <h3 class="text-[16px] font-bold text-[#172020]">Simulasi Uji Pemicu Otomasi</h3>
        <button
          onclick={() => selectedRuleForTrigger = null}
          class="text-[#66706F] hover:text-[#172020] text-[16px] font-bold"
          type="button"
        >
          ✕
        </button>
      </div>

      <div class="space-y-2 text-[13px]">
        <div><strong>Aturan:</strong> {selectedRuleForTrigger.name}</div>
        <div><strong>Kode:</strong> <span class="font-mono">{selectedRuleForTrigger.code}</span></div>
        <div><strong>Tipe:</strong> {getCategoryLabel(selectedRuleForTrigger.type)}</div>
      </div>

      {#if triggerResult}
        {#if triggerResult.error}
          <div class="p-3 bg-[#FEF3F2] rounded-lg border border-[#FECDCA] text-[13px] text-[#B42318] font-medium">
            ❌ Gagal mengeksekusi: {triggerResult.error}
          </div>
        {:else}
          <div class="space-y-2">
            {#if (triggerResult.data?.sent ?? 0) > 0}
              <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800 text-[13px] font-semibold">
                <span class="text-base">🚀</span>
                <span>Pesan Berhasil Terkirim! ({triggerResult.data.sent} pesan langsung dikirim ke WhatsApp via MPWA)</span>
              </div>
            {:else if triggerResult.data?.queued > 0}
              <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800 text-[13px] font-semibold">
                <span class="text-base">⏳</span>
                <span>{triggerResult.data.queued} pesan masuk antrean pengiriman.</span>
              </div>
            {/if}

            <div class="p-3 bg-[#ecf6f5] rounded-lg border border-[#DCE2DF] text-[13px] font-mono space-y-1">
              <div class="text-[#007979] font-bold">Rincian Respon:</div>
              <pre class="text-[12px] overflow-x-auto whitespace-pre-wrap">{JSON.stringify(triggerResult.data, null, 2)}</pre>
            </div>
          </div>
        {/if}
      {/if}

      <div class="flex items-center justify-end gap-3 pt-3 border-t border-[#DCE2DF]">
        <button
          type="button"
          onclick={() => selectedRuleForTrigger = null}
          class="px-4 py-2 border border-[#DCE2DF] rounded-lg text-[13px] text-[#66706F] hover:bg-[#ecf6f5]"
        >
          Tutup
        </button>
        <button
          type="button"
          disabled={triggering}
          onclick={executeTestTrigger}
          class="px-4 py-2 bg-[#E37434] hover:bg-[#c96227] text-white rounded-lg text-[13px] font-medium shadow-sm"
        >
          {triggering ? 'Mengeksekusi...' : 'Eksekusi Simulasi Sekarang'}
        </button>
      </div>
    </div>
  </div>
{/if}
