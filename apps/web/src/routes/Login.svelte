<script>
  import { loginUser } from '../lib/stores/session.js';
  import { push } from 'svelte-spa-router';
  import { infoDialog } from '../lib/stores/dialog.js';

  let email = $state('');
  let password = $state('');
  let rememberMe = $state(true);
  let showPassword = $state(false);
  let errorMessage = $state('');
  let isSubmitting = $state(false);

  async function handleSubmit(e) {
    e.preventDefault();
    errorMessage = '';

    if (!email.trim() || !password.trim()) {
      errorMessage = 'Periksa kembali: Email dan kata sandi wajib diisi.';
      return;
    }

    isSubmitting = true;
    try {
      await loginUser({ email: email.trim(), password });
      push('/');
    } catch (err) {
      errorMessage = err?.error?.message || 'Periksa kembali email dan kata sandi Anda.';
    } finally {
      isSubmitting = false;
    }
  }

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }
</script>

<div class="min-h-screen bg-[#F7F7F3] flex flex-col justify-between text-[#172020] font-sans">
  <!-- Top Institutional Header -->
  <header class="w-full bg-[#FFFFFF] border-b border-[#DCE2DF] shadow-sm">
    <div class="w-full max-w-[1440px] mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-2.5 h-2.5 rounded-full bg-[#007979]"></div>
        <span class="text-[13px] font-bold text-[#172020] tracking-tight">BPS PROVINSI SULAWESI TENGAH</span>
        <span class="text-[#66706F] text-[12px] hidden sm:inline">|</span>
        <span class="text-[12px] text-[#66706F] hidden sm:inline">Sistem Operasional WhatsApp Cloud API</span>
      </div>
      <div class="flex items-center gap-1.5 text-[#66706F] font-mono text-[12px] bg-[#F7F7F3] px-2.5 py-1 rounded border border-[#DCE2DF]">
        <span>Asia/Makassar (WITA)</span>
      </div>
    </div>
  </header>

  <!-- Main Content Container -->
  <main class="w-full flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
    <div class="w-full max-w-[540px] flex flex-col items-center">
      <!-- Realtime System Operational Diagnostics Ribbon -->
      <div class="w-full mb-6 flex flex-wrap items-center justify-between gap-2 px-4 py-2 rounded-lg bg-[#FFFFFF] border border-[#DCE2DF] shadow-sm">
        <div class="flex items-center gap-2">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#24B1B1] opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-[#24B1B1]"></span>
          </span>
          <span class="font-mono text-[12px] text-[#007979] font-semibold">Meta WABA Gateway Terhubung</span>
          <span class="text-[#66706F]">•</span>
          <span class="font-mono text-[12px] text-[#66706F]">Layanan Aktif (WITA)</span>
        </div>
        <div class="flex items-center gap-2 font-mono text-[11px] text-[#66706F]">
          <span class="px-1.5 py-0.5 rounded bg-[#F7F7F3] font-medium text-[#172020] border border-[#DCE2DF]">v2.4.1-prod</span>
          <span>Palu Cluster</span>
        </div>
      </div>

      <!-- Main Authentication Card -->
      <div class="w-full bg-[#FFFFFF] rounded-xl border border-[#DCE2DF] shadow-md p-6 sm:p-8 flex flex-col">
        <!-- Emblem & Identity -->
        <div class="flex flex-col items-start pb-6 border-b border-[#DCE2DF] mb-6">
          <div class="flex items-center gap-3.5 mb-4">
            <div class="relative w-11 h-11 flex-shrink-0 flex items-center justify-center">
              <svg class="w-11 h-11" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <rect fill="#007979" height="31" rx="2" transform="rotate(45 24 2)" width="31" x="24" y="2"></rect>
                <rect fill="#24B1B1" height="21" rx="1.5" transform="rotate(45 24 9)" width="21" x="24" y="9"></rect>
                <rect fill="#E37434" height="11" rx="1" transform="rotate(45 24 16)" width="11" x="24" y="16"></rect>
              </svg>
            </div>
            <div class="flex flex-col">
              <span class="font-mono text-[11px] text-[#007979] uppercase tracking-wider font-semibold">BADAN PUSAT STATISTIK</span>
              <span class="text-[16px] text-[#172020] tracking-tight font-bold -mt-0.5">Provinsi Sulawesi Tengah</span>
            </div>
          </div>

          <h1 class="text-[20px] font-bold text-[#172020] tracking-tight">BPS Sulteng WhatsApp Operations</h1>
          <p class="text-[13px] text-[#66706F] mt-1">Sistem Operasional & Monitoring Broadcast Resmi Meta WABA API</p>

          <!-- Role Badges Indicators -->
          <div class="flex flex-wrap items-center gap-1.5 mt-3 pt-1">
            <span class="font-mono text-[11px] px-2 py-0.5 rounded bg-[#F7F7F3] text-[#66706F] font-medium border border-[#DCE2DF]">Super Admin</span>
            <span class="font-mono text-[11px] px-2 py-0.5 rounded bg-[#F7F7F3] text-[#66706F] font-medium border border-[#DCE2DF]">Admin Diseminasi</span>
            <span class="font-mono text-[11px] px-2 py-0.5 rounded bg-[#F7F7F3] text-[#66706F] font-medium border border-[#DCE2DF]">Operator Rilis</span>
            <span class="font-mono text-[11px] px-2 py-0.5 rounded bg-[#F7F7F3] text-[#66706F] font-medium border border-[#DCE2DF]">Pimpinan</span>
          </div>
        </div>

        <!-- Error Summary Alert -->
        {#if errorMessage}
          <div class="mb-5 p-3 rounded-lg bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-[13px] flex items-center gap-2" role="alert">
            <span class="font-bold">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        {/if}

        <!-- Sign In Form -->
        <form class="flex flex-col gap-4" novalidate onsubmit={handleSubmit}>
          <!-- Email Input -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[14px] font-medium text-[#172020] flex items-center justify-between" for="login-email">
              <span>Email Dinas / Akun SSO BPS <span class="text-[#E37434] font-bold">*</span></span>
              <span class="font-mono text-[11px] text-[#66706F]">Domain @bps.go.id</span>
            </label>
            <div class="relative flex items-center">
              <input
                id="login-email"
                name="email"
                type="email"
                bind:value={email}
                placeholder="nama.petugas@bps.go.id"
                required
                autocomplete="username"
                aria-label="Email"
                class="w-full h-11 px-3.5 rounded-lg bg-[#FFFFFF] text-[#172020] text-[14px] border border-[#DCE2DF] transition-all focus:outline-none focus:ring-2 focus:ring-[#E37434]/30"
              />
            </div>
            <p class="text-[12px] text-[#66706F]">
              Gunakan akun kedinasan resmi BPS terdaftar untuk verifikasi SSO.
            </p>
          </div>

          <!-- Password Input -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label class="text-[14px] font-medium text-[#172020]" for="login-password">
                Kata sandi <span class="text-[#E37434] font-bold">*</span>
              </label>
              <button
                type="button"
                class="text-[12px] text-[#007979] hover:underline font-medium"
                onclick={() => infoDialog({
                  title: 'Bantuan Reset Kata Sandi',
                  message: 'Demi keamanan data presensi dan operasi siaran WhatsApp, reset kata sandi dikelola secara tersentralisasi oleh Administrator Tim IPDS / Diseminasi BPS Provinsi Sulawesi Tengah.\n\nSilakan hubungi admin internal untuk pembaharuan kredensial akun Anda.'
                })}
              >
                Lupa kata sandi?
              </button>
            </div>
            <div class="relative flex items-center">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                bind:value={password}
                placeholder="••••••••••••"
                required
                autocomplete="current-password"
                aria-label="Kata sandi"
                class="w-full h-11 pl-3.5 pr-12 rounded-lg bg-[#FFFFFF] text-[#172020] text-[14px] border border-[#DCE2DF] transition-all focus:outline-none focus:ring-2 focus:ring-[#E37434]/30"
              />
              <button
                type="button"
                aria-label="Tampilkan atau sembunyikan kata sandi"
                class="absolute right-2.5 p-1.5 text-[#66706F] hover:text-[#172020] text-[12px] font-medium rounded"
                onclick={togglePasswordVisibility}
              >
                {showPassword ? 'Sembunyikan' : 'Lihat'}
              </button>
            </div>
            <p class="text-[12px] text-[#66706F]">
              Minimal 8 karakter terenkripsi dengan kombinasi huruf & angka.
            </p>
          </div>

          <!-- Remember Me Checkbox -->
          <div class="flex items-center justify-between pt-1">
            <label class="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                id="login-remember"
                bind:checked={rememberMe}
                class="w-4 h-4 rounded text-[#E37434] accent-[#E37434] cursor-pointer"
              />
              <span class="text-[13px] text-[#172020]">Ingat sesi saya di perangkat ini (30 hari)</span>
            </label>
          </div>

          <!-- Submit Button -->
          <div class="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              class="w-full h-11 bg-[#E37434] hover:bg-[#c95f22] text-white font-semibold text-[14px] rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all active:translate-y-[1px] disabled:opacity-60 min-touch-target"
            >
              {#if isSubmitting}
                <span>Memproses...</span>
              {:else}
                <span>Masuk ke Dashboard Operasional</span>
              {/if}
            </button>
          </div>
        </form>
      </div>

      <!-- Footer Info -->
      <footer class="mt-8 text-center text-[12px] text-[#66706F]">
        <p>© 2026 Badan Pusat Statistik Provinsi Sulawesi Tengah</p>
        <p class="mt-1">Jl. Prof. Moh. Yamin No. 59, Palu, Sulawesi Tengah 94111</p>
      </footer>
    </div>
  </main>
</div>
