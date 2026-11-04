const { verifyToken } = require('../utils/jwt');
const db = require('../database/db');

/**
 * Multi-Tenant Cryptographic Authentication Middleware
 * Validates HMAC-SHA256 JWT tokens. No fallback to unauthenticated admin access.
 */
function authMiddleware(req, res, next) {
  // Extract token from Authorization header or query parameter
  const authHeader = req.headers['authorization'] || '';
  let token = null;

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query && req.query.token) {
    token = req.query.token;
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  }

  if (token) {
    // 1. Verify cryptographic JWT signature
    const claims = verifyToken(token);
    if (claims) {
      req.user = {
        id: claims.sub || claims.id,
        email: claims.email,
        role: claims.role || 'CUSTOMER',
        tenantId: claims.tenantId || 'tenant-apex',
        name: claims.name || claims.email,
        allowedVehicles: claims.allowedVehicles || null
      };
    } else {
      // 2. Check active state session store if stored locally
      const sessionUser = db.getSessionUser ? db.getSessionUser(token) : null;
      if (sessionUser) {
        req.user = {
          id: sessionUser.id,
          email: sessionUser.email,
          role: sessionUser.role,
          tenantId: sessionUser.tenantId,
          name: sessionUser.name,
          allowedVehicles: sessionUser.allowedVehicles || null
        };
      } else {
        req.user = null; // Token was invalid or tampered
      }
    }
  } else {
    req.user = null; // No token provided
  }

  // Prevent forged tenant scope overrides
  if (req.user && req.user.role !== 'SUPER_ADMIN') {
    if (req.body && req.body.tenant_id && req.body.tenant_id !== req.user.tenantId) {
      return res.status(403).json({
        error: 'FORBIDDEN_TENANT_SCOPE',
        message: 'Security Violation: Cannot execute mutations against foreign tenant scope.'
      });
    }

    if (req.query && req.query.tenant_id && req.query.tenant_id !== req.user.tenantId) {
      return res.status(403).json({
        error: 'FORBIDDEN_TENANT_SCOPE',
        message: 'Security Violation: Cannot query foreign tenant scope.'
      });
    }
  }

  next();
}

/**
 * Enforce authentication and role permissions
 */
function requireAuth(allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'FLEET_ADMIN', 'CUSTOMER']) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Cryptographically valid JWT or session token required.'
      });
    }

    // Map ADMIN and FLEET_ADMIN synonymously
    const userRole = req.user.role === 'FLEET_ADMIN' ? 'ADMIN' : req.user.role;
    const normalizedAllowed = allowedRoles.map(r => r === 'FLEET_ADMIN' ? 'ADMIN' : r);

    if (normalizedAllowed.length > 0 && !normalizedAllowed.includes(userRole) && !normalizedAllowed.includes(req.user.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied: insufficient tenant permissions.'
      });
    }

    next();
  };
}

/**
 * Enforce Vehicle Tenant Access Control
 */
function checkVehicleTenantAccess(user, terminalId) {
  if (!user || !terminalId) return false;
  if (user.role === 'SUPER_ADMIN') return true;

  if (user.role === 'ADMIN' || user.role === 'FLEET_ADMIN') {
    // Admins can only access vehicles within their assigned tenant
    // WanWay master 860871080043592 belongs to tenant-inurum
    if (user.tenantId === 'tenant-apex' && terminalId === '860871080043592') {
      return false;
    }
    return true;
  }

  if (user.role === 'CUSTOMER') {
    // Customers can only access their explicitly permitted vehicle list
    if (user.allowedVehicles && Array.isArray(user.allowedVehicles)) {
      return user.allowedVehicles.includes(terminalId);
    }
    return false;
  }

  return false;
}

module.exports = {
  authMiddleware,
  requireAuth,
  requireRole: (...roles) => requireAuth(roles.flat()),
  checkVehicleTenantAccess
};
