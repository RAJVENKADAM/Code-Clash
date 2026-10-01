import { streamBattleRoomCertificate } from "../services/battleRoomCertificateService.js";

export function downloadBattleRoomCertificate(req, res) {
  try {
    streamBattleRoomCertificate(req.params.token, res);
  } catch (error) {
    console.error("[BattleRoomCertificate] Download rejected:", error.message);
    return res.status(400).json({ error: "This certificate link is invalid or has expired." });
  }
}
