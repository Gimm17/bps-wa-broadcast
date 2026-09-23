import { verifyCsrfToken } from '../features/auth/service.js';

export function validateCsrf(req, res, next) {
  // Non-mutating methods do not require CSRF
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // If request is not authenticated via session, CSRF check is bypassed or handled separately
  if (!req.session || !req.session.tokenHash) {
    return next();
  }

  const providedToken = req.get('x-csrf-token');
  if (!providedToken) {
    return res.status(403).json({
      error: {
        code: 'CSRF_INVALID',
        message: 'Token CSRF tidak ditemukan',
        correlationId: req.correlationId
      }
    });
  }

  const isValid = verifyCsrfToken(req.session.tokenHash, providedToken);
  if (!isValid) {
    return res.status(403).json({
      error: {
        code: 'CSRF_INVALID',
        message: 'Token CSRF tidak valid',
        correlationId: req.correlationId
      }
    });
  }

  next();
}
