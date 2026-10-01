export default function UserAvatar({ name, size = 34, title }) {
  const firstLetter = Array.from(String(name || "").trim())[0]?.toLocaleUpperCase();
  return (
    <span
      aria-label={title || name || "User"}
      title={title || name || "User"}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--accent-blue-soft)",
        border: "1px solid var(--accent-blue)",
        color: "var(--accent-blue-bright)",
        fontSize: Math.max(12, Math.round(size * 0.44)),
        fontWeight: 700,
        lineHeight: 1,
        userSelect: "none",
      }}
    >
      {firstLetter || "?"}
    </span>
  );
}
