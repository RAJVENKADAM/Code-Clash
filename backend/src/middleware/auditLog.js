import AuditLog from "../models/AuditLog.js";

export function auditLog(action, options = {}) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      const status = res.statusCode >= 200 && res.statusCode < 300 ? "SUCCESS" : "FAILURE";
      const severity =
        res.statusCode >= 500
          ? "ERROR"
          : res.statusCode >= 400
          ? "WARN"
          : "INFO";

      const logEntry = {
        userId: req.userId || req.user?._id,
        action,
        resource: options.resource || req.path,
        resourceId: req.params?.id || body?.submissionId || body?.challenge?._id,
        details: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          ...(options.includeBody ? { body: req.body } : {}),
          ...(options.includeQuery ? { query: req.query } : {}),
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers["user-agent"] || "",
        requestId: req.requestId,
        status,
        severity,
      };

      AuditLog.create(logEntry).catch((err) => {
        console.error("[AuditLog] Failed to create audit log:", err.message);
      });

      return originalJson(body);
    };
    next();
  };
}

// Shortcut middleware for common actions
export const auditLogin = auditLog("USER_LOGIN", { resource: "/api/auth/verify-otp", includeBody: false });
export const auditLogout = auditLog("USER_LOGOUT", { resource: "/api/auth/logout" });
export const auditSubmit = auditLog("SUBMISSION_CREATE", { resource: "/api/submissions", includeBody: true });
export const auditChallengeCreate = auditLog("CHALLENGE_CREATE", { resource: "/api/challenges", includeBody: true });
export const auditChallengeUpdate = auditLog("CHALLENGE_UPDATE", { resource: "/api/challenges", includeBody: true });
export const auditChallengeDelete = auditLog("CHALLENGE_DELETE", { resource: "/api/challenges" });
