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

<div class="min-h-screen bg-[#F7F7F3] flex flex-col justify-between items-center p-4 sm:p-6 text-[#172020] font-sans">
  <div class="w-full flex-1 flex flex-col items-center justify-center py-6">
    <div class="w-full max-w-[420px] flex flex-col items-center">
      <!-- Clean Brand Identity Header -->
      <div class="flex flex-col items-center text-center mb-6">
        <div class="w-16 h-16 rounded-2xl overflow-hidden border border-[#DCE2DF] bg-white p-2 shadow-sm flex items-center justify-center mb-3">
          <img src="/logo-sapa.jpg" alt="Logo SAPA BPS Sulteng" class="w-full h-full object-contain rounded-xl" />
        </div>
        <h1 class="text-[22px] font-bold text-[#172020] tracking-tight">SAPA BPS Sulteng</h1>
        <p class="text-[13px] text-[#66706F] mt-0.5 font-medium">Sistem Automasi Pesan &amp; Agenda</p>
      </div>

      <!-- Main Authentication Card -->
      <div class="w-full bg-[#FFFFFF] rounded-2xl border border-[#DCE2DF] shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-6 sm:p-8 flex flex-col">
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
            <label class="text-[13px] font-medium text-[#172020]" for="login-email">
              Email
            </label>
            <div class="relative flex items-center">
              <input
                id="login-email"
                name="email"
                type="email"
                bind:value={email}
                placeholder="nama@bps.go.id"
                required
                autocomplete="username"
                aria-label="Email"
                class="w-full h-11 px-3.5 rounded-lg bg-[#FFFFFF] text-[#172020] text-[14px] border border-[#DCE2DF] transition-all focus:outline-none focus:ring-2 focus:ring-[#007979]/30 focus:border-[#007979]"
              />
            </div>
          </div>

          <!-- Password Input -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label class="text-[13px] font-medium text-[#172020]" for="login-password">
                Kata sandi
              </label>
              <button
                type="button"
                class="text-[12px] text-[#007979] hover:underline font-medium"
                onclick={() => infoDialog({
                  title: 'Bantuan Kata Sandi',
                  message: 'Silakan hubungi Administrator IPDS / Diseminasi BPS Provinsi Sulawesi Tengah untuk reset atau perubahan kredensial akun Anda.'
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
                class="w-full h-11 pl-3.5 pr-12 rounded-lg bg-[#FFFFFF] text-[#172020] text-[14px] border border-[#DCE2DF] transition-all focus:outline-none focus:ring-2 focus:ring-[#007979]/30 focus:border-[#007979]"
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
          </div>

          <!-- Remember Me Checkbox -->
          <div class="flex items-center justify-between pt-0.5">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                id="login-remember"
                bind:checked={rememberMe}
                class="w-4 h-4 rounded text-[#007979] accent-[#007979] cursor-pointer"
              />
              <span class="text-[13px] text-[#66706F]">Ingat saya</span>
            </label>
          </div>

          <!-- Submit Button -->
          <div class="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              class="w-full h-11 bg-[#007979] hover:bg-[#006a6a] text-white font-semibold text-[14px] rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all active:translate-y-[1px] disabled:opacity-60 min-touch-target"
            >
              {#if isSubmitting}
                <span>Memproses...</span>
              {:else}
                <span>Masuk</span>
              {/if}
            </button>
          </div>
        </form>
      </div>

      <!-- Footer Info -->
      <footer class="mt-6 text-center text-[12px] text-[#66706F]">
        <p>© 2026 BPS Provinsi Sulawesi Tengah</p>
      </footer>
    </div>
  </div>
</div>
