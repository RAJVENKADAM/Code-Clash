import { useState } from "react";
import { FlaskConical, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { AUTHORING_LANGUAGES } from "../../../utils/constants";
import { generateExpectedOutputs } from "../../../services/battleRoomService";

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
 * Reference Solution Editor.
 *
 * The admin uploads ONE correct reference solution. The backend executes it
 * against every visible and hidden test case input, auto-generates the
 * expected outputs, and stores ONLY the outputs — the reference solution is
 * never executed during a contest.
 */
export default function ReferenceSolutionEditor({
  question,
  onChange,
  onOutputsGenerated,
}) {
  const [language, setLanguage] = useState(question.referenceSolutionLanguage || AUTHORING_LANGUAGES[0].id);
  const [code, setCode] = useState(question.referenceSolution || "");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleLanguageChange = (langId) => {
    setLanguage(langId);
    if (onChange) {
      onChange({ ...question, referenceSolutionLanguage: langId, referenceSolution: code });
    }
  };

  const handleCodeChange = (val) => {
    setCode(val);
    if (onChange) {
      onChange({ ...question, referenceSolution: val, referenceSolutionLanguage: language });
    }
  };

  const handleGenerate = async () => {
    if (!code || !code.trim()) {
      setError("Paste the reference solution first.");
      return;
    }
const hasParams = (tc) =>
      tc.parameterValues &&
      Object.keys(tc.parameterValues || {}).length > 0 &&
      Object.values(tc.parameterValues || {}).some((v) => v !== undefined && v !== null && String(v).trim() !== "");
    const hasVisible = (question.visibleTestCases || []).some((tc) => hasParams(tc) || (tc.input && tc.input.trim()));
    const hasHidden = (question.hiddenTestCases || []).some((tc) => hasParams(tc) || (tc.input && tc.input.trim()));
    if (!hasVisible || !hasHidden) {
      setError("Add at least one visible and one hidden test case (parameter values) before generating outputs.");
      return;
    }

    setError("");
    setGenerating(true);
    setResult(null);

    try {
      const payload = {
        ...question,
        referenceSolution: code,
        referenceSolutionLanguage: language,
      };
      const data = await generateExpectedOutputs(payload);

      setResult({
        visibleCount: data.visibleTestCases?.length || question.visibleTestCases?.length || 0,
        hiddenCount: data.hiddenTestCases?.length || question.hiddenTestCases?.length || 0,
        accepted: data.accepted,
        message: data.message,
      });

      // Merge the generated expected outputs into the question.
      const merged = { ...question, referenceSolution: code, referenceSolutionLanguage: language };
      if (data.visibleTestCases) {
        merged.visibleTestCases = data.visibleTestCases;
      }
      if (data.hiddenTestCases) {
        merged.hiddenTestCases = data.hiddenTestCases;
      }
      if (onChange) onChange(merged);
      if (onOutputsGenerated) onOutputsGenerated(data);
    } catch (err) {
      setError(err.message || "Failed to generate expected outputs. Check the reference solution and test case inputs.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 5 }}>
          <FlaskConical size={12} />
          Reference Solution (correct answer)
        </label>
        <p style={{ color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-ui)", margin: "0 0 6px" }}>
          One correct solution in any supported language. The backend runs it against every
          visible + hidden input to generate expected outputs and stores only the outputs.
        </p>

        <div style={{ marginBottom: 8 }}>
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer", maxWidth: 200, fontFamily: "var(--font-ui)" }}
          >
            {AUTHORING_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>

        <textarea
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          placeholder={`Paste the complete correct solution here.\n\nExample (Python):\nclass Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        for i, n in enumerate(nums):\n            if target - n in seen:\n                return [seen[target - n], i]\n            seen[n] = i\n        return []`}
          rows={14}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, background: "var(--bg-elevated)" }}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary"
            style={{ padding: "8px 20px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
          >
            {generating ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <FlaskConical size={14} />}
            {generating ? "Executing..." : "Generate Expected Outputs"}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(218,54,51,0.08)", border: "1px solid rgba(218,54,51,0.3)", borderRadius: 6, color: "var(--color-danger)", fontSize: 12, fontFamily: "var(--font-ui)", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={13} />
            {error}
          </div>
        )}

        {result && (
          <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 6, border: `1px solid ${result.accepted ? "rgba(46,160,67,0.4)" : "rgba(218,54,51,0.4)"}`, background: result.accepted ? "rgba(46,160,67,0.06)" : "rgba(218,54,51,0.06)", fontSize: 12, fontFamily: "var(--font-ui)", display: "flex", alignItems: "center", gap: 8, color: result.accepted ? "var(--color-success)" : "var(--color-danger)" }}>
            {result.accepted ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <div>
              <strong>{result.message || (result.accepted ? "Expected outputs generated" : "Reference solution failed some test cases")}</strong>
              <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                Visible: {result.visibleCount} • Hidden: {result.hiddenCount}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

