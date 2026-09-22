import { useState } from "react";
import { CheckCircle2, XCircle, Clock, Cpu, Terminal, ChevronUp, ChevronDown } from "lucide-react";
import { formatMemory, getStatusColor } from "../../utils/helpers";

function TestCaseRow({ testCase, status, executionTime, memoryUsed }) {
  const color = getStatusColor(status);
  const isPassed = status === "PASSED" || status === "ACCEPTED";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "var(--bg-elevated)",
        border: `1px solid ${color}33`,
        borderRadius: 6,
        padding: "8px 12px",
        fontSize: 12,
        fontFamily: "var(--font-ui)",
      }}
    >
      {isPassed ? (
        <CheckCircle2 size={16} color={color} style={{ flexShrink: 0 }} />
      ) : (
        <XCircle size={16} color={color} style={{ flexShrink: 0 }} />
      )}
      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
        #{testCase}
      </span>
      <span style={{ color, fontWeight: 600, fontSize: 11 }}>{status}</span>
      <div style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "center", color: "var(--text-muted)", fontSize: 11 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Clock size={11} />
          {executionTime}ms
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Cpu size={11} />
          {formatMemory(memoryUsed)}
        </span>
      </div>
    </div>
  );
}

export default function TestCasePanel({ result, isOpen, onToggle }) {
  const [activeTab, setActiveTab] = useState("testcases");

  if (!result) return null;

  const passed = result.passed || 0;
  const total = result.total || 0;
  const results = result.results || [];
  const error = result.error || "";
  const output = result.output || "";
  const accepted = result.accepted || false;

  const allPassed = passed === total && total > 0;

  return (
    <div
      style={{
        borderTop: "1px solid var(--border-color)",
        background: "var(--bg-card)",
        display: "flex",
        flexDirection: "column",
        height: isOpen ? "40%" : "auto",
        minHeight: isOpen ? 200 : 36,
        transition: "height 0.2s ease",
        fontFamily: "var(--font-ui)",
      }}
    >
      {/* Console header */}
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          background: "var(--bg-elevated)",
          borderBottom: isOpen ? "1px solid var(--border-color)" : "none",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isOpen ? (
            <ChevronDown size={14} color="var(--text-muted)" />
          ) : (
            <ChevronUp size={14} color="var(--text-muted)" />
          )}
          <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <Terminal size={13} color="var(--accent-blue-bright)" />
            Console
          </span>
          <span
            style={{
              color: allPassed ? "var(--color-success)" : "var(--color-warning)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {passed}/{total} passed
          </span>
          {result.executionTime > 0 && (
            <span style={{ color: "var(--text-muted)", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={11} />
              {result.executionTime}ms
              <Cpu size={11} />
              {formatMemory(result.memoryUsed)}
            </span>
          )}
        </div>
        {result.status && (
          <span
            className={`status-tag ${accepted ? "accepted" : "failed"}`}
            style={{ color: getStatusColor(result.status) }}
          >
            {accepted ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {result.status}
          </span>
        )}
      </div>

      {isOpen && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Sub-tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--border-color)",
              background: "var(--bg-card)",
              padding: "0 8px",
            }}
          >
            {["testcases", "output", "error"]
              .filter((tab) => (tab === "error" ? error : true))
              .map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`tab-btn ${activeTab === tab ? "active" : ""}`}
                  style={{ fontSize: 12, padding: "6px 14px" }}
                >
                  {tab === "testcases" && "Test Cases"}
                  {tab === "output" && "Output"}
                  {tab === "error" && "Error"}
                  {tab === "error" && error && (
                    <span style={{ color: "var(--color-danger)", marginLeft: 4 }}>
                      ({results.filter((r) => r.status === "ERROR").length || 1})
                    </span>
                  )}
                </button>
              ))}
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: 12, fontFamily: "var(--font-ui)", fontSize: 13 }}>
            {activeTab === "testcases" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {results.length === 0 && (
                  <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 24 }}>
                    No test cases executed yet.
                  </div>
                )}
                {results.map((tc) => (
                  <TestCaseRow
                    key={tc.testCase}
                    testCase={tc.testCase}
                    status={tc.status}
                    executionTime={tc.executionTime}
                    memoryUsed={tc.memoryUsed}
                  />
                ))}
              </div>
            )}

            {activeTab === "output" && (
              <pre
                style={{
                  margin: 0,
                  color: "var(--text-code)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  lineHeight: 1.5,
                  fontFamily: "var(--font-code)",
                }}
              >
                {output || <span style={{ color: "var(--text-muted)" }}>No output generated.</span>}
              </pre>
            )}

            {activeTab === "error" && (
              <pre
                style={{
                  margin: 0,
                  color: "var(--color-danger)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  lineHeight: 1.5,
                  fontFamily: "var(--font-code)",
                }}
              >
                {error || "No errors."}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
