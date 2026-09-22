import { Link, useLocation } from "react-router-dom";
import { Code2, Home, Swords } from "lucide-react";

const NAV_LINKS = [
  { path: "/", label: "Home", icon: Home },
  { path: "/battle-room", label: "Battle Room", icon: Swords },
];

export default function Navbar() {
  const location = useLocation();

  return (
    <nav
      style={{
        background: "var(--bg-elevated)",
        borderBottom: "1px solid var(--border-color)",
        padding: "0 24px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: "var(--font-ui)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        <Link
          to="/"
          style={{
            color: "var(--accent-blue-bright)",
            fontSize: 18,
            fontWeight: 700,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            letterSpacing: "-0.5px",
          }}
        >
<Code2 size={22} />
          <span>CodeClash</span>
        </Link>

        <div style={{ display: "flex", gap: 2 }}>
          {NAV_LINKS.map((link) => {
            const isActive = location.pathname === link.path ||
              (link.path !== "/" && location.pathname.startsWith(link.path));
            const Icon = link.icon;
            return (
              <Link
                key={link.path}
                to={link.path}
                style={{
                  padding: "7px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  textDecoration: "none",
                  color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                  background: isActive ? "var(--accent-blue-soft)" : "transparent",
                  transition: "all 0.15s",
                  fontWeight: isActive ? 600 : 400,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon size={16} />
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
        Open participation · Owner-controlled rules
      </div>
    </nav>
  );
}
