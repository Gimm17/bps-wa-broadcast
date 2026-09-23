import { ROLES } from '@bps/shared';

export function authorize(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Sesi tidak valid',
          correlationId: req.correlationId
        }
      });
    }

    const isSuperAdmin = req.user.roles && req.user.roles.includes(ROLES.SUPER_ADMIN);
    const hasPermission = req.user.permissions && req.user.permissions.includes(permission);

    if (isSuperAdmin || hasPermission) {
      return next();
    }

    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Akses ditolak: izin tidak mencukupi',
        correlationId: req.correlationId
      }
    });
  };
}
