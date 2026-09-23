let currentCsrfToken = '';

export function setCsrfToken(token) {
  currentCsrfToken = token || '';
}

export function getCsrfToken() {
  return currentCsrfToken;
}

export async function apiFetch(path, options = {}) {
  const headers = {
    'content-type': 'application/json',
    ...(currentCsrfToken ? { 'x-csrf-token': currentCsrfToken } : {}),
    ...options.headers
  };

  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { error: { code: 'HTTP_ERROR', message: response.statusText } };
    }
    throw errorData;
  }

  return response.status === 204 ? null : response.json();
}
