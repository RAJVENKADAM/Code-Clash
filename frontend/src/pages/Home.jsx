import { Link } from "react-router-dom";
import { ArrowRight, FileText, Flag, KeyRound, PlusCircle, Swords, Users } from "lucide-react";

const cards = [
  {
    icon: PlusCircle,
    title: "Create a battle room",
    text: "Publish your own test, choose supported languages, set capacity and time limits, and define exactly how suspicious activity is handled.",
    action: "Create room",
    to: "/battle-room/create",
  },
  {
    icon: KeyRound,
    title: "Join with a room key",
    text: "Participants do not need accounts. Share the six-character key and let students enter under the restrictions set by the room owner.",
    action: "Join a room",
    to: "/battle-room",
  },
  {
    icon: FileText,
    title: "Review every submission",
    text: "Owners get participant results, question scores, execution details, flags, and leaderboard data after or during the battle.",
    action: "Open rooms",
    to: "/battle-room",
  },
];

export default function Home() {
  return (
    <div className="home-page" style={{ padding: "48px clamp(20px, 4vw, 64px)", width: "100%", margin: "0 auto", fontFamily: "var(--font-ui)" }}>
      <section style={{ padding: "42px 40px", background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: 16, marginBottom: 24 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--accent-blue-bright)", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>
          <Swords size={16} /> Hackathon battle hosting
        </div>
        <h1 style={{ color: "var(--text-primary)", fontSize: 40, lineHeight: 1.1, margin: "0 0 14px", maxWidth: 720 }}>
          Publish a test. Start a battle. Let the owner decide.
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15, lineHeight: 1.7, maxWidth: 720, margin: "0 0 24px" }}>
          CodeClash is a lightweight battle-room platform for startups and hackathons. No login wall, no daily challenges, and no automatic disciplinary decisions: room owners control the rules and review the evidence.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to="/battle-room/create" className="btn-primary" style={{ textDecoration: "none", display: "inline-flex" }}>
            Create a battle room <ArrowRight size={15} />
          </Link>
          <Link to="/battle-room" className="btn-secondary" style={{ textDecoration: "none", display: "inline-flex" }}>
            Join with a key <KeyRound size={15} />
          </Link>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginBottom: 24 }}>
        {cards.map(({ icon: Icon, title, text, action, to }) => (
          <div key={title} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 22 }}>
            <Icon size={20} color="var(--accent-blue-bright)" />
            <h2 style={{ color: "var(--text-primary)", fontSize: 16, margin: "16px 0 8px" }}>{title}</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6, minHeight: 84, margin: "0 0 14px" }}>{text}</p>
            <Link to={to} style={{ color: "var(--accent-blue-bright)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>{action} <ArrowRight size={13} style={{ verticalAlign: "middle" }} /></Link>
          </div>
        ))}
      </div>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 22 }}>
          <h2 style={{ color: "var(--text-primary)", fontSize: 15, margin: "0 0 14px" }}>Owner controls</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.7, margin: 0 }}>
            Choose <strong>immediate disqualify</strong> (keep evidence and exit) or <strong>flag in data</strong> (keep everything for review). The platform records facts; it never makes the decision for you.
          </p>
        </div>
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 22 }}>
          <h2 style={{ color: "var(--text-primary)", fontSize: 15, margin: "0 0 14px", display: "flex", gap: 8, alignItems: "center" }}><Users size={16} /> Built for repeatable events</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.7, margin: 0 }}>
            Reuse a finished battle with the same questions, select fresh restrictions, and run another cohort without rebuilding the test.
          </p>
        </div>
      </section>

      <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 12, marginTop: 20 }}>
        <Flag size={14} /> Every participant submission remains visible to the room owner for transparent review.
      </div>
    </div>
  );
}
