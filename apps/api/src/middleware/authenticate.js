import { validateSession } from '../features/auth/service.js';

export async function authenticate(req, res, next) {
  let token = null;

  if (req.cookies && req.cookies.bps_session) {
    token = req.cookies.bps_session;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }

  if (!token) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Sesi tidak valid atau telah berakhir',
        correlationId: req.correlationId
      }
    });
  }

  try {
    const sessionData = await validateSession(token);
    if (!sessionData) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Sesi tidak valid atau telah berakhir',
          correlationId: req.correlationId
        }
      });
    }

    req.user = sessionData.user;
    req.session = sessionData.session;
    req.csrfToken = sessionData.csrfToken;
    next();
  } catch (err) {
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Gagal memverifikasi sesi',
        correlationId: req.correlationId
      }
    });
  }
}
