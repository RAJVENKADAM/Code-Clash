import { getCreatorCredentialClaims } from "../services/creatorVerificationService.js";

export function attachCreatorVerification(req, res, next) {
  const authorization = req.get("authorization") || "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const claims = getCreatorCredentialClaims(
    req.get("x-creator-credential") || bearerToken,
  );
  req.creatorVerified = Boolean(claims);
  if (claims) {
    req.creatorEmail = claims.email;
    req.creatorClaims = claims;
  }
  next();
}
