import { useState } from "react";
import { Braces, Wand2, Loader2, Sparkles } from "lucide-react";
import { PROBLEM_TYPES, AUTHORING_LANGUAGES, SIGNATURE_EXAMPLES, DEFAULT_FUNCTION_SIGNATURE_PLACEHOLDER } from "../../../utils/constants";
import { generateStarterCode } from "../../../services/battleRoomService";

const inputStyle = {
  width: "100%",
  background: "var(--bg-main)",
  border: "1px solid var(--border-color)",
  borderRadius: 6,
  padding: "8px 12px",
  color: "var(--text-primary)",
  fontSize: 12,
  fontFamily: "var(--font-code)",
  boxSizing: "border-box",
  outline: "none",
  transition: "border-color 0.15s",
};

const labelStyle = {
  color: "var(--text-secondary)",
  fontSize: 11,
  fontFamily: "var(--font-ui)",
  display: "block",
  marginBottom: 6,
  fontWeight: 500,
};

/**
 * Problem Type + Function Signature editor.
 *
 * The admin only writes a function signature (e.g. `public int[] twoSum(int[]
 * nums, int target)`). The backend auto-generates starter code for every
 * language from this signature, which is previewed here per-language.
 */
export default function SignatureEditor({
  problemType,
  onProblemTypeChange,
  functionSignature,
  onFunctionSignatureChange,
  starterCodeByLanguage,
  onStarterCodeGenerated,
}) {
  const [activeLang, setActiveLang] = useState(AUTHORING_LANGUAGES[0].id);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [preview, setPreview] = useState({});

  const handleGenerate = async () => {
    if (!functionSignature || !functionSignature.trim()) {
      setGenError("Enter a function signature first (e.g. the example shown below).");
      return;
    }
    setGenError("");
    setGenerating(true);
    try {
      const data = await generateStarterCode(functionSignature, starterCodeByLanguage || {}, activeLang);
      setPreview(data.starterCodeByLanguage || {});
      if (onStarterCodeGenerated) {
        onStarterCodeGenerated({
          functionName: data.functionName || "",
          starterCodeByLanguage: data.starterCodeByLanguage || {},
        });
      }
    } catch (err) {
      setGenError(err.message || "Failed to generate starter code. Check the signature syntax.");
    } finally {
      setGenerating(false);
    }
  };

  const activeLangDef = AUTHORING_LANGUAGES.find((l) => l.id === activeLang);
  const previewCode = preview[activeLang] || starterCodeByLanguage?.[activeLang] || "";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Problem Type selector */}
      <div>
        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 5 }}>
          <Braces size={12} />
          Problem Type
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {PROBLEM_TYPES.map((type) => {
            const active = problemType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => onProblemTypeChange && onProblemTypeChange(type.id)}
                title={type.description}
                style={{
                  padding: "8px 6px",
                  borderRadius: 6,
                  border: `1px solid ${active ? "var(--accent-blue)" : "var(--border-strong)"}`,
                  background: active ? "var(--accent-blue-soft)" : "var(--bg-card)",
                  color: active ? "var(--accent-blue-bright)" : "var(--text-muted)",
                  fontSize: 11,
                  fontFamily: "var(--font-ui)",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "center",
                  lineHeight: 1.3,
                }}
              >
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Function signature */}
      <div>
        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 5 }}>
          <Sparkles size={12} />
          Function Signature
        </label>
        <p style={{ color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-ui)", margin: "0 0 6px" }}>
          Define only the signature — starter code for every language is generated
          automatically by the platform.
        </p>
        <input
          type="text"
          value={functionSignature || ""}
          onChange={(e) => onFunctionSignatureChange && onFunctionSignatureChange(e.target.value)}
          placeholder={DEFAULT_FUNCTION_SIGNATURE_PLACEHOLDER}
          style={{ ...inputStyle, fontSize: 13, padding: "10px 12px" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary"
            style={{ padding: "8px 20px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
          >
            {generating ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Wand2 size={14} />}
            {generating ? "Generating..." : "Generate Starter Code"}
          </button>
          <div style={{ fontSize: 11, fontFamily: "var(--font-code)", color: "var(--text-muted)", alignSelf: "center" }}>
            Example: <span style={{ color: "var(--accent-blue-bright)" }}>{SIGNATURE_EXAMPLES.java}</span>
          </div>
        </div>
        {genError && (
          <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(218,54,51,0.08)", border: "1px solid rgba(218,54,51,0.3)", borderRadius: 6, color: "var(--color-danger)", fontSize: 12, fontFamily: "var(--font-ui)" }}>
            {genError}
          </div>
        )}
      </div>

      {/* Per-language preview */}
      <div>
        <label style={labelStyle}>Starter Code Preview</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {AUTHORING_LANGUAGES.map((lang) => {
            const active = activeLang === lang.id;
            const hasCode = !!((starterCodeByLanguage || {})[lang.id]);
            return (
              <button
                key={lang.id}
                onClick={() => setActiveLang(lang.id)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 5,
                  border: `1px solid ${active ? "var(--accent-blue)" : "var(--border-strong)"}`,
                  background: active ? "var(--accent-blue-soft)" : "var(--bg-card)",
                  color: active ? "var(--accent-blue-bright)" : "var(--text-muted)",
                  fontSize: 11,
                  fontFamily: "var(--font-ui)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {lang.label}
                {hasCode && !active && (
                  <span style={{ color: "var(--color-success)", marginLeft: 4 }}>●</span>
                )}
              </button>
            );
          })}
        </div>
        <pre
          style={{
            margin: 0,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-color)",
            borderRadius: 6,
            padding: "12px 14px",
            color: "var(--text-code)",
            fontSize: 12,
            fontFamily: "var(--font-code)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            minHeight: 80,
            maxHeight: 260,
            overflow: "auto",
          }}
        >
          {previewCode || `// Click "Generate Starter Code" to see the ${activeLangDef?.label || activeLang} starter.\n// Only the signature is required — no full program needed.`}
        </pre>
      </div>
    </div>
  );
}

