import { Router } from 'express';
import { login, logout } from './service.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validateCsrf } from '../../middleware/csrf.js';
import { config } from '../../config.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, identifier, password } = req.body || {};
    const id = email || identifier;

    const result = await login({
      identifier: id,
      password,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.cookie('bps_session', result.sessionToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      user: result.user,
      csrfToken: result.csrfToken
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          correlationId: req.correlationId
        }
      });
    }
    next(err);
  }
});

authRouter.post('/logout', authenticate, validateCsrf, async (req, res, next) => {
  try {
    const token = req.cookies?.bps_session || req.headers.authorization?.slice(7);
    await logout({
      sessionToken: token,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.clearCookie('bps_session', {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    return res.json({ status: 'ok', message: 'Berhasil keluar' });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', authenticate, (req, res) => {
  return res.json({
    user: req.user,
    csrfToken: req.csrfToken
  });
});

authRouter.get('/csrf', authenticate, (req, res) => {
  return res.json({
    csrfToken: req.csrfToken
  });
});
