<script>
  import { onMount } from 'svelte';
  import { api } from '../../lib/api/client.js';

  let status = $state('processing'); // 'processing' | 'success' | 'error'
  let message = $state('Sedang memproses permintaan pembatalan langganan...');

  onMount(async () => {
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : window.location.search);
    const token = urlParams.get('token');
    const topicCode = urlParams.get('topic');

    if (!token) {
      status = 'error';
      message = 'Tautan tidak valid atau tidak memiliki token.';
      return;
    }

    try {
      const res = await api.post('/api/subscriptions/unsubscribe', {
        token,
        topicCode: topicCode || undefined
      });
      status = 'success';
      message = res.message || 'Pembatalan langganan berhasil diproses.';
    } catch (err) {
      status = 'error';
      message = err.message || 'Gagal memproses pembatalan langganan.';
    }
  });
</script>

<div class="min-h-screen bg-[#F7F7F3] text-[#172020] font-sans flex flex-col justify-between">
  <!-- Header -->
  <header class="bg-white border-b border-[#DCE2DF] h-16 flex items-center px-6">
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-lg bg-[#007979] text-white flex items-center justify-center font-bold text-base">
        BPS
      </div>
      <div class="flex flex-col">
        <span class="text-sm font-bold text-[#172020]">BPS PROVINSI SULAWESI TENGAH</span>
        <span class="text-[11px] text-[#66706F]">Kanal Resmi Siaran WhatsApp</span>
      </div>
    </div>
  </header>

  <!-- Content -->
  <main class="max-w-lg mx-auto p-6 w-full">
    <div class="bg-white rounded-2xl border border-[#DCE2DF] p-8 shadow-sm text-center">
      {#if status === 'processing'}
        <div class="w-10 h-10 border-3 border-[#007979] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h1 class="text-lg font-bold text-[#172020] mb-2">Memproses Permintaan</h1>
        <p class="text-sm text-[#66706F]">{message}</p>
      {:else if status === 'success'}
        <div class="w-16 h-16 rounded-full bg-[#E0EAE9] text-[#007979] flex items-center justify-center mx-auto mb-4 text-3xl font-bold">
          ✓
        </div>
        <h1 class="text-xl font-bold text-[#172020] mb-2">Berhenti Berlangganan Berhasil</h1>
        <p class="text-sm text-[#66706F] mb-6">{message}</p>
        <div class="p-3 bg-[#FFF8EC] rounded-xl border border-[#FFE2AF] text-xs text-[#793100] mb-6 text-left">
          Nomor Anda telah diperbarui pada sistem. Jika di kemudian hari Anda ingin mendapatkan kembali data statistik resmi, Anda dapat mendaftar kapan saja.
        </div>
        <a
          href="#/subscribe"
          class="inline-block px-5 py-2.5 rounded-lg bg-[#007979] text-white text-sm font-medium hover:bg-[#006a6a] transition-colors"
        >
          Ke Portal Pendaftaran
        </a>
      {:else}
        <div class="w-16 h-16 rounded-full bg-[#FEF3F2] text-[#B42318] flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
          ✕
        </div>
        <h1 class="text-xl font-bold text-[#172020] mb-2">Permintaan Tidak Berhasil</h1>
        <p class="text-sm text-[#66706F] mb-6">{message}</p>
        <a
          href="#/subscribe"
          class="inline-block px-5 py-2.5 rounded-lg border border-[#DCE2DF] text-[#172020] text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Kembali ke Beranda
        </a>
      {/if}
    </div>
  </main>

  <!-- Footer -->
  <footer class="p-6 text-center text-xs text-[#66706F]">
    © 2026 Badan Pusat Statistik Provinsi Sulawesi Tengah. Hak Cipta Dilindungi.
  </footer>
</div>
