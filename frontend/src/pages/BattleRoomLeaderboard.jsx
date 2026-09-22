import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
// REMOVED: getPublicLeaderboard
import {
  getRoomLeaderboard,
  closeRoom,
  getUserResult,
} from "../services/battleRoomService";
import BattleRoomShareModal from "../components/battleRoom/BattleRoomShareModal";
import {
  Trophy,
  Medal,
  Clock,
  ArrowLeft,
  Users,
  XCircle,
  Share2,
  Printer,
} from "lucide-react";

function LeaderboardSkeleton() {
  return (
    <div style={{ padding: 16 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 16,
            padding: "10px 0",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          {Array.from({ length: 4 }).map((_, j) => (
            <div
              key={j}
              style={{
                flex: 1,
                height: 14,
                background: "var(--bg-elevated)",
                borderRadius: 4,
                animation: "shimmer 1.5s infinite",
              }}
            />
          ))}
        </div>
      ))}
      <style>{`@keyframes shimmer { 0% { opacity: 0.3; } 50% { opacity: 0.6; } 100% { opacity: 0.3; } }`}</style>
    </div>
  );
}

function getRankDisplay(rank) {
  if (rank === 1)
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Trophy size={16} color="var(--color-warning)" /> #1st
      </div>
    );
  if (rank === 2)
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Medal size={16} color="#c0c0c0" /> #2nd
      </div>
    );
  if (rank === 3)
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Medal size={16} color="#cd7f32" /> #3rd
      </div>
    );
  return "#" + rank;
}

function formatDuration(secs) {
  if (!secs && secs !== 0) return "—";
  secs = Math.round(secs);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function BattleRoomLeaderboard() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreator, setIsCreator] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [myResult, setMyResult] = useState(null);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 3000);
    return () => clearInterval(interval);
  }, [roomCode]);

  // REFACTORED: Removed nested try/catch block referencing the non-existent function
  const fetchLeaderboard = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getRoomLeaderboard(roomCode);
      setRoom(data.room);
      setLeaderboard(data.leaderboard || []);
      setIsCreator(data.isCreator);
    } catch (err) {
      setError(err.message || "Failed to load leaderboard.");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseRoom = async () => {
    if (
      !window.confirm(
        "Are you sure you want to close this battle room? This will end the battle and send results via email to all participants.",
      )
    )
      return;
    setClosing(true);
    try {
      const data = await closeRoom(roomCode);
      alert(data.message || "Room closed! Results sent via email.");
      fetchLeaderboard();
    } catch (err) {
      setError(err.message || "Failed to close room.");
    } finally {
      setClosing(false);
    }
  };

  const handleViewMyResult = async () => {
    try {
      const data = await getUserResult(roomCode);
      setMyResult(data);
      setShowShare(true);
    } catch (err) {
      setError(err.message || "Failed to get your result.");
    }
  };

  return (
    <div
      style={{
        padding: "24px 32px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
        fontFamily: "var(--font-ui)",
      }}
    >
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              color: "var(--text-primary)",
              fontSize: 20,
              fontFamily: "var(--font-ui)",
              margin: "0 0 4px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Battle Room Leaderboard
          </h1>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: 13,
              fontFamily: "var(--font-ui)",
              margin: 0,
            }}
          >
            Room Key:{" "}
            <span
              style={{
                color: "var(--color-warning)",
                fontWeight: 700,
                letterSpacing: 3,
                fontFamily: "var(--font-code)",
              }}
            >
              {roomCode}
            </span>
            {room && room.status ? (
              <span
                style={{
                  marginLeft: 12,
                  color:
                    room.status === "ACTIVE"
                      ? "var(--color-success)"
                      : room.status === "CLOSED"
                        ? "var(--color-danger)"
                        : "var(--color-warning)",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                {room.status}
              </span>
            ) : null}
            {room && room.participantCount > 0 ? (
              <span
                style={{
                  marginLeft: 12,
                  color: "var(--text-muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Users size={13} />
                {room.participantCount} participants
              </span>
            ) : null}
            {room && room.timeLimit ? (
              <span
                style={{
                  marginLeft: 12,
                  color: "var(--text-muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Clock size={13} />
                {room.timeLimit} {room.timeLimitUnit || "minutes"}
              </span>
            ) : null}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isCreator ? (
            <button
              onClick={() => window.print()}
              className="btn-secondary"
              style={{ padding: "8px 16px", fontSize: 12 }}
              title="Use the browser PDF printer to save this owner report"
            >
              <Printer size={13} />
              Export owner report (PDF)
            </button>
          ) : null}
          {isCreator && room && room.status === "ACTIVE" ? (
            <button
              onClick={handleCloseRoom}
              disabled={closing}
              style={{
                background: closing ? "var(--bg-hover)" : "var(--color-danger)",
                color: "#fff",
                border: "none",
                padding: "8px 16px",
                borderRadius: 6,
                fontSize: 12,
                fontFamily: "var(--font-ui)",
                fontWeight: 600,
                cursor: closing ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <XCircle size={13} />
              {closing ? "Closing..." : "End Battle & Send Results"}
            </button>
          ) : null}
          <button
            onClick={handleViewMyResult}
            className="btn-primary"
            style={{ padding: "8px 16px", fontSize: 12 }}
          >
            <Share2 size={13} />
            My Result
          </button>
          <button
            onClick={() => {
              if (
                room &&
                (room.status === "ACTIVE" || room.status === "UPCOMING")
              ) {
                navigate("/battle-room/" + roomCode + "/challenge");
              } else {
                navigate("/battle-room");
              }
            }}
            className="btn-secondary"
            style={{ padding: "8px 16px", fontSize: 12 }}
          >
            <ArrowLeft size={13} />
            {room && room.status === "ACTIVE"
              ? "Back to Battle"
              : "Back to Rooms"}
          </button>
        </div>
      </div>

      {/* Leaderboard table */}
      {loading ? (
        <LeaderboardSkeleton />
      ) : error ? (
        <div style={{ color: "var(--color-danger)" }}>{error}</div>
      ) : (
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-color)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--border-color)",
              color: "var(--text-primary)",
              fontSize: 14,
              fontFamily: "var(--font-ui)",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Trophy size={15} color="var(--color-warning)" />
            Battle Room Leaderboard
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontWeight: 400,
                marginLeft: "auto",
              }}
            >
              {leaderboard.length} participant
              {leaderboard.length === 1 ? "" : "s"}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "50px 1fr 1fr 90px 90px 90px 90px",
              gap: 12,
              padding: "8px 16px",
              borderBottom: "1px solid var(--border-color)",
              background: "var(--bg-card)",
              fontSize: 11,
              fontFamily: "var(--font-ui)",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            <div style={{ textAlign: "center" }}>Rank</div>
            <div>Name</div>
            <div>Organization</div>
            <div style={{ textAlign: "right" }}>Score</div>
            <div style={{ textAlign: "center" }}>Passed</div>
            <div style={{ textAlign: "center" }}>Time</div>
            <div style={{ textAlign: "center" }}>Status</div>
          </div>

          {leaderboard.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: "center",
                color: "var(--text-muted)",
                fontFamily: "var(--font-ui)",
                fontSize: 13,
              }}
            >
              No completed submissions yet. Participants will appear here once
              they finish.
            </div>
          ) : (
            leaderboard.map((row) => (
              <div
                key={row.userId || row.rank}
                style={{
                  display: "grid",
                  gridTemplateColumns: "50px 1fr 1fr 90px 90px 90px 90px",
                  gap: 12,
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border-color)",
                  background: row.isCurrentUser
                    ? "var(--accent-blue-soft)"
                    : "transparent",
                  alignItems: "center",
                  fontSize: 13,
                  fontFamily: "var(--font-ui)",
                }}
              >
                <div
                  style={{
                    color:
                      row.rank <= 3
                        ? "var(--color-warning)"
                        : "var(--text-muted)",
                    fontWeight: row.rank <= 3 ? 700 : 400,
                    textAlign: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  {getRankDisplay(row.rank)}
                </div>
                <div
                  style={{
                    color: row.isCurrentUser
                      ? "var(--accent-blue-bright)"
                      : "var(--text-primary)",
                    fontWeight: row.isCurrentUser ? 600 : 400,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.name}
                  {row.isCurrentUser && (
                    <span
                      style={{
                        color: "var(--text-faint)",
                        fontSize: 10,
                        marginLeft: 6,
                      }}
                    >
                      (you)
                    </span>
                  )}
                </div>
                <div
                  style={{
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.organization}
                </div>
                <div
                  style={{
                    color: "var(--accent-blue-bright)",
                    textAlign: "right",
                    fontWeight: 600,
                  }}
                >
                  {Math.round(row.totalScore)}
                </div>
                <div
                  style={{ color: "var(--text-muted)", textAlign: "center" }}
                >
                  {row.totalPassed}/{row.totalQuestions}
                </div>
                <div
                  style={{ color: "var(--text-muted)", textAlign: "center" }}
                >
                  {formatDuration(row.timeToSolve)}
                </div>
                <div style={{ textAlign: "center" }}>
                  <span
                    style={{
                      color:
                        row.status === "DISQUALIFIED"
                          ? "var(--color-danger)"
                          : "var(--color-success)",
                      fontWeight: 600,
                      fontSize: 11,
                    }}
                  >
                    {row.status === "DISQUALIFIED"
                      ? "Disqualified"
                      : "Completed"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showShare && (
        <BattleRoomShareModal
          isOpen={showShare}
          onClose={() => setShowShare(false)}
          result={myResult}
          roomCode={roomCode}
          userName={myResult?.submission?.participantName}
        />
      )}
    </div>
  );
}
