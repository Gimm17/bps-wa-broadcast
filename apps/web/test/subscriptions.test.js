import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Subscriptions from '../src/routes/Subscriptions.svelte';
import Subscribe from '../src/routes/public/Subscribe.svelte';

describe('Subscription Components', () => {
  it('renders Subscriptions administration screen with tabs and KPI titles', () => {
    render(Subscriptions);

    expect(screen.getByText('Manajemen Langganan & Konsensus UU PDP')).toBeDefined();
    expect(screen.getByText('Buka Portal Publik')).toBeDefined();
    expect(screen.getByText(/Daftar Langganan/)).toBeDefined();
    expect(screen.getByText(/Direktori Topik/)).toBeDefined();
    expect(screen.getByText(/Buku Besar Konsensus UU PDP/)).toBeDefined();
  });

  it('renders public Subscribe portal with explicit consent and topic options', () => {
    render(Subscribe);

    expect(screen.getByText('Dapatkan Rilis Resmi Statistik Sulawesi Tengah Langsung di WhatsApp Anda')).toBeDefined();
    expect(screen.getByText('Formulir Pendaftaran Siaran')).toBeDefined();
    expect(screen.getByText(/Persetujuan Eksplisit UU PDP No. 27\/2022/)).toBeDefined();
    expect(screen.getByText('Aktifkan Langganan WhatsApp Sekarang')).toBeDefined();
  });
});
