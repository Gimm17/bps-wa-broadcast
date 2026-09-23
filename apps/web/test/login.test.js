import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Login from '../src/routes/Login.svelte';

describe('Login Component', () => {
  it('labels login fields and exposes an error summary', async () => {
    render(Login);

    const emailInput = screen.getByLabelText('Email');
    expect(emailInput).toBeDefined();

    const passwordInput = screen.getByLabelText('Kata sandi');
    expect(passwordInput).toBeDefined();

    const submitBtn = screen.getByRole('button', { name: /Masuk/i });
    expect(submitBtn).toBeDefined();

    await fireEvent.click(submitBtn);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain('Periksa kembali');
  });
});
