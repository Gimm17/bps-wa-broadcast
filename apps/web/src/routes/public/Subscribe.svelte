<script>
  import { onMount } from 'svelte';
  import { api } from '../../lib/api/client.js';

  let name = $state('');
  let phone = $state('');
  let instansi = $state('');
  let profesi = $state('Masyarakat Umum');
  let selectedTopics = $state(['inflasi', 'pdrb']);
  let consent = $state(false);

  let topics = $state([
    { code: 'inflasi', title: 'BRS Inflasi & IHK', description: 'Perkembangan indeks harga konsumen bulanan' },
    { code: 'pdrb', title: 'Pertumbuhan Ekonomi (PDRB)', description: 'Rilis pertumbuhan ekonomi triwulanan' },
    { code: 'ketenagakerjaan', title: 'Ketenagakerjaan & Kemiskinan', description: 'Tingkat pengangguran terbuka dan persentase kemiskinan' },
    { code: 'pertanian', title: 'Pertanian & Nilai Tukar Petani', description: 'Indikator kesejahteraan petani & produksi tanaman pangan' },
    { code: 'ekspor_impor', title: 'Ekspor, Impor & Pariwisata', description: 'Perdagangan luar negeri & tingkat penghunian kamar hotel' }
  ]);

  let isLoading = $state(false);
  let errorMsg = $state('');
  let successData = $state(null);

  onMount(async () => {
    try {
      const res = await api.get('/api/subscriptions/topics');
      if (res && res.topics && res.topics.length > 0) {
        topics = res.topics;
        if (selectedTopics.length === 0) {
          selectedTopics = [topics[0].code];
        }
      }
    } catch (err) {
      // Use fallback default topics
    }
  });

  function toggleTopic(code) {
    if (selectedTopics.includes(code)) {
      if (selectedTopics.length > 1) {
        selectedTopics = selectedTopics.filter(c => c !== code);
      }
    } else {
      selectedTopics = [...selectedTopics, code];
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    errorMsg = '';

    if (!consent) {
      errorMsg = 'Anda wajib mencentang persetujuan penerimaan pesan WhatsApp sesuai UU PDP No. 27/2022.';
      return;
    }

    if (selectedTopics.length === 0) {
      errorMsg = 'Pilih minimal satu topik informasi.';
      return;
    }

    isLoading = true;
    try {
      const res = await api.post('/api/subscriptions/public', {
        name,
        phone,
        instansi,
        profesi,
        topicCodes: selectedTopics,
        consent: true
      });

      successData = {
        name,
        phone,
        manageToken: res.manageToken,
        topicsCount: selectedTopics.length
      };
    } catch (err) {
      errorMsg = err.message || 'Gagal memproses pendaftaran. Silakan periksa kembali data Anda.';
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="min-h-screen bg-[#F7F7F3] text-[#172020] font-sans">
  <!-- Public Top Navigation -->
  <header class="bg-white border-b border-[#DCE2DF] sticky top-0 z-40 shadow-sm">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-[#007979] text-white flex items-center justify-center font-bold text-base">
          BPS
        </div>
        <div class="flex flex-col">
          <span class="text-sm font-bold text-[#172020] tracking-tight">BPS PROVINSI SULAWESI TENGAH</span>
          <span class="text-[11px] text-[#66706F]">Portal Resmi Siaran Statistik WhatsApp</span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E0EAE9] text-[#007979] text-[12px] font-medium">
          <span class="w-2 h-2 rounded-full bg-[#24B1B1]"></span>
          <span>Meta WABA Terverifikasi</span>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    {#if successData}
      <!-- Success State -->
      <div class="max-w-2xl mx-auto bg-white rounded-2xl border border-[#DCE2DF] p-8 shadow-sm text-center">
        <div class="w-16 h-16 rounded-full bg-[#E0EAE9] text-[#007979] flex items-center justify-center mx-auto mb-4 text-3xl">
          ✓
        </div>
        <h1 class="text-2xl font-bold text-[#172020] mb-2">Langganan WhatsApp Berhasil Diaktifkan!</h1>
        <p class="text-sm text-[#66706F] mb-6">
          Terima kasih <strong>{successData.name}</strong>. Nomor Anda telah terdaftar untuk menerima siaran resmi dari Badan Pusat Statistik Provinsi Sulawesi Tengah.
        </p>

        <div class="bg-[#F7F7F3] rounded-xl p-4 text-left border border-[#DCE2DF] mb-6 flex flex-col gap-2">
          <div class="flex justify-between text-xs text-[#66706F]">
            <span>Nomor Terdaftar:</span>
            <span class="font-mono font-medium text-[#172020]">{successData.phone}</span>
          </div>
          <div class="flex justify-between text-xs text-[#66706F]">
            <span>Topik Dipilih:</span>
            <span class="font-medium text-[#172020]">{successData.topicsCount} Topik Statistik</span>
          </div>
          <div class="flex justify-between text-xs text-[#66706F]">
            <span>Kepatuhan PDP:</span>
            <span class="text-[#007979] font-medium">Tercatat di Konsensus Digital UU 27/2022</span>
          </div>
        </div>

        <div class="p-4 bg-[#FFF8EC] rounded-xl border border-[#FFE2AF] text-left text-xs text-[#793100] mb-6">
          <p class="font-semibold mb-1">💡 Informasi Penting:</p>
          <ul class="list-disc pl-4 space-y-1">
            <li>Pesan siaran akan dikirimkan langsung dari akun resmi BPS Sulawesi Tengah bercentang hijau.</li>
            <li>Anda dapat berhenti berlangganan kapan saja dengan membalas pesan <strong>BERHENTI</strong> di WhatsApp.</li>
          </ul>
        </div>

        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          {#if successData.manageToken}
            <a
              href="#/manage-subscription?token={successData.manageToken}"
              class="px-5 py-2.5 rounded-lg bg-[#007979] text-white text-sm font-medium hover:bg-[#006a6a] transition-colors"
            >
              Kelola Preferensi Topik
            </a>
          {/if}
          <button
            type="button"
            onclick={() => { successData = null; }}
            class="px-5 py-2.5 rounded-lg border border-[#DCE2DF] text-[#172020] text-sm font-medium hover:bg-[#F7F7F3] transition-colors"
          >
            Daftarkan Nomor Lain
          </button>
        </div>
      </div>
    {:else}
      <!-- Form + WhatsApp Mockup Preview -->
      <div class="mb-8">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#DCE2DF] text-xs font-semibold text-[#007979] mb-3">
          <span class="w-2 h-2 rounded-full bg-[#24B1B1]"></span>
          Kanal Siaran Resmi Badan Pusat Statistik Provinsi Sulawesi Tengah
        </div>
        <h1 class="text-3xl sm:text-4xl font-bold text-[#172020] tracking-tight mb-3">
          Dapatkan Rilis Resmi Statistik Sulawesi Tengah Langsung di WhatsApp Anda
        </h1>
        <p class="text-base text-[#66706F] max-w-3xl leading-relaxed">
          Notifikasi Berita Resmi Statistik (BRS), indikator ekonomi makro, ketenagakerjaan, hingga indeks pembangunan manusia terverifikasi langsung dari sumber otoritatif. Akurat, bebas spam, dan gratis tanpa syarat.
        </p>

        <!-- Trust Badges -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div class="bg-white p-3 rounded-xl border border-[#DCE2DF] flex items-center gap-2.5">
            <span class="text-xl">💰</span>
            <div class="flex flex-col">
              <span class="text-xs font-bold text-[#172020]">100% Bebas Biaya</span>
              <span class="text-[11px] text-[#66706F]">PNBP Rp 0,-</span>
            </div>
          </div>
          <div class="bg-white p-3 rounded-xl border border-[#DCE2DF] flex items-center gap-2.5">
            <span class="text-xl">✅</span>
            <div class="flex flex-col">
              <span class="text-xs font-bold text-[#172020]">Resmi Meta WABA</span>
              <span class="text-[11px] text-[#66706F]">Centang Hijau Resmi</span>
            </div>
          </div>
          <div class="bg-white p-3 rounded-xl border border-[#DCE2DF] flex items-center gap-2.5">
            <span class="text-xl">🛡️</span>
            <div class="flex flex-col">
              <span class="text-xs font-bold text-[#172020]">UU PDP No. 27/2022</span>
              <span class="text-[11px] text-[#66706F]">Privasi Terjamin</span>
            </div>
          </div>
          <div class="bg-white p-3 rounded-xl border border-[#DCE2DF] flex items-center gap-2.5">
            <span class="text-xl">🛑</span>
            <div class="flex flex-col">
              <span class="text-xs font-bold text-[#172020]">Opt-out Mudah</span>
              <span class="text-[11px] text-[#66706F]">Ketik BERHENTI</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <!-- Registration Form (8 Cols) -->
        <div class="lg:col-span-8 bg-white rounded-2xl border border-[#DCE2DF] p-6 sm:p-8 shadow-sm">
          <div class="border-b border-[#DCE2DF] pb-4 mb-6">
            <h2 class="text-lg font-bold text-[#172020]">Formulir Pendaftaran Siaran</h2>
            <p class="text-xs text-[#66706F]">Lengkapi data di bawah ini untuk menerima informasi statistik berkala secara otomatis.</p>
          </div>

          {#if errorMsg}
            <div class="p-3 mb-6 bg-[#FEF3F2] border border-[#ffdad6] text-[#B42318] rounded-xl text-xs flex items-center gap-2">
              <span class="font-bold text-sm">⚠</span>
              <span>{errorMsg}</span>
            </div>
          {/if}

          <form onsubmit={handleSubmit} class="space-y-5">
            <div>
              <label for="name" class="block text-xs font-semibold text-[#172020] mb-1.5">
                Nama Lengkap <span class="text-[#ba1a1a]">*</span>
              </label>
              <input
                id="name"
                type="text"
                bind:value={name}
                required
                placeholder="Contoh: Budi Santoso"
                class="w-full px-3.5 py-2.5 bg-[#F7F7F3] border border-[#DCE2DF] rounded-lg text-sm text-[#172020] focus:bg-white focus:outline-none focus:border-[#007979] focus:ring-1 focus:ring-[#007979] transition-all"
              />
            </div>

            <div>
              <label for="phone" class="block text-xs font-semibold text-[#172020] mb-1.5">
                Nomor WhatsApp Aktif <span class="text-[#ba1a1a]">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                bind:value={phone}
                required
                placeholder="Contoh: 08123456789 atau +628123456789"
                class="w-full px-3.5 py-2.5 bg-[#F7F7F3] border border-[#DCE2DF] rounded-lg text-sm text-[#172020] focus:bg-white focus:outline-none focus:border-[#007979] focus:ring-1 focus:ring-[#007979] transition-all font-mono"
              />
              <span class="text-[11px] text-[#66706F] mt-1 block">Pastikan nomor aktif dan dapat menerima pesan WhatsApp.</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="instansi" class="block text-xs font-semibold text-[#172020] mb-1.5">
                  Instansi / Lembaga / Media
                </label>
                <input
                  id="instansi"
                  type="text"
                  bind:value={instansi}
                  placeholder="Contoh: Bappeda Sulteng / Radar Sulteng"
                  class="w-full px-3.5 py-2.5 bg-[#F7F7F3] border border-[#DCE2DF] rounded-lg text-sm text-[#172020] focus:bg-white focus:outline-none focus:border-[#007979] focus:ring-1 focus:ring-[#007979] transition-all"
                />
              </div>

              <div>
                <label for="profesi" class="block text-xs font-semibold text-[#172020] mb-1.5">
                  Profesi / Kategori Pengguna
                </label>
                <select
                  id="profesi"
                  bind:value={profesi}
                  class="w-full px-3.5 py-2.5 bg-[#F7F7F3] border border-[#DCE2DF] rounded-lg text-sm text-[#172020] focus:bg-white focus:outline-none focus:border-[#007979] focus:ring-1 focus:ring-[#007979] transition-all"
                >
                  <option value="Masyarakat Umum">Masyarakat Umum</option>
                  <option value="Wartawan / Media">Wartawan / Media</option>
                  <option value="Peneliti / Akademisi">Peneliti / Akademisi</option>
                  <option value="Aparatur Sipil Negara (ASN)">Aparatur Sipil Negara (ASN)</option>
                  <option value="Pelaku Usaha / Swasta">Pelaku Usaha / Swasta</option>
                  <option value="Mahasiswa / Pelajar">Mahasiswa / Pelajar</option>
                </select>
              </div>
            </div>

            <!-- Topic Selection -->
            <div>
              <span class="block text-xs font-semibold text-[#172020] mb-2">
                Pilihan Topik Informasi Statistik <span class="text-[#ba1a1a]">*</span>
              </span>
              <div class="grid grid-cols-1 gap-2.5">
                {#each topics as topic}
                  <button
                    type="button"
                    onclick={() => toggleTopic(topic.code)}
                    class="p-3 rounded-xl border text-left flex items-start gap-3 transition-all {selectedTopics.includes(topic.code) ? 'border-[#007979] bg-[#E0EAE9]/30 ring-1 ring-[#007979]' : 'border-[#DCE2DF] bg-[#F7F7F3] hover:bg-white'}"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTopics.includes(topic.code)}
                      class="mt-1 w-4 h-4 rounded text-[#007979] focus:ring-[#007979]"
                      readonly
                    />
                    <div class="flex flex-col">
                      <span class="text-sm font-semibold text-[#172020]">{topic.title}</span>
                      <span class="text-xs text-[#66706F]">{topic.description}</span>
                    </div>
                  </button>
                {/each}
              </div>
            </div>

            <!-- Consent Checkbox -->
            <div class="p-4 bg-[#FFF8EC] border border-[#FFE2AF] rounded-xl flex items-start gap-3">
              <input
                id="consent"
                type="checkbox"
                bind:checked={consent}
                required
                class="mt-1 w-4 h-4 rounded text-[#E37434] focus:ring-[#E37434]"
              />
              <label for="consent" class="text-xs text-[#172020] leading-relaxed cursor-pointer">
                <strong>Persetujuan Eksplisit UU PDP No. 27/2022:</strong> Saya menyatakan setuju untuk menerima notifikasi rilis data dan siaran statistik resmi dari BPS Provinsi Sulawesi Tengah melalui nomor WhatsApp yang saya daftarkan. Data saya dilindungi dan tidak akan diberikan kepada pihak ketiga. Saya memahami bahwa saya berhak membatalkan langganan kapan saja.
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              class="w-full py-3 px-6 rounded-xl bg-[#E37434] text-white font-bold text-sm shadow hover:bg-[#9e4200] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {#if isLoading}
                <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Memproses Pendaftaran...</span>
              {:else}
                <span>Aktifkan Langganan WhatsApp Sekarang</span>
                <span>→</span>
              {/if}
            </button>
          </form>
        </div>

        <!-- Right: Interactive WhatsApp Message Preview (4 Cols) -->
        <div class="lg:col-span-4 sticky top-24">
          <div class="bg-[#172020] text-white rounded-2xl p-4 shadow-xl border border-gray-800">
            <div class="flex items-center gap-3 border-b border-gray-700 pb-3 mb-4">
              <div class="w-10 h-10 rounded-full bg-[#007979] flex items-center justify-center font-bold text-sm text-white">
                BPS
              </div>
              <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-1">
                  <span class="text-xs font-bold truncate">BPS Sulteng Official</span>
                  <span class="text-green-400 text-xs">✓</span>
                </div>
                <span class="text-[10px] text-gray-400">Akun Bisnis Resmi Terverifikasi</span>
              </div>
            </div>

            <!-- WhatsApp Message Bubble -->
            <div class="bg-[#005c4b] text-white p-3.5 rounded-xl text-xs space-y-2.5 shadow">
              <div class="font-bold text-[13px] text-emerald-200">
                📢 BERITA RESMI STATISTIK (BRS)
              </div>
              <p class="leading-relaxed text-[12px]">
                Halo <strong>{name || 'Rekan Statistik'}</strong>! Berikut ringkasan rilis resmi BPS Provinsi Sulawesi Tengah terbaru:
              </p>
              <div class="p-2.5 bg-[#025143] rounded-lg border border-emerald-600/40 text-[11px] space-y-1">
                <p class="font-bold text-amber-300">📊 Inflasi Sulteng September 2026: 2,14% (y-on-y)</p>
                <p class="text-gray-200">IHK tercatat 106,42. Komoditas penyumbang utama: beras, tarif listrik, dan angkutan udara.</p>
              </div>
              <p class="text-[11px] text-emerald-100">
                Unduh naskah lengkap BRS dan infografis di tautan resmi:
                <span class="underline text-blue-200">https://sulteng.bps.go.id/brs/789</span>
              </p>
              <div class="border-t border-emerald-700/60 pt-2 text-[10px] text-emerald-300 flex justify-between items-center">
                <span>Ketik <strong>BERHENTI</strong> untuk opt-out</span>
                <span>08:00 WITA ✓✓</span>
              </div>
            </div>

            <div class="mt-4 p-3 bg-gray-800/80 rounded-xl text-[11px] text-gray-300 space-y-1">
              <span class="font-semibold text-white block">ℹ Transparansi Layanan:</span>
              <p>Pesan siaran hanya dikirim saat ada rilis data resmi (biasanya tanggal 1 atau hari kerja pertama setiap bulan).</p>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </main>
</div>
