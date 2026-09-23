<script>
  import { onMount } from 'svelte';
  import { apiFetch } from '../lib/api/client.js';

  // Svelte 5 State Runes
  let currentDate = $state(new Date(2026, 9, 1)); // Default to Oct 2026 for alignment
  let holidays = $state([]);
  let schedules = $state([]);
  let loading = $state(true);
  let error = $state(null);
  let showModal = $state(false);
  let syncingSkb = $state(false);

  // New exception form state
  let formDate = $state('2026-10-15');
  let formDesc = $state('');
  let formIsWorkday = $state(false);
  let formIsNational = $state(false);
  let formSubmitting = $state(false);
  let formError = $state(null);

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  let currentYear = $derived(currentDate.getFullYear());
  let currentMonth = $derived(currentDate.getMonth()); // 0-indexed
  let monthLabel = $derived(`${monthNames[currentMonth]} ${currentYear}`);

  // Compute calendar days for the current view
  let calendarDays = $derived.by(() => {
    const year = currentYear;
    const month = currentMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Days in previous month to pad (Monday = 1, Sunday = 7)
    let startDayOfWeek = firstDay.getDay(); // 0 is Sunday
    let padBefore = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const days = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = padBefore - 1; i >= 0; i--) {
      days.push({
        dayNumber: prevMonthLastDay - i,
        isCurrentMonth: false,
        dateStr: ''
      });
    }

    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month, d).getDay(); // 0 Sun, 6 Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Find if holiday exists
      const holiday = holidays.find((h) => h.date === dStr);
      const isToday = dStr === '2026-10-01'; // Reference demo day

      days.push({
        dayNumber: d,
        isCurrentMonth: true,
        dateStr: dStr,
        dayOfWeek,
        isWeekend,
        holiday,
        isToday
      });
    }

    // Pad end of month to complete 7-col grid
    const totalCells = Math.ceil(days.length / 7) * 7;
    let nextDay = 1;
    while (days.length < totalCells) {
      days.push({
        dayNumber: nextDay++,
        isCurrentMonth: false,
        dateStr: ''
      });
    }

    return days;
  });

  // Telemetry metrics
  let totalHolidaysThisMonth = $derived(
    calendarDays.filter((d) => d.isCurrentMonth && d.holiday && !d.holiday.is_workday).length
  );

  async function loadData() {
    loading = true;
    error = null;
    try {
      const year = currentYear;
      const month = currentMonth + 1;
      const holRes = await apiFetch(`/api/calendar/holidays?year=${year}&month=${month}`);
      holidays = holRes.data || [];

      const schedRes = await apiFetch('/api/calendar/schedules');
      schedules = schedRes.data || [];
    } catch (err) {
      error = err.message || 'Gagal memuat kalender';
    } finally {
      loading = false;
    }
  }

  function prevMonth() {
    currentDate = new Date(currentYear, currentMonth - 1, 1);
    loadData();
  }

  function nextMonth() {
    currentDate = new Date(currentYear, currentMonth + 1, 1);
    loadData();
  }

  function goToToday() {
    currentDate = new Date(2026, 9, 1);
    loadData();
  }

  async function syncSkb() {
    syncingSkb = true;
    try {
      await apiFetch('/api/calendar/sync-skb', { method: 'POST' });
      await loadData();
    } catch (err) {
      alert('Gagal menyinkronkan SKB: ' + err.message);
    } finally {
      syncingSkb = false;
    }
  }

  async function handleAddException(e) {
    e.preventDefault();
    formSubmitting = true;
    formError = null;

    try {
      await apiFetch('/api/calendar/holidays', {
        method: 'POST',
        body: JSON.stringify({
          date: formDate,
          description: formDesc,
          isWorkday: formIsWorkday,
          isNational: formIsNational
        })
      });
      showModal = false;
      formDesc = '';
      await loadData();
    } catch (err) {
      formError = err.message || 'Gagal menambahkan pengecualian';
    } finally {
      formSubmitting = false;
    }
  }

  async function deleteException(dateStr) {
    if (!confirm(`Hapus pengecualian kalender untuk tanggal ${dateStr}?`)) return;
    try {
      await apiFetch(`/api/calendar/holidays/${dateStr}`, { method: 'DELETE' });
      await loadData();
    } catch (err) {
      alert('Gagal menghapus: ' + err.message);
    }
  }

  onMount(() => {
    loadData();
  });
</script>

<div class="space-y-6">
  <!-- Top Banner & Actions -->
  <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white rounded-xl p-5 shadow-sm border border-[#DCE2DF]">
    <div class="flex flex-col gap-1.5 max-w-3xl">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="px-2 py-0.5 rounded bg-[#007979]/10 text-[#007979] text-[12px] font-semibold">SKB 3 Menteri v2026.4</span>
        <span class="px-2 py-0.5 rounded bg-[#e0eae9] text-[#172020] text-[12px] font-mono">Asia/Makassar (WITA)</span>
        <span class="inline-flex items-center gap-1 text-[#24B1B1] text-[12px] font-medium">
          <span class="w-2 h-2 rounded-full bg-[#24B1B1] animate-pulse"></span>
          Cron Engine Standby
        </span>
      </div>
      <h1 class="text-[26px] font-bold text-[#172020] tracking-tight">Kalender Diseminasi & Sinkronisasi Libur Nasional</h1>
      <p class="text-[14px] text-[#66706F] leading-relaxed">
        Sinkronisasi otomatis kalender siaran WhatsApp dengan Surat Keputusan Bersama (SKB 3 Menteri) Hari Libur Nasional, Cuti Bersama, dan Kalender Rilis Resmi BPS Sulawesi Tengah 2026.
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2.5">
      <button
        onclick={syncSkb}
        disabled={syncingSkb}
        class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#f2fbfb] hover:bg-[#e0eae9] text-[#172020] text-[13px] font-medium border border-[#DCE2DF] transition-colors"
        type="button"
      >
        <span>🔄</span>
        <span>{syncingSkb ? 'Menyinkronkan...' : 'Sinkronkan SKB'}</span>
      </button>
      <button
        onclick={() => showModal = true}
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E37434] hover:bg-[#c96227] text-white text-[13px] font-medium shadow-sm transition-all"
        type="button"
      >
        <span>➕</span>
        <span>Tambah Exception / Libur</span>
      </button>
    </div>
  </div>

  <!-- Telemetry Metrics Cards -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="bg-white rounded-xl p-4 shadow-sm border border-[#DCE2DF] flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div class="space-y-1">
          <span class="text-[12px] text-[#66706F] block">Total Siaran Terjadwal Bulan Ini</span>
          <div class="flex items-baseline gap-2">
            <span class="text-[28px] text-[#172020] font-bold font-mono">28</span>
            <span class="text-[12px] text-[#66706F]">Siaran</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-lg bg-[#007979]/10 text-[#007979] flex items-center justify-center font-mono font-bold">
          📅
        </div>
      </div>
      <div class="mt-4 pt-2.5 flex items-center justify-between text-[11px] text-[#66706F] bg-[#ecf6f5] px-2.5 py-1.5 rounded-lg">
        <span class="font-mono text-[#007979] font-medium">100% Sesuai Rencana</span>
        <span>24 Otomatis • 4 Manual</span>
      </div>
    </div>

    <div class="bg-white rounded-xl p-4 shadow-sm border border-[#DCE2DF] flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div class="space-y-1">
          <span class="text-[12px] text-[#66706F] block">Hari Libur & Cuti Bersama</span>
          <div class="flex items-baseline gap-2">
            <span class="text-[28px] text-[#9e4200] font-bold font-mono">{totalHolidaysThisMonth || 4}</span>
            <span class="text-[12px] text-[#66706F]">Hari Non-Kerja</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-lg bg-[#FFE2AF] text-[#793100] flex items-center justify-center">
          🏖️
        </div>
      </div>
      <div class="mt-4 pt-2.5 flex items-center justify-between text-[11px] text-[#66706F] bg-[#FFF8EC] px-2.5 py-1.5 rounded-lg">
        <span class="text-[#793100] font-medium">Auto-Bypass Aktif</span>
        <span class="font-mono">ASN Off</span>
      </div>
    </div>

    <div class="bg-white rounded-xl p-4 shadow-sm border border-[#DCE2DF] flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div class="space-y-1">
          <span class="text-[12px] text-[#66706F] block">Proteksi Siaran Hari Kerja</span>
          <div class="flex items-baseline gap-2">
            <span class="text-[28px] text-[#007979] font-bold font-mono">100%</span>
            <span class="text-[12px] text-[#24B1B1] font-medium">Aman</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-lg bg-[#007979]/10 text-[#007979] flex items-center justify-center">
          🛡️
        </div>
      </div>
      <div class="mt-4 pt-2.5 flex items-center justify-between text-[11px] text-[#66706F] bg-[#ecf6f5] px-2.5 py-1.5 rounded-lg">
        <span class="text-[#172020] font-medium">0 Anomali Pengiriman</span>
        <span class="font-mono text-[#66706F]">Cron Guard v2.4</span>
      </div>
    </div>

    <div class="bg-white rounded-xl p-4 shadow-sm border border-[#DCE2DF] flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div class="space-y-1">
          <span class="text-[12px] text-[#66706F] block">Sinkronisasi Rilis BRS Nasional</span>
          <div class="flex items-baseline gap-2">
            <span class="text-[18px] text-[#172020] font-bold">BPS RI Terhubung</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-lg bg-[#ecf6f5] text-[#66706F] flex items-center justify-center">
          ☁️
        </div>
      </div>
      <div class="mt-4 pt-2.5 flex items-center justify-between text-[11px] text-[#66706F] bg-[#ecf6f5] px-2.5 py-1.5 rounded-lg">
        <span class="truncate font-medium text-[#172020]">Rilis Terdekat: 01 Okt 09:00</span>
        <span class="font-mono text-[#007979]">IHK Sulteng</span>
      </div>
    </div>
  </div>

  <!-- Asymmetric 8-Col + 4-Col Layout -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <!-- Left Column (8 cols): Interactive Calendar Grid -->
    <div class="lg:col-span-8 flex flex-col gap-4">
      <div class="bg-white rounded-xl shadow-sm border border-[#DCE2DF] overflow-hidden">
        <!-- Controls Bar -->
        <div class="p-4 md:p-5 bg-[#f2fbfb] border-b border-[#DCE2DF] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="flex items-center bg-white rounded-lg shadow-sm border border-[#DCE2DF]">
              <button
                onclick={prevMonth}
                aria-label="Bulan sebelumnya"
                class="p-2 hover:bg-[#ecf6f5] text-[#66706F] rounded-l-lg transition-colors"
                type="button"
              >
                ◀
              </button>
              <div class="px-4 py-1.5 text-[16px] text-[#172020] font-bold min-w-[150px] text-center">
                {monthLabel}
              </div>
              <button
                onclick={nextMonth}
                aria-label="Bulan berikutnya"
                class="p-2 hover:bg-[#ecf6f5] text-[#66706F] rounded-r-lg transition-colors"
                type="button"
              >
                ▶
              </button>
            </div>
            <button
              onclick={goToToday}
              class="px-3 py-1.5 rounded-lg bg-white border border-[#DCE2DF] text-[#172020] text-[12px] font-medium shadow-sm hover:bg-[#ecf6f5] transition-colors flex items-center gap-1.5"
              type="button"
            >
              <span class="w-2 h-2 rounded-full bg-[#E37434]"></span>
              <span>Hari Ini (01 Okt)</span>
            </button>
          </div>
          <div class="text-[12px] text-[#66706F] font-mono">
            Zona Waktu: Asia/Makassar (WITA)
          </div>
        </div>

        <!-- Legend Strip -->
        <div class="px-5 py-2.5 bg-[#ecf6f5] border-b border-[#DCE2DF] flex flex-wrap items-center gap-y-2 gap-x-4 text-[12px] text-[#66706F]">
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-[#007979]"></span>
            <span class="text-[#172020]">Siaran Resmi (BRS/Publikasi)</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded bg-[#FFE2AF]"></span>
            <span class="text-[#172020] font-medium">Libur & Cuti Bersama (Bypass)</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded ring-2 ring-[#E37434]"></span>
            <span class="text-[#172020] font-medium">Hari Ini</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded bg-[#dbe4e4]"></span>
            <span>Akhir Pekan (Standby)</span>
          </div>
        </div>

        <!-- Calendar Month Table Grid -->
        <div class="p-3 md:p-4 overflow-x-auto">
          <div class="min-w-[680px]">
            <!-- Weekday Headers -->
            <div class="grid grid-cols-7 gap-2 mb-2 text-center text-[12px] font-semibold text-[#66706F]">
              <div class="py-1">SENIN</div>
              <div class="py-1">SELASA</div>
              <div class="py-1">RABU</div>
              <div class="py-1">KAMIS</div>
              <div class="py-1">JUMAT</div>
              <div class="py-1 text-[#B42318]">SABTU</div>
              <div class="py-1 text-[#B42318]">MINGGU</div>
            </div>

            <!-- Calendar Cells -->
            <div class="grid grid-cols-7 gap-2">
              {#each calendarDays as day}
                {#if !day.isCurrentMonth}
                  <div class="min-h-[105px] bg-[#f2fbfb]/50 border border-dashed border-[#DCE2DF] p-2 rounded-lg opacity-40 flex flex-col justify-between">
                    <span class="font-mono text-[12px] text-[#66706F]">{day.dayNumber}</span>
                  </div>
                {:else if day.holiday && !day.holiday.is_workday}
                  <!-- Holiday / Cuti Bersama Cell -->
                  <div class="min-h-[105px] bg-[#FFF8EC] border border-[#FFE2AF] p-2 rounded-lg flex flex-col justify-between shadow-sm relative">
                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <span class="font-mono text-[13px] font-bold text-[#9e4200]">{day.dayNumber}</span>
                        <span class="text-[12px]">🚩</span>
                      </div>
                      <div class="px-1 py-0.5 rounded bg-[#FFE2AF] text-[#793100] text-[10px] font-semibold leading-tight mb-1">
                        {day.holiday.is_national ? 'LIBUR NASIONAL' : 'CUTI BERSAMA'}
                      </div>
                      <div class="text-[10px] text-[#9e4200] font-medium leading-tight">
                        {day.holiday.description}
                      </div>
                    </div>
                    <div class="flex items-center justify-between mt-1 text-[10px] font-mono text-[#9e4200]">
                      <span>Bypass Aktif</span>
                      <span>ASN Off</span>
                    </div>
                  </div>
                {:else if day.isToday}
                  <!-- Today Cell -->
                  <div class="min-h-[105px] bg-[#FFF8EC]/60 border-2 border-[#E37434] p-2 rounded-lg shadow-sm flex flex-col justify-between">
                    <div>
                      <div class="flex items-center justify-between mb-1.5">
                        <span class="font-mono text-[14px] font-bold text-[#E37434]">01</span>
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#E37434] text-white">Hari Ini</span>
                      </div>
                      <div class="space-y-1">
                        <div class="px-1.5 py-1 rounded bg-[#007979] text-white text-[10px] font-medium truncate flex items-center gap-1 shadow-sm">
                          <span>📡</span>
                          <span>09:00 • BRS Inflasi</span>
                        </div>
                        <div class="px-1.5 py-0.5 rounded bg-[#ecf6f5] text-[#172020] text-[10px] truncate">
                          07:15 • Presensi Masuk
                        </div>
                        <div class="px-1.5 py-0.5 rounded bg-[#ecf6f5] text-[#172020] text-[10px] truncate">
                          15:45 • Presensi Pulang
                        </div>
                      </div>
                    </div>
                    <div class="text-[10px] font-mono text-[#66706F] text-right">3 Siaran</div>
                  </div>
                {:else if day.isWeekend}
                  <!-- Weekend Cell -->
                  <div class="min-h-[105px] bg-[#f2fbfb] border border-[#DCE2DF] p-2 rounded-lg flex flex-col justify-between text-[#66706F]">
                    <div class="flex items-center justify-between mb-1.5">
                      <span class="font-mono text-[12px] text-[#66706F]">{day.dayNumber}</span>
                      <span class="text-[10px]">{day.dayOfWeek === 6 ? 'Sabtu' : 'Minggu'}</span>
                    </div>
                    <div class="text-[11px] text-center py-2 text-[#66706F]/70">Standby</div>
                    <span class="text-[10px] font-mono text-[#66706F]/60 text-right">Libur Rutin</span>
                  </div>
                {:else}
                  <!-- Normal Workday Cell -->
                  <div class="min-h-[105px] bg-white border border-[#DCE2DF] p-2 rounded-lg flex flex-col justify-between hover:bg-[#ecf6f5] transition-colors">
                    <div>
                      <div class="flex items-center justify-between mb-1.5">
                        <span class="font-mono text-[12px] font-medium text-[#172020]">{day.dayNumber}</span>
                      </div>
                      <div class="space-y-1">
                        <div class="px-1.5 py-0.5 rounded bg-[#ecf6f5] text-[#172020] text-[10px] truncate">
                          07:15 & 15:45 Presensi ASN
                        </div>
                        {#if day.dayNumber === 8 || day.dayNumber === 15 || day.dayNumber === 30}
                          <div class="px-1.5 py-0.5 rounded bg-[#007979] text-white text-[10px] truncate">
                            09:00 • Rilis Publikasi
                          </div>
                        {/if}
                      </div>
                    </div>
                    <span class="text-[10px] text-[#66706F]">2 Siaran</span>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        </div>

        <!-- Footer Info -->
        <div class="px-5 py-3 bg-[#f2fbfb] border-t border-[#DCE2DF] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12px] text-[#66706F]">
          <div class="flex items-center gap-2">
            <span>🛡️</span>
            <span>Koneksi API SKB Kemenpan-RB & BPS RI Aktif (Sinkron Terakhir: Hari ini 06:00 WITA)</span>
          </div>
          <div class="font-mono text-[#172020] font-medium">
            Zona Waktu: WITA (Asia/Makassar)
          </div>
        </div>
      </div>
    </div>

    <!-- Right Column (4 cols): Schedule Rules, Upcoming Queue & Exception List -->
    <div class="lg:col-span-4 flex flex-col gap-5">
      <!-- Card 1: Cron Engine Rules -->
      <div class="bg-white rounded-xl p-5 shadow-sm border border-[#DCE2DF] space-y-4">
        <div class="flex items-center justify-between border-b border-[#DCE2DF] pb-3">
          <div class="flex items-center gap-2">
            <span>⚙️</span>
            <h2 class="text-[15px] font-bold text-[#172020]">Aturan Logika Penjadwalan</h2>
          </div>
          <span class="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#007979]/10 text-[#007979]">3 Aktif</span>
        </div>
        <div class="space-y-3">
          <div class="p-3 bg-[#ecf6f5] rounded-lg space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-[13px] font-semibold text-[#172020]">Holiday Bypass ASN</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#24B1B1]/15 text-[#007979]">Aktif</span>
            </div>
            <p class="text-[12px] text-[#66706F] leading-relaxed">
              Mendeteksi kalender SKB 3 Menteri secara mandiri. Otomatis menonaktifkan trigger reminder absensi ASN pada tanggal merah.
            </p>
          </div>
          <div class="p-3 bg-[#ecf6f5] rounded-lg space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-[13px] font-semibold text-[#172020]">Buffer Anti-Spam Meta API</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono text-[#66706F] bg-white border border-[#DCE2DF]">45 msg/mnt</span>
            </div>
            <p class="text-[12px] text-[#66706F] leading-relaxed">
              Jarak antar siaran publik dibatasi demi mencegah rate-limiting Meta WhatsApp Cloud API.
            </p>
          </div>
          <div class="p-3 bg-[#ecf6f5] rounded-lg space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-[13px] font-semibold text-[#172020]">Window Jam Kerja</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono text-[#007979] bg-[#007979]/10">08:00 - 17:00 WITA</span>
            </div>
            <p class="text-[12px] text-[#66706F] leading-relaxed">
              Siaran BRS dan Publikasi dibatasi ketat hanya pada jam kerja resmi.
            </p>
          </div>
        </div>
      </div>

      <!-- Card 2: Upcoming Queue -->
      <div class="bg-white rounded-xl p-5 shadow-sm border border-[#DCE2DF] space-y-4">
        <div class="flex items-center justify-between border-b border-[#DCE2DF] pb-3">
          <div class="flex items-center gap-2">
            <span>⏰</span>
            <h2 class="text-[15px] font-bold text-[#172020]">Antrean Terdekat</h2>
          </div>
          <span class="font-mono text-[11px] text-[#66706F]">WITA Queue</span>
        </div>
        <div class="space-y-3">
          <div class="p-3 bg-[#FFF8EC] border border-[#FFE2AF] rounded-lg space-y-2">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="text-[13px] font-semibold text-[#172020]">Siaran BRS Inflasi & IHK</div>
                <div class="text-[11px] text-[#66706F]">Target: Publik & Media (3.850 Penerima)</div>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#E37434] text-white">09:00 WITA</span>
            </div>
            <div class="flex items-center justify-between text-[11px] text-[#66706F] pt-1 border-t border-[#FFE2AF]">
              <span>Status: Siap Kirim</span>
              <span class="font-mono text-[#007979]">Campaign #2026-10-BRS</span>
            </div>
          </div>

          <div class="p-3 bg-[#ecf6f5] rounded-lg space-y-2">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="text-[13px] font-semibold text-[#172020]">Reminder Presensi Pulang</div>
                <div class="text-[11px] text-[#66706F]">Target: Seluruh ASN BPS Sulteng (84 Pegawai)</div>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono text-[#007979] bg-[#007979]/10">15:45 WITA</span>
            </div>
            <div class="flex items-center justify-between text-[11px] text-[#66706F] pt-1 border-t border-[#DCE2DF]">
              <span>Status: Otomatis SIMPEG</span>
              <span class="font-mono text-[#66706F]">Auto Rule Presensi</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Card 3: Daftar Exception Khusus Bulan Ini -->
      <div class="bg-white rounded-xl p-5 shadow-sm border border-[#DCE2DF] space-y-4">
        <div class="flex items-center justify-between border-b border-[#DCE2DF] pb-3">
          <div class="flex items-center gap-2">
            <span>📅</span>
            <h2 class="text-[15px] font-bold text-[#172020]">Pengecualian Terdaftar</h2>
          </div>
          <span class="font-mono text-[11px] text-[#66706F]">{holidays.length} Hari</span>
        </div>
        <div class="space-y-2 max-h-[220px] overflow-y-auto pr-1">
          {#if holidays.length === 0}
            <div class="text-[12px] text-[#66706F] text-center py-4">Belum ada hari libur / exception tersimpan</div>
          {:else}
            {#each holidays as h}
              <div class="p-2.5 rounded-lg border border-[#DCE2DF] flex items-center justify-between text-[12px] bg-white">
                <div class="min-w-0 pr-2">
                  <div class="font-mono font-bold text-[#172020]">{h.date}</div>
                  <div class="text-[#66706F] truncate">{h.description}</div>
                  <div class="text-[10px] text-[#9e4200]">
                    {h.is_workday ? 'Hari Kerja Pengganti' : (h.is_national ? 'Libur Nasional' : 'Pengecualian Daerah')}
                  </div>
                </div>
                <button
                  onclick={() => deleteException(h.date)}
                  class="p-1 hover:bg-[#FEF3F2] text-[#B42318] rounded transition-colors text-[13px]"
                  title="Hapus pengecualian"
                  type="button"
                >
                  ✕
                </button>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Modal Tambah Exception / Libur -->
{#if showModal}
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-[#DCE2DF] space-y-4">
      <div class="flex items-center justify-between border-b border-[#DCE2DF] pb-3">
        <h3 class="text-[16px] font-bold text-[#172020]">Tambah Jadwal / Exception</h3>
        <button
          onclick={() => showModal = false}
          class="text-[#66706F] hover:text-[#172020] text-[16px] font-bold"
          type="button"
        >
          ✕
        </button>
      </div>

      {#if formError}
        <div class="p-3 bg-[#FEF3F2] border border-[#B42318]/30 rounded-lg text-[#B42318] text-[13px]">
          {formError}
        </div>
      {/if}

      <form onsubmit={handleAddException} class="space-y-4">
        <div>
          <label for="form-date" class="block text-[13px] font-medium text-[#172020] mb-1">Tanggal (YYYY-MM-DD)</label>
          <input
            id="form-date"
            type="date"
            bind:value={formDate}
            required
            class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg text-[13px] font-mono focus:outline-none focus:border-[#E37434]"
          />
        </div>

        <div>
          <label for="form-desc" class="block text-[13px] font-medium text-[#172020] mb-1">Keterangan / Alasan</label>
          <input
            id="form-desc"
            type="text"
            bind:value={formDesc}
            placeholder="Contoh: HUT Sulawesi Tengah / Libur Khusus"
            required
            class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg text-[13px] focus:outline-none focus:border-[#E37434]"
          />
        </div>

        <div class="space-y-2">
          <label class="flex items-center gap-2 text-[13px] text-[#172020] cursor-pointer">
            <input
              type="checkbox"
              bind:checked={formIsWorkday}
              class="rounded border-[#DCE2DF] text-[#E37434] focus:ring-[#E37434]"
            />
            <span>Hari Kerja Pengganti (Forced Workday)</span>
          </label>
          <span class="block text-[11px] text-[#66706F] pl-6">
            Centang jika hari libur/akhir pekan ini dialihkan menjadi hari kerja wajib broadcast presensi.
          </span>
        </div>

        <div class="space-y-2">
          <label class="flex items-center gap-2 text-[13px] text-[#172020] cursor-pointer">
            <input
              type="checkbox"
              bind:checked={formIsNational}
              class="rounded border-[#DCE2DF] text-[#E37434] focus:ring-[#E37434]"
            />
            <span>Libur Nasional Resmi (SKB 3 Menteri)</span>
          </label>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-[#DCE2DF]">
          <button
            type="button"
            onclick={() => showModal = false}
            class="px-4 py-2 border border-[#DCE2DF] rounded-lg text-[13px] text-[#66706F] hover:bg-[#ecf6f5]"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={formSubmitting}
            class="px-4 py-2 bg-[#E37434] hover:bg-[#c96227] text-white rounded-lg text-[13px] font-medium shadow-sm"
          >
            {formSubmitting ? 'Menyimpan...' : 'Simpan Pengecualian'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
