import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Templates from '../src/routes/Templates.svelte';
import Integrations from '../src/routes/Integrations.svelte';

describe('Templates & Integrations UI Screens', () => {
  it('renders Templates management screen with sync action and KPI titles', () => {
    render(Templates);

    expect(screen.getByText('Katalog & Manajemen Template Meta WABA')).toBeDefined();
    expect(screen.getByText('Sinkronkan Meta Cloud API')).toBeDefined();
    expect(screen.getByText('TOTAL TEMPLATE')).toBeDefined();
    expect(screen.getByText('KATEGORI UTILITY')).toBeDefined();
  });

  it('renders Integrations screen with Meta ping and cards', () => {
    render(Integrations);

    expect(screen.getByText('Integrasi Sistem & Pemantauan Kesehatan')).toBeDefined();
    expect(screen.getByText(/Uji Koneksi Meta/)).toBeDefined();
    expect(screen.getByText('Konfigurasi Kredensial Meta')).toBeDefined();
    expect(screen.getByText('Meta WhatsApp Cloud API')).toBeDefined();
    expect(screen.getByText(/SIMPEG & Presensi Pegawai/)).toBeDefined();
  });
});
