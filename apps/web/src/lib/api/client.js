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

  const isBrowser = typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http');
  const origin = isBrowser ? window.location.origin : 'http://localhost:3000';
  let fullPath = path;
  if (!fullPath.startsWith('http')) {
    if (!fullPath.startsWith('/api')) {
      fullPath = `/api${fullPath.startsWith('/') ? fullPath : '/' + fullPath}`;
    }
    fullPath = `${origin}${fullPath}`;
  }

  const response = await fetch(fullPath, {
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

export const api = {
  get(path, params) {
    let query = '';
    if (params) {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
          sp.append(k, v);
        }
      }
      const qs = sp.toString();
      if (qs) query = (path.includes('?') ? '&' : '?') + qs;
    }
    return apiFetch(path + query, { method: 'GET' });
  },
  post(path, data) {
    return apiFetch(path, { method: 'POST', body: JSON.stringify(data) });
  },
  put(path, data) {
    return apiFetch(path, { method: 'PUT', body: JSON.stringify(data) });
  },
  patch(path, data) {
    return apiFetch(path, { method: 'PATCH', body: JSON.stringify(data) });
  },
  delete(path) {
    return apiFetch(path, { method: 'DELETE' });
  }
};
