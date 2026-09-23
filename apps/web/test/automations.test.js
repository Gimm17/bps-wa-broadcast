import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Automations from '../src/routes/Automations.svelte';

describe('Automations UI Screen', () => {
  it('renders heading, telemetry metrics, and category tabs', () => {
    render(Automations);

    // Heading
    expect(screen.getByText('Katalog Aturan Otomasi & Pemicu Siaran')).toBeTruthy();

    // Telemetry Cards
    expect(screen.getByText('Total Aturan Otomasi')).toBeTruthy();
    expect(screen.getByText('Target Presensi ASN')).toBeTruthy();
    expect(screen.getByText('Keamanan Deduplikasi')).toBeTruthy();
    expect(screen.getByText('Konektor Terhubung')).toBeTruthy();

    // Buttons & Tabs
    expect(screen.getByText('Buat Aturan Baru')).toBeTruthy();
    expect(screen.getByText('Semua Otomasi')).toBeTruthy();
    expect(screen.getByText('Internal Pegawai')).toBeTruthy();
    expect(screen.getByText('Diseminasi & Publikasi')).toBeTruthy();
    expect(screen.getByText('Layanan Silastik')).toBeTruthy();
  });
});
