export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Access denied. Insufficient permissions.",
        requiredRoles: roles,
        userRole: req.user.role,
      });
    }

    next();
  };
}

export const isAdmin = requireRole("ADMIN");
export const isUser = requireRole("USER", "ADMIN");

