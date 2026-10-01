import { useAuth } from "../context/AuthContext";
import UserAvatar from "../components/user/UserAvatar";

export default function Profile() {
  const { user } = useAuth();
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
      <section
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-color)",
          borderRadius: 12,
          padding: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <UserAvatar name={user?.name} size={52} />
          <div>
            <h1 style={{ color: "var(--text-primary)", fontSize: 20, margin: 0 }}>
              {user?.name || "Your profile"}
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "5px 0 0" }}>
              Account profile
            </p>
          </div>
        </div>
        <dl style={{ display: "grid", gridTemplateColumns: "minmax(120px, 180px) 1fr", gap: "14px 18px", margin: 0, fontSize: 13 }}>
          <dt style={{ color: "var(--text-muted)" }}>Email</dt>
          <dd style={{ color: "var(--text-primary)", margin: 0, overflowWrap: "anywhere" }}>{user?.email || "—"}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Organization</dt>
          <dd style={{ color: "var(--text-primary)", margin: 0 }}>{user?.organization || "—"}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Account status</dt>
          <dd style={{ color: "var(--color-success)", margin: 0 }}>{user?.isVerified ? "Verified" : "Unverified"}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Role</dt>
          <dd style={{ color: "var(--text-primary)", margin: 0 }}>{user?.role || "USER"}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Member since</dt>
          <dd style={{ color: "var(--text-primary)", margin: 0 }}>
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
          </dd>
        </dl>
      </section>
    </main>
  );
}
