import { writable } from 'svelte/store';
import { apiFetch, setCsrfToken } from '../api/client.js';

export const session = writable({
  user: null,
  isAuthenticated: false,
  isLoading: true
});

export async function initSession() {
  session.update((s) => ({ ...s, isLoading: true }));
  try {
    const data = await apiFetch('/auth/me');
    if (data && data.user) {
      if (data.csrfToken) setCsrfToken(data.csrfToken);
      session.set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false
      });
      return data.user;
    }
  } catch (err) {
    // Not logged in or expired
  }

  session.set({
    user: null,
    isAuthenticated: false,
    isLoading: false
  });
  return null;
}

export async function loginUser({ email, password }) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  if (data && data.csrfToken) {
    setCsrfToken(data.csrfToken);
  }

  session.set({
    user: data.user,
    isAuthenticated: true,
    isLoading: false
  });

  return data;
}

export async function logoutUser() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch (e) {
    // Ignore error on logout
  }

  setCsrfToken('');
  session.set({
    user: null,
    isAuthenticated: false,
    isLoading: false
  });
}
