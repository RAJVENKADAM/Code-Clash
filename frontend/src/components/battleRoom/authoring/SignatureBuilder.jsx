import { useMemo, useState } from "react";
import { Braces, PlusCircle, Trash2, Wand2, Loader2, FunctionSquare } from "lucide-react";
import {
  RETURN_TYPE_GROUPS,
  PARAMETER_TYPE_GROUPS,
  PROBLEM_TYPES,
} from "../../../utils/constants";
import { generateSignature, generateStarterCode } from "../../../services/battleRoomService";

const inputStyle = {
  width: "100%",
  background: "var(--bg-main)",
  border: "1px solid var(--border-color)",
  borderRadius: 6,
  padding: "8px 12px",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "var(--font-ui)",
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

// Type groups rendered as optgroups, with an <option> per type.
const TypeSelect = ({ groups, value, onChange, placeholder }) => (
  <select
    value={value || ""}
    onChange={(e) => onChange(e.target.value)}
    style={{ ...inputStyle, cursor: "pointer", fontFamily: "var(--font-code)" }}
  >
    {(!value || !groups.some((g) => g.types.includes(value))) && (
      <option value="" disabled>
        {placeholder}
      </option>
    )}
    {groups.map((group) => (
      <optgroup key={group.label} label={group.label}>
        {group.types.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </optgroup>
    ))}
  </select>
);

/**
 * Signature Builder (Steps 2 & 3 of the new question workflow).
 *
 * The author never types a raw signature. Instead they provide:
 *   - Function name
 *   - Return type (dropdown with grouped supported types)
 *   - Parameters (dynamic builder: name + type per parameter)
 *
 * The backend generates the canonical Java signature and starter code.
 */
export default function SignatureBuilder({
  functionName,
  returnType,
  parameters,
  signaturePreview,
  signature,
  problemType,
  onProblemTypeChange,
  onChange,
  onSignatureGenerated,
}) {
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [starterPreview, setStarterPreview] = useState("");

  const paramsList = useMemo(
    () => (Array.isArray(parameters) ? parameters : []),
    [parameters],
  );

  const canGenerate = useMemo(() => {
    return (
      (functionName || "").trim() !== "" &&
      (returnType || "").trim() !== "" &&
      paramsList.length > 0 &&
      paramsList.every((p) => (p.name || "").trim() !== "" && (p.type || "").trim() !== "")
    );
  }, [functionName, returnType, paramsList]);

  const updateParam = (index, field, value) => {
    const next = paramsList.map((p, i) => (i === index ? { ...p, [field]: value } : p));
    onChange({ functionName, returnType, parameters: next });
  };

  const addParam = () => {
    onChange({ functionName, returnType, parameters: [...paramsList, { name: "", type: "int" }] });
  };

  const removeParam = (index) => {
    onChange({ functionName, returnType, parameters: paramsList.filter((_, i) => i !== index) });
  };

  const handleGenerate = async () => {
    if (!canGenerate) {
      setGenError("Provide a function name, return type, and at least one complete parameter.");
      return;
    }
    setGenError("");
    setGenerating(true);
    setStarterPreview("");
    try {
      const data = await generateSignature(
        (functionName || "").trim(),
        returnType,
        paramsList.map((p) => ({ name: (p.name || "").trim(), type: p.type })),
      );
      onChange({
        functionName: data.functionName || functionName,
        returnType: data.returnType || returnType,
        parameters: data.parameters || paramsList,
        signature: data.signature,
        signaturePreview: data.signaturePreview,
      });
      if (onSignatureGenerated) onSignatureGenerated(data);
    } catch (err) {
      setGenError(err.message || "Failed to generate signature. Check the function definition.");
    } finally {
      setGenerating(false);
    }
  };

  const handlePreviewStarter = async () => {
    if (!signature || !signature.name) {
      setGenError("Generate the signature first.");
      return;
    }
    setGenError("");
    setGenerating(true);
    try {
      const data = await generateStarterCode("", {}, "java", signature);
      setStarterPreview(data.starterCodeByLanguage?.java || "");
    } catch (err) {
      setGenError(err.message || "Failed to generate starter code.");
    } finally {
      setGenerating(false);
    }
  };

  // The endpoint returns signature previews keyed by language for compatibility.
  const previews = signaturePreview || {};
  const activePreview = previews.java || "";

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* Problem Type selector (kept for category-style tagging) */}
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

      {/* Step 2 — Function name + return type */}
      <div style={{ border: "1px solid var(--border-color)", borderRadius: 10, padding: 16, background: "var(--bg-card)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <FunctionSquare size={14} color="var(--accent-blue-bright)" />
          <span style={{ color: "var(--text-primary)", fontSize: 13, fontFamily: "var(--font-ui)", fontWeight: 600 }}>
            Function Signature
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-ui)", marginLeft: "auto" }}>
            Step 2 · Name + Return Type
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Function Name *</label>
            <input
              type="text"
              value={functionName || ""}
              onChange={(e) => onChange({ functionName: e.target.value, returnType, parameters: paramsList })}
              placeholder="e.g. twoSum"
              style={{ ...inputStyle, fontFamily: "var(--font-code)" }}
            />
          </div>
          <div>
            <label style={labelStyle}>Return Type *</label>
            <TypeSelect
              groups={RETURN_TYPE_GROUPS}
              value={returnType || ""}
              onChange={(val) => onChange({ functionName, returnType: val, parameters: paramsList })}
              placeholder="Select return type…"
            />
          </div>
        </div>
      </div>

      {/* Step 3 — Parameter builder */}
      <div style={{ border: "1px solid var(--border-color)", borderRadius: 10, padding: 16, background: "var(--bg-card)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Braces size={14} color="var(--accent-blue-bright)" />
          <span style={{ color: "var(--text-primary)", fontSize: 13, fontFamily: "var(--font-ui)", fontWeight: 600 }}>
            Parameters
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-ui)", marginLeft: "auto" }}>
            Step 3 · Dynamic Builder
          </span>
        </div>

        {(paramsList.length === 0) && (
          <p style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-code)", margin: "0 0 10px" }}>
            Each parameter gets its own name + type. Example: <span style={{ color: "var(--accent-blue-bright)" }}>nums / int[]</span>
          </p>
        )}

        {paramsList.map((p, index) => (
          <div
            key={index}
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1.5fr 34px",
              gap: 8,
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div>
              <label style={{ ...labelStyle, fontSize: 10, marginBottom: 4 }}>Parameter Name</label>
              <input
                type="text"
                value={p.name || ""}
                onChange={(e) => updateParam(index, "name", e.target.value)}
                placeholder="e.g. nums"
                style={{ ...inputStyle, fontFamily: "var(--font-code)" }}
              />
            </div>
            <div>
              <label style={{ ...labelStyle, fontSize: 10, marginBottom: 4 }}>Parameter Type</label>
              <TypeSelect
                groups={PARAMETER_TYPE_GROUPS}
                value={p.type || ""}
                onChange={(val) => updateParam(index, "type", val)}
                placeholder="Select type…"
              />
            </div>
            <button
              onClick={() => removeParam(index)}
              title="Remove parameter"
              style={{ background: "none", border: "none", color: "var(--color-danger)", cursor: "pointer", display: "flex", padding: 4, marginTop: 18 }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        <button
          onClick={addParam}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px dashed var(--accent-blue)",
            background: "transparent",
            color: "var(--accent-blue-bright)",
            fontSize: 12,
            fontFamily: "var(--font-ui)",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <PlusCircle size={13} />
          Add Parameter
        </button>
      </div>

      {/* Generate signature */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={handleGenerate}
          disabled={generating || !canGenerate}
          className="btn-primary"
          style={{ padding: "8px 20px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, opacity: canGenerate ? 1 : 0.5 }}
        >
          {generating ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Wand2 size={14} />}
          {generating ? "Generating..." : "Generate Signature"}
        </button>
        <span style={{ fontSize: 11, fontFamily: "var(--font-code)", color: "var(--text-muted)" }}>
          The platform generates Java signatures automatically.
        </span>
      </div>

      {genError && (
        <div style={{ padding: "8px 12px", background: "rgba(218,54,51,0.08)", border: "1px solid rgba(218,54,51,0.3)", borderRadius: 6, color: "var(--color-danger)", fontSize: 12, fontFamily: "var(--font-ui)" }}>
          {genError}
        </div>
      )}

      {/* Signature previews */}
      {signature && signature.name && (
        <div>
          <label style={labelStyle}>Java Signature (read-only)</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            <span
              style={{
                padding: "4px 12px",
                borderRadius: 5,
                border: "1px solid var(--accent-blue)",
                background: "var(--accent-blue-soft)",
                color: "var(--accent-blue-bright)",
                fontSize: 11,
                fontFamily: "var(--font-ui)",
                fontWeight: 600,
              }}
            >
              Java
            </span>
            <button
              onClick={handlePreviewStarter}
              className="btn-secondary"
              style={{ padding: "4px 12px", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}
            >
              <Wand2 size={12} />
              Preview Starter
            </button>
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
              minHeight: 60,
              maxHeight: 240,
              overflow: "auto",
            }}
          >
            {starterPreview || activePreview || "// Java signature"}
          </pre>
        </div>
      )}
    </div>
  );
}
