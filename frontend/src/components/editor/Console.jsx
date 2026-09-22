import { useState, useRef, useCallback } from "react";
import { formatMemory, getStatusColor } from "../../utils/helpers";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  Terminal,
  ChevronUp,
  ChevronDown,
  GripHorizontal,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";

function TestCaseChip({
  testCase,
  status,
  executionTime,
  memoryUsed,
  output,
  expectedOutput,
  error,
  isHidden,
}) {
  const color = getStatusColor(status);
  const isPassed = status === "PASSED" || status === "ACCEPTED";
  const isError = status === "SYSTEM_ERROR" || status === "ERROR";
  const hasExpected =
    expectedOutput !== undefined &&
    expectedOutput !== null &&
    expectedOutput !== "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        background: "var(--bg-elevated)",
        border: `1px solid ${color}33`,
        borderRadius: 6,
        padding: "8px 12px",
        fontSize: 12,
        fontFamily: "var(--font-ui)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {isPassed ? (
          <CheckCircle2 size={16} color={color} style={{ flexShrink: 0 }} />
        ) : (
          <XCircle size={16} color={color} style={{ flexShrink: 0 }} />
        )}
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          #{testCase}
        </span>
        {isHidden && (
          <span
            style={{
              color: "var(--text-muted)",
              fontSize: 10,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <EyeOff size={11} /> hidden
          </span>
        )}
        <span style={{ color, fontWeight: 600, fontSize: 11 }}>{status}</span>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 14,
            alignItems: "center",
            color: "var(--text-muted)",
            fontSize: 11,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Clock size={11} /> {executionTime}ms
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Cpu size={11} /> {formatMemory(memoryUsed)}
          </span>
        </div>
      </div>
      {hasExpected && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            marginTop: 2,
            padding: "4px 8px",
            background: "rgba(0,0,0,0.15)",
            borderRadius: 4,
            fontSize: 11,
            fontFamily: "var(--font-code)",
          }}
        >
          <div style={{ color: "var(--color-success)" }}>
            Expected:{" "}
            <span style={{ color: "var(--text-primary)" }}>
              {expectedOutput}
            </span>
          </div>
          <div
            style={{
              color: isPassed ? "var(--color-success)" : "var(--color-danger)",
            }}
          >
            Your Output:{" "}
            <span style={{ color: "var(--text-primary)" }}>
              {output || "(empty)"}
            </span>
          </div>
        </div>
      )}
      {isError &&
        (error ||
          (output && output.startsWith("Internal execution error"))) && (
          <div
            style={{
              marginTop: 2,
              padding: "4px 8px",
              background: "rgba(218,54,51,0.1)",
              borderRadius: 4,
              fontSize: 11,
              fontFamily: "var(--font-code)",
              color: "var(--color-danger)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            <AlertTriangle
              size={11}
              style={{ verticalAlign: "middle", marginRight: 4 }}
            />
            {error || output}
          </div>
        )}
    </div>
  );
}

export default function Console({
  result,
  isOpen,
  onToggle,
  height = 260,
  onHeightChange,
}) {
  const [activeTab, setActiveTab] = useState("testcases");
  const [showAll, setShowAll] = useState(false);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const onDragStart = useCallback(
    (e) => {
      e.preventDefault();
      draggingRef.current = true;
      startYRef.current = e.clientY;
      startHeightRef.current = height;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";
    },
    [height],
  );

  const onDragMove = useCallback(
    (e) => {
      if (!draggingRef.current) return;
      const delta = startYRef.current - e.clientY;
      const next = Math.min(
        Math.max(startHeightRef.current + delta, 120),
        window.innerHeight - 200,
      );
      if (onHeightChange) onHeightChange(next);
    },
    [onHeightChange],
  );

  const onDragEnd = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  const passed = result?.passed || 0;
  const failed = result?.failed || 0;
  const total = result?.total || 0;
  const results = result?.results || [];
  const output = result?.output || "";
  const error = result?.error || "";
  const details = result?.details || "";
  const accepted = result?.accepted || false;
  const allPassed = passed === total && total > 0;

  // Split results into visible and hidden test cases.
  const visibleResults = results.filter((r) => !r.isHidden);
  const hiddenResults = results.filter((r) => r.isHidden);

  const visibleLimit = 3;
  const visibleFailing = visibleResults.filter((r) => r.status !== "PASSED");
  const defaultVisible = visibleResults.slice(0, visibleLimit);
  const visibleToShow = showAll
    ? visibleResults
    : (() => {
        const merged = [...defaultVisible];
        for (const f of visibleFailing) {
          if (!merged.some((m) => m.testCase === f.testCase)) {
            merged.push(f);
          }
        }
        return merged;
      })();

  const hiddenFailing = hiddenResults.filter((r) => r.status !== "PASSED");
  const allVisiblePassed =
    visibleResults.length > 0 &&
    visibleResults.every((r) => r.status === "PASSED");
  const showHidden = allVisiblePassed && hiddenFailing.length > 0;
  const hiddenToShow = showHidden ? hiddenFailing : [];

  const hiddenPassed =
    (result?.hiddenPassed ??
      hiddenResults.filter((r) => r.status === "PASSED").length) ||
    0;
  const hiddenFailed = (result?.hiddenFailed ?? hiddenFailing.length) || 0;
  const hasHidden =
    hiddenResults.length > 0 || (result?.hiddenTestCases ?? 0) > 0;

  return (
    <div
      onMouseMove={onDragMove}
      onMouseUp={onDragEnd}
      onMouseLeave={onDragEnd}
      style={{
        borderTop: "1px solid var(--border-color)",
        background: "var(--bg-card)",
        display: "flex",
        flexDirection: "column",
        height: isOpen ? height : "auto",
        minHeight: 40,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {isOpen && (
        <div
          onMouseDown={onDragStart}
          style={{
            height: 6,
            cursor: "row-resize",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border-color)",
            userSelect: "none",
            touchAction: "none",
            flexShrink: 0,
          }}
        >
          <GripHorizontal size={14} color="var(--text-faint)" />
        </div>
      )}
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 16px",
          background: "var(--bg-elevated)",
          borderBottom: isOpen ? "1px solid var(--border-color)" : "none",
          cursor: "pointer",
          userSelect: "none",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isOpen ? (
            <ChevronDown size={14} color="var(--text-muted)" />
          ) : (
            <ChevronUp size={14} color="var(--text-muted)" />
          )}
          <span
            style={{
              color: "var(--text-primary)",
              fontSize: 13,
              fontFamily: "var(--font-ui)",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Terminal size={13} color="var(--accent-blue-bright)" />
            Console
          </span>
          {result && (
            <>
              <span
                style={{
                  color: allPassed
                    ? "var(--color-success)"
                    : "var(--color-warning)",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {passed}/{total} passed
              </span>
              {failed > 0 && (
                <span
                  style={{
                    color: "var(--color-danger)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {failed} failed
                </span>
              )}
            </>
          )}
          {result?.executionTime > 0 && (
            <span
              style={{
                color: "var(--text-muted)",
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Clock size={11} /> {result.executionTime}ms
              <Cpu size={11} /> {formatMemory(result.memoryUsed)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {result?.status && (
            <span
              style={{
                color: getStatusColor(result.status),
                borderColor: `${getStatusColor(result.status)}44`,
                background: `${getStatusColor(result.status)}14`,
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {accepted ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              {result.status}
            </span>
          )}
        </div>
      </div>

      {isOpen && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--border-color)",
              background: "var(--bg-card)",
              padding: "0 8px",
              flexShrink: 0,
            }}
          >
            {["testcases", "output", "error"]
              .filter((tab) => {
                if (tab === "error")
                  return (
                    error ||
                    results.some(
                      (r) =>
                        r.status === "SYSTEM_ERROR" || r.status === "ERROR",
                    )
                  );
                return true;
              })
              .map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`tab-btn ${activeTab === tab ? "active" : ""}`}
                  style={{ fontSize: 12, padding: "6px 14px" }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === "error" && error && (
                    <span
                      style={{ color: "var(--color-danger)", marginLeft: 4 }}
                    >
                      (
                      {results.filter(
                        (r) =>
                          r.status === "ERROR" || r.status === "SYSTEM_ERROR",
                      ).length || 1}
                      )
                    </span>
                  )}
                </button>
              ))}
          </div>

          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: 12,
              fontFamily: "var(--font-ui)",
              fontSize: 13,
            }}
          >
            {activeTab === "testcases" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {results.length === 0 && (
                  <div
                    style={{
                      color: "var(--text-muted)",
                      textAlign: "center",
                      padding: 24,
                    }}
                  >
                    No test cases executed yet.
                  </div>
                )}

                {visibleToShow.map((tc) => (
                  <TestCaseChip
                    key={tc.testCase}
                    testCase={tc.testCase}
                    status={tc.status}
                    executionTime={tc.executionTime}
                    memoryUsed={tc.memoryUsed}
                    output={tc.output}
                    expectedOutput={tc.expectedOutput}
                    error={tc.error || error}
                    isHidden={false}
                  />
                ))}

                {!showAll && visibleResults.length > visibleToShow.length && (
                  <button
                    onClick={() => setShowAll(true)}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border-strong)",
                      color: "var(--accent-blue-bright)",
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontFamily: "var(--font-ui)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Eye size={12} /> Show all {visibleResults.length} visible
                    test cases
                  </button>
                )}

                {hasHidden && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border-color)",
                      background: "var(--bg-elevated)",
                      fontSize: 12,
                      fontFamily: "var(--font-ui)",
                    }}
                  >
                    {allVisiblePassed && hiddenFailing.length === 0 ? (
                      <div
                        style={{
                          color: "var(--color-success)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <CheckCircle2 size={14} />
                        All {hiddenPassed} hidden test cases passed.
                      </div>
                    ) : allVisiblePassed && hiddenFailing.length > 0 ? (
                      <div
                        style={{
                          color: "var(--color-danger)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <AlertTriangle size={14} />
                        You missed {hiddenFailed} hidden test case
                        {hiddenFailed > 1 ? "s" : ""}.
                      </div>
                    ) : (
                      <div style={{ color: "var(--text-muted)" }}>
                        {hiddenPassed} hidden test case
                        {hiddenPassed === 1 ? "" : "s"} passed, {hiddenFailed}{" "}
                        hidden test case{hiddenFailed === 1 ? "" : "s"} failed.
                      </div>
                    )}
                  </div>
                )}

                {hiddenToShow.map((tc) => (
                  <TestCaseChip
                    key={tc.testCase}
                    testCase={tc.testCase}
                    status={tc.status}
                    executionTime={tc.executionTime}
                    memoryUsed={tc.memoryUsed}
                    output={tc.output}
                    expectedOutput={tc.expectedOutput}
                    error={tc.error || error}
                    isHidden={true}
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
                {output || (
                  <span style={{ color: "var(--text-muted)" }}>
                    No output generated.
                  </span>
                )}
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
                {error || details || "No errors."}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
