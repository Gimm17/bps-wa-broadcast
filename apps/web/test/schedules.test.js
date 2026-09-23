import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Schedules from '../src/routes/Schedules.svelte';

describe('Schedules & Calendar Component', () => {
  it('renders calendar title, telemetry cards, and workday legend', () => {
    render(Schedules);

    // Title
    expect(screen.getByText('Kalender Diseminasi & Sinkronisasi Libur Nasional')).toBeTruthy();

    // Telemetry Card Headings
    expect(screen.getByText('Total Siaran Terjadwal Bulan Ini')).toBeTruthy();
    expect(screen.getByText('Hari Libur & Cuti Bersama')).toBeTruthy();
    expect(screen.getByText('Proteksi Siaran Hari Kerja')).toBeTruthy();
    expect(screen.getByText('Sinkronisasi Rilis BRS Nasional')).toBeTruthy();

    // Action buttons
    expect(screen.getByText('Sinkronkan SKB')).toBeTruthy();
    expect(screen.getByText('Tambah Exception / Libur')).toBeTruthy();

    // Legend items
    expect(screen.getByText('Libur & Cuti Bersama (Bypass)')).toBeTruthy();
    expect(screen.getByText('Akhir Pekan (Standby)')).toBeTruthy();
  });
});
