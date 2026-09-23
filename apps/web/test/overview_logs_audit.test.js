import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Overview from '../src/routes/Overview.svelte';
import MessageLogs from '../src/routes/MessageLogs.svelte';
import AuditLog from '../src/routes/AuditLog.svelte';
import HealthStrip from '../src/lib/components/HealthStrip.svelte';

describe('Observability & Operational UI Screens', () => {
  it('renders HealthStrip with connector indicators', () => {
    render(HealthStrip);
    expect(screen.getByText('Meta WABA:')).toBeTruthy();
    expect(screen.getByText('Cron Worker:')).toBeTruthy();
    expect(screen.getByText('SIMPEG Presensi:')).toBeTruthy();
    expect(screen.getByText('Silastik PST:')).toBeTruthy();
  });

  it('renders Overview screen with KPIs, action buttons, and trend section', () => {
    render(Overview);
    expect(screen.getByText('Pusat Komando Siaran WhatsApp Resmi')).toBeTruthy();
    expect(screen.getByText('Total Pesan Diproses')).toBeTruthy();
    expect(screen.getByText('Tingkat Keterbacaan (Read Rate)')).toBeTruthy();
    expect(screen.getByText('Antrean Siap Kirim (Backlog)')).toBeTruthy();
    expect(screen.getByText('Gagal & Ditekan (Opt-Out)')).toBeTruthy();
    expect(screen.getByText('Tren Pengiriman 14 Hari Terakhir (WITA)')).toBeTruthy();
  });

  it('renders MessageLogs screen with export action and filter controls', () => {
    render(MessageLogs);
    expect(screen.getByText('Log & Jejak Pengiriman Pesan')).toBeTruthy();
    expect(screen.getByText('Ekspor CSV (Aman)')).toBeTruthy();
    expect(screen.getByText('Semua Status')).toBeTruthy();
  });

  it('renders AuditLog screen with immutable audit trail heading', () => {
    render(AuditLog);
    expect(screen.getByText('Jejak Audit & Aktivitas Sistem')).toBeTruthy();
    expect(screen.getByText('Immutable Audit Trail')).toBeTruthy();
  });
});
