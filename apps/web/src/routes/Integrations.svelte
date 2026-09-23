<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api/client.js';

  let integrations = $state([]);
  let isLoading = $state(true);
  let isTesting = $state(false);
  let isSaving = $state(false);
  let errorMsg = $state('');
  let successMsg = $state('');

  // Modal configuration state
  let isModalOpen = $state(false);
  let wabaId = $state('');
  let phoneNumberId = $state('');
  let accessToken = $state('');
  let appSecret = $state('');
  let webhookVerifyToken = $state('');

  onMount(async () => {
    await loadIntegrations();
  });

  async function loadIntegrations() {
    isLoading = true;
    errorMsg = '';
    try {
      const res = await api.get('/api/integrations');
      integrations = res?.integrations || [];

      // Prepopulate form if meta_waba exists
      const meta = integrations.find(i => i.type === 'meta_waba');
      if (meta && meta.credentials) {
        wabaId = meta.credentials.wabaId || '';
        phoneNumberId = meta.credentials.phoneNumberId || '';
        webhookVerifyToken = meta.credentials.webhookVerifyToken || '';
      }
    } catch (err) {
      errorMsg = err.message || 'Gagal memuat status integrasi';
    } finally {
      isLoading = false;
    }
  }

  async function handleTestMeta() {
    isTesting = true;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await api.post('/api/integrations/meta/test');
      successMsg = res.message || 'Uji koneksi ke Meta Cloud API berhasil!';
      await loadIntegrations();
    } catch (err) {
      errorMsg = err.message || 'Uji koneksi gagal. Periksa kembali kredensial Meta Anda.';
    } finally {
      isTesting = false;
    }
  }

  async function handleSaveCredentials(e) {
    e.preventDefault();
    isSaving = true;
    errorMsg = '';
    successMsg = '';

    try {
      const res = await api.post('/api/integrations/meta', {
        wabaId,
        phoneNumberId,
        accessToken,
        appSecret,
        webhookVerifyToken
      });
      successMsg = res.message || 'Kredensial Meta WABA berhasil disimpan secara terenkripsi.';
      isModalOpen = false;
      await loadIntegrations();
    } catch (err) {
      errorMsg = err.message || 'Gagal menyimpan kredensial Meta.';
    } finally {
      isSaving = false;
    }
  }

  function getMetaIntegration() {
    return integrations.find(i => i.type === 'meta_waba') || null;
  }

  const meta = $derived(getMetaIntegration());
</script>

<div class="p-6 lg:p-8 flex flex-col gap-6">
  <!-- Header -->
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-[#DCE2DF]">
    <div class="space-y-1.5 max-w-3xl">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium bg-[#E0EAE9] text-[#007979]">
          <span class="w-1.5 h-1.5 rounded-full bg-[#24B1B1]"></span>
          Infrastruktur v2.4 PROD
        </span>
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono bg-[#F7F7F3] text-[#66706F] border border-[#DCE2DF]">
          Zona Waktu: WITA (Asia/Makassar)
        </span>
      </div>
      <h1 class="text-2xl lg:text-3xl font-bold text-[#172020] tracking-tight">
        Integrasi Sistem &amp; Pemantauan Kesehatan
      </h1>
      <p class="text-sm text-[#66706F] leading-relaxed">
        Pemantauan status koneksi API eksternal, gateway Meta Cloud API v21.0, sinkronisasi SIMPEG Presensi ASN, transaksi Silastik PST, dan webhook status terenkripsi AES-256-GCM.
      </p>
    </div>

    <div class="flex items-center gap-2.5 flex-wrap">
      <button
        type="button"
        onclick={handleTestMeta}
        disabled={isTesting}
        class="inline-flex items-center gap-1.5 px-3.5 h-10 rounded-lg text-xs font-semibold bg-white text-[#172020] border border-[#DCE2DF] hover:bg-[#F7F7F3] transition-all shadow-sm disabled:opacity-50"
      >
        <span class="{isTesting ? 'animate-spin' : ''}">🔄</span>
        <span>{isTesting ? 'Menguji...' : 'Uji Koneksi Meta (Test Ping)'}</span>
      </button>

      <button
        type="button"
        onclick={() => { isModalOpen = true; }}
        class="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg text-xs font-semibold bg-[#E37434] text-white hover:bg-[#9e4200] transition-all shadow-sm"
      >
        <span>🔑</span>
        <span>Konfigurasi Kredensial Meta</span>
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
      <button type="button" onclick={() => { errorMsg = ''; }} class="text-sm font-bold">✕</button>
    </div>
  {/if}

  <!-- Integration Cards Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <!-- Meta WhatsApp Cloud API -->
    <div class="bg-white rounded-2xl border border-[#DCE2DF] p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-[#007979] text-white flex items-center justify-center font-bold text-lg">
              W
            </div>
            <div>
              <h2 class="text-base font-bold text-[#172020]">Meta WhatsApp Cloud API</h2>
              <span class="text-xs text-[#66706F]">Gateway Komunikasi WhatsApp Resmi</span>
            </div>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-semibold {meta?.status === 'connected' ? 'bg-[#E0EAE9] text-[#007979]' : 'bg-[#FFF8EC] text-[#793100]'}">
            {meta?.status === 'connected' ? '● Terhubung' : '○ Belum Dikonfigurasi'}
          </span>
        </div>

        <div class="p-4 bg-[#F7F7F3] rounded-xl border border-[#DCE2DF] space-y-2 text-xs mb-4">
          <div class="flex justify-between">
            <span class="text-[#66706F]">WABA ID:</span>
            <span class="font-mono font-medium text-[#172020]">{meta?.credentials?.wabaId || 'Belum diisi'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[#66706F]">Phone Number ID:</span>
            <span class="font-mono font-medium text-[#172020]">{meta?.credentials?.phoneNumberId || 'Belum diisi'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[#66706F]">Access Token:</span>
            <span class="font-mono text-[#66706F]">{meta?.credentials?.accessToken || '••••••••'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[#66706F]">Keamanan:</span>
            <span class="text-[#007979] font-medium">Terenkripsi AES-256-GCM</span>
          </div>
        </div>

        <div class="p-3 bg-[#FFF8EC] rounded-xl border border-[#FFE2AF] text-[11px] text-[#793100]">
          <span class="font-semibold block mb-0.5">URL Callback Webhook Meta:</span>
          <code class="font-mono text-[10px] break-all">https://wa.sulteng.bps.go.id/api/meta/webhook</code>
        </div>
      </div>

      <div class="mt-6 pt-4 border-t border-[#DCE2DF] flex justify-between items-center">
        <span class="text-[11px] text-[#66706F]">
          Terakhir Sync: {meta?.last_sync_at ? new Date(meta.last_sync_at).toLocaleTimeString('id-ID') + ' WITA' : '-'}
        </span>
        <button
          type="button"
          onclick={() => { isModalOpen = true; }}
          class="px-3 py-1.5 rounded-lg bg-[#E0EAE9] text-[#007979] hover:bg-[#007979] hover:text-white transition-colors text-xs font-semibold"
        >
          Ubah Kredensial
        </button>
      </div>
    </div>

    <!-- SIMPEG Presensi ASN Sulteng -->
    <div class="bg-white rounded-2xl border border-[#DCE2DF] p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-[#24B1B1] text-white flex items-center justify-center font-bold text-lg">
              P
            </div>
            <div>
              <h2 class="text-base font-bold text-[#172020]">SIMPEG &amp; Presensi Pegawai</h2>
              <span class="text-xs text-[#66706F]">Pengingat Presensi Otomatis Jam Kerja</span>
            </div>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E0EAE9] text-[#007979]">
            ● Siaga (Adapter Aktif)
          </span>
        </div>

        <div class="p-4 bg-[#F7F7F3] rounded-xl border border-[#DCE2DF] space-y-2 text-xs mb-4">
          <div class="flex justify-between">
            <span class="text-[#66706F]">Protokol:</span>
            <span class="font-medium text-[#172020]">REST API Simpeg Sulteng</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[#66706F]">Jadwal Pengingat:</span>
            <span class="font-mono text-[#172020]">07:15 &amp; 15:45 WITA (Hari Kerja)</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[#66706F]">Deteksi Hari Libur:</span>
            <span class="text-[#007979] font-medium">Kalender Nasional &amp; Daerah Sulteng</span>
          </div>
        </div>

        <p class="text-xs text-[#66706F]">
          Sistem secara otomatis mengevaluasi presensi pegawai dan mengirimkan notifikasi sebelum batas waktu berakhir tanpa membebani server SIMPEG.
        </p>
      </div>

      <div class="mt-6 pt-4 border-t border-[#DCE2DF] flex justify-between items-center">
        <span class="text-[11px] text-[#66706F]">Otomasi Aktif</span>
        <span class="text-xs font-semibold text-[#007979]">Terkoneksi</span>
      </div>
    </div>

    <!-- Silastik PST -->
    <div class="bg-white rounded-2xl border border-[#DCE2DF] p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-[#E37434] text-white flex items-center justify-center font-bold text-lg">
              S
            </div>
            <div>
              <h2 class="text-base font-bold text-[#172020]">Silastik PST BPS Sulteng</h2>
              <span class="text-xs text-[#66706F]">Pelayanan Statistik Terpadu &amp; Survei Kepuasan</span>
            </div>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E0EAE9] text-[#007979]">
            ● Siaga (Adapter Aktif)
          </span>
        </div>

        <div class="p-4 bg-[#F7F7F3] rounded-xl border border-[#DCE2DF] space-y-2 text-xs mb-4">
          <div class="flex justify-between">
            <span class="text-[#66706F]">Trigger:</span>
            <span class="font-medium text-[#172020]">Selesai Konsultasi / Unduh Data</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[#66706F]">Kanal Evaluasi:</span>
            <span class="text-[#007979] font-medium">Survei Kebutuhan Data (SKD)</span>
          </div>
        </div>

        <p class="text-xs text-[#66706F]">
          Mengirimkan tautan konfirmasi tiket layanan dan evaluasi kepuasan konsumen secara otomatis setelah transaksi PST selesai.
        </p>
      </div>

      <div class="mt-6 pt-4 border-t border-[#DCE2DF] flex justify-between items-center">
        <span class="text-[11px] text-[#66706F]">Otomasi Aktif</span>
        <span class="text-xs font-semibold text-[#007979]">Terkoneksi</span>
      </div>
    </div>

    <!-- Publikasi & BRS Web Adapter -->
    <div class="bg-white rounded-2xl border border-[#DCE2DF] p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-[#006a6a] text-white flex items-center justify-center font-bold text-lg">
              D
            </div>
            <div>
              <h2 class="text-base font-bold text-[#172020]">Publikasi &amp; BRS Web Feed</h2>
              <span class="text-xs text-[#66706F]">Sinkronisasi Rilis Web sulteng.bps.go.id</span>
            </div>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E0EAE9] text-[#007979]">
            ● Siaga (Feed Poller Aktif)
          </span>
        </div>

        <div class="p-4 bg-[#F7F7F3] rounded-xl border border-[#DCE2DF] space-y-2 text-xs mb-4">
          <div class="flex justify-between">
            <span class="text-[#66706F]">Sumber Data:</span>
            <span class="font-medium text-[#172020]">Web Portal Resmi BPS Sulteng</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[#66706F]">Jadwal Rilis BRS:</span>
            <span class="font-mono text-[#172020]">Tanggal 1 Setiap Bulan (11:00 WITA)</span>
          </div>
        </div>

        <p class="text-xs text-[#66706F]">
          Mendeteksi rilis data makro (Inflasi, PDRB, Kemiskinan) dan menyiapkan draf broadcast secara otomatis untuk disetujui Admin Diseminasi.
        </p>
      </div>

      <div class="mt-6 pt-4 border-t border-[#DCE2DF] flex justify-between items-center">
        <span class="text-[11px] text-[#66706F]">Otomasi Aktif</span>
        <span class="text-xs font-semibold text-[#007979]">Terkoneksi</span>
      </div>
    </div>
  </div>

  <!-- Credentials Modal -->
  {#if isModalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div class="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-[#DCE2DF]">
        <div class="flex items-center justify-between border-b border-[#DCE2DF] pb-3 mb-4">
          <div class="flex items-center gap-2">
            <span class="text-lg">🔑</span>
            <div>
              <h3 class="font-bold text-sm text-[#172020]">Konfigurasi Kredensial Meta WABA</h3>
              <p class="text-[11px] text-[#66706F]">Dilindungi enkripsi AES-256-GCM dengan kunci master server</p>
            </div>
          </div>
          <button
            type="button"
            onclick={() => { isModalOpen = false; }}
            class="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <form onsubmit={handleSaveCredentials} class="space-y-4 text-xs">
          <div>
            <label for="wabaId" class="block font-semibold text-[#172020] mb-1">
              WhatsApp Business Account ID (WABA ID) <span class="text-[#ba1a1a]">*</span>
            </label>
            <input
              id="wabaId"
              type="text"
              bind:value={wabaId}
              required
              placeholder="Contoh: 109284729104820"
              class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg font-mono focus:outline-none focus:border-[#007979]"
            />
          </div>

          <div>
            <label for="phoneNumberId" class="block font-semibold text-[#172020] mb-1">
              Phone Number ID <span class="text-[#ba1a1a]">*</span>
            </label>
            <input
              id="phoneNumberId"
              type="text"
              bind:value={phoneNumberId}
              required
              placeholder="Contoh: 105829482910482"
              class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg font-mono focus:outline-none focus:border-[#007979]"
            />
          </div>

          <div>
            <label for="accessToken" class="block font-semibold text-[#172020] mb-1">
              Permanent System User Access Token <span class="text-[#ba1a1a]">*</span>
            </label>
            <input
              id="accessToken"
              type="password"
              bind:value={accessToken}
              required
              placeholder="EAAG..."
              class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg font-mono focus:outline-none focus:border-[#007979]"
            />
            <span class="text-[10px] text-[#66706F] mt-0.5 block">Dihasilkan dari Meta Business Manager dengan izin whatsapp_business_messaging &amp; whatsapp_business_management.</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label for="appSecret" class="block font-semibold text-[#172020] mb-1">
                App Secret (Verifikasi Webhook) <span class="text-[#ba1a1a]">*</span>
              </label>
              <input
                id="appSecret"
                type="password"
                bind:value={appSecret}
                required
                placeholder="Secret dari dashboard developer"
                class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg font-mono focus:outline-none focus:border-[#007979]"
              />
            </div>

            <div>
              <label for="webhookVerifyToken" class="block font-semibold text-[#172020] mb-1">
                Webhook Verify Token <span class="text-[#ba1a1a]">*</span>
              </label>
              <input
                id="webhookVerifyToken"
                type="text"
                bind:value={webhookVerifyToken}
                required
                placeholder="Token kustom untuk challenge"
                class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg font-mono focus:outline-none focus:border-[#007979]"
              />
            </div>
          </div>

          <div class="pt-4 border-t border-[#DCE2DF] flex justify-end gap-2.5">
            <button
              type="button"
              onclick={() => { isModalOpen = false; }}
              class="px-4 py-2 rounded-lg border border-[#DCE2DF] text-[#172020] hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              class="px-4 py-2 rounded-lg bg-[#E37434] text-white font-bold hover:bg-[#9e4200] disabled:opacity-50"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Kredensial Terenkripsi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>
