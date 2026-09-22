import { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { joinRoom, getMyRooms, getJoinedRooms, shareKey } from "../services/battleRoomService";
import { formatDate } from "../utils/helpers";
import RoomKeyModal from "../components/battleRoom/RoomKeyModal";
import { Swords, PlusCircle, LogIn, Trophy, KeyRound, Loader2, Share2, Copy, Check } from "lucide-react";

function CopyableCode({ code }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <span
      onClick={handleCopy}
      title="Click to copy key"
      style={{
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        color: "var(--color-warning)",
        fontWeight: 700,
        letterSpacing: 2,
        fontFamily: "var(--font-code)",
      }}
    >
      {code}
      {copied ? <Check size={12} color="var(--color-success)" /> : <Copy size={11} style={{ opacity: 0.5 }} />}
    </span>
  );
}

export default function BattleRoom() {
  const navigate = useNavigate();

  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);
  const [participantName, setParticipantName] = useState("");
  const [participantOrganization, setParticipantOrganization] = useState("");
  const [activeTab, setActiveTab] = useState("create-join");
  const [myRooms, setMyRooms] = useState([]);
  const [joinedRooms, setJoinedRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [shareRoom, setShareRoom] = useState(null);
  const [shareRoomCode, setShareRoomCode] = useState("");

  const handleJoin = async () => {
    if (!joinCode.trim()) {
      setJoinError("Please enter a room key.");
      return;
    }

    setJoining(true);
    setJoinError("");

    try {
      if (!participantName.trim() || !participantOrganization.trim()) {
        setJoinError("Enter your name and organisation before joining.");
        setJoining(false);
        return;
      }
      localStorage.setItem("ccp_guest_name", participantName.trim());
      await joinRoom(joinCode.trim().toUpperCase(), {
        name: participantName.trim(),
        organization: participantOrganization.trim(),
      });
      navigate(`/battle-room/${joinCode.trim().toUpperCase()}/challenge`);
    } catch (err) {
      setJoinError(err.message || "Failed to join room. Check the key and try again.");
    } finally {
      setJoining(false);
    }
  };

  const handleViewLeaderboard = async () => {
    if (!joinCode.trim()) {
      setJoinError("Please enter a room key to view leaderboard.");
      return;
    }
    navigate(`/battle-room/${joinCode.trim().toUpperCase()}/leaderboard`);
  };

  const loadMyRooms = async () => {
    setActiveTab("my-rooms");
    setLoadingRooms(true);
    try {
      const data = await getMyRooms();
      setMyRooms(data.rooms || []);
    } catch (err) {
      console.error("Failed to load rooms:", err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const loadJoinedRooms = async () => {
    setActiveTab("joined-rooms");
    setLoadingRooms(true);
    try {
      const data = await getJoinedRooms();
      setJoinedRooms(data.rooms || []);
    } catch (err) {
      console.error("Failed to load joined rooms:", err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleShareKey = useCallback(async (e, room) => {
    e.stopPropagation();
    try {
      const data = await shareKey(room.roomCode);
      setShareRoom(room);
      setShareRoomCode(data.roomKey || room.roomCode);
      setShowKeyModal(true);
    } catch (err) {
      alert(err.message || "Failed to get room key.");
    }
  }, []);

  return (
    <div style={{ padding: "24px 32px", margin: "0 auto", width: "100%", boxSizing: "border-box", fontFamily: "var(--font-ui)" }}>
      <div style={{ marginBottom: 32, padding: "28px 32px", background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: 12 }}>
        <h1 style={{ color: "var(--text-primary)", fontSize: 22, margin: "0 0 8px", fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
          <Swords size={24} color="var(--accent-blue-bright)" />
          Battle Room
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
          Create your own coding war room with custom challenges. Share the key for others to join and compete!
          Rooms are private — only people with the key can join.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid var(--border-color)", paddingBottom: 12 }}>
        {[
          { key: "create-join", label: "Create / Join", icon: <PlusCircle size={14} /> },
          { key: "my-rooms", label: "My Rooms", icon: <KeyRound size={14} /> },
          { key: "joined-rooms", label: "Joined Rooms", icon: <LogIn size={14} /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={tab.key === "my-rooms" ? loadMyRooms : tab.key === "joined-rooms" ? loadJoinedRooms : () => setActiveTab(tab.key)}
            className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "create-join" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 24 }}>
            <h2 style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-ui)", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Create New Battle
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              Design your own challenges with custom test cases, choose languages, set a time limit, and generate a private room key for others to join.
            </p>
            <Link
              to="/battle-room/create"
              className="btn-primary"
              style={{ textDecoration: "none", display: "inline-flex" }}
            >
              <PlusCircle size={16} />
              Create Room
            </Link>
          </div>

          <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 24 }}>
            <h2 style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-ui)", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Join Battle
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
              Enter the room key shared by your instructor or friend to join the battle.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter Room Key (e.g. ABC123)"
                maxLength={6}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  padding: "10px 12px",
                  color: "var(--text-primary)",
                  fontSize: 16,
                  fontFamily: "var(--font-code)",
                  textAlign: "center",
                  letterSpacing: 4,
                  fontWeight: 700,
                  outline: "none",
                }}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
              <input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Your full name (shown on certificate)"
                maxLength={100}
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
              />
              <input
                type="text"
                value={participantOrganization}
                onChange={(e) => setParticipantOrganization(e.target.value)}
                placeholder="Organisation (used for leaderboard)"
                maxLength={120}
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
              />
              {joinError && (
                <div style={{ color: "var(--color-danger)", fontSize: 12, fontFamily: "var(--font-ui)" }}>
                  {joinError}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  {joining ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <LogIn size={14} />}
                  {joining ? "Joining..." : "Join Battle"}
                </button>
                <button
                  onClick={handleViewLeaderboard}
                  className="btn-secondary"
                >
                  <Trophy size={14} />
                  Leaderboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "my-rooms" && (
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-color)", color: "var(--text-primary)", fontSize: 14, fontFamily: "var(--font-ui)", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <KeyRound size={15} color="var(--accent-blue-bright)" />
            Rooms You Created
          </div>
          {loadingRooms ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-ui)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading...
            </div>
          ) : myRooms.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-ui)", fontSize: 13 }}>
              You haven't created any rooms yet.
            </div>
          ) : (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 90px 70px 90px 90px", gap: 12, padding: "8px 16px", borderBottom: "1px solid var(--border-color)", background: "var(--bg-card)", fontSize: 11, fontFamily: "var(--font-ui)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                <div>Key</div>
                <div>Title</div>
                <div>Status</div>
                <div>Players</div>
                <div>Created</div>
                <div>Actions</div>
              </div>
              {myRooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => {
                    if (room.status === "UPCOMING") navigate(`/battle-room/${room.roomCode}`);
                    else if (room.status === "ACTIVE") navigate(`/battle-room/${room.roomCode}/challenge`);
                    else navigate(`/battle-room/${room.roomCode}/leaderboard`);
                  }}
                  style={{ display: "grid", gridTemplateColumns: "100px 1fr 90px 70px 90px 90px", gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--border-color)", fontSize: 12, fontFamily: "var(--font-ui)", alignItems: "center", cursor: "pointer" }}
                >
                  <CopyableCode code={room.roomCode} />
                  <div style={{ color: "var(--text-primary)" }}>{room.title}</div>
                  <div style={{ color: room.status === "ACTIVE" ? "var(--color-success)" : room.status === "CLOSED" ? "var(--color-danger)" : "var(--color-warning)", fontWeight: 600 }}>
                    {room.status}
                  </div>
                  <div style={{ color: "var(--text-muted)", textAlign: "center" }}>{room.participantCount || 0}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                    {formatDate(room.createdAt)}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={(e) => handleShareKey(e, room)}
                      title="Share key"
                      style={{ background: "rgba(210,153,34,0.1)", border: "1px solid rgba(210,153,34,0.3)", color: "var(--color-warning)", borderRadius: 5, padding: "4px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontSize: 11 }}
                    >
                      <Share2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "joined-rooms" && (
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-color)", color: "var(--text-primary)", fontSize: 14, fontFamily: "var(--font-ui)", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <LogIn size={15} color="var(--accent-blue-bright)" />
            Rooms You Joined
          </div>
          {loadingRooms ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-ui)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading...
            </div>
          ) : joinedRooms.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-ui)", fontSize: 13 }}>
              You haven't joined any rooms yet.
            </div>
          ) : (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 80px 80px 100px", gap: 12, padding: "8px 16px", borderBottom: "1px solid var(--border-color)", background: "var(--bg-card)", fontSize: 11, fontFamily: "var(--font-ui)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                <div>Key</div>
                <div>Title</div>
                <div>Score</div>
                <div>Status</div>
                <div>Submitted</div>
              </div>
              {joinedRooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => {
                    if (room.status === "ACTIVE" && room.submissionStatus !== "COMPLETED" && room.submissionStatus !== "DISQUALIFIED") {
                      navigate(`/battle-room/${room.roomCode}/challenge`);
                    } else {
                      navigate(`/battle-room/${room.roomCode}/leaderboard`);
                    }
                  }}
                  style={{ display: "grid", gridTemplateColumns: "100px 1fr 80px 80px 100px", gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--border-color)", fontSize: 12, fontFamily: "var(--font-ui)", alignItems: "center", cursor: "pointer" }}
                >
                  <span style={{ color: "var(--color-warning)", fontWeight: 700, letterSpacing: 2, fontFamily: "var(--font-code)" }}>
                    {room.roomCode}
                  </span>
                  <div style={{ color: "var(--text-primary)" }}>{room.title}</div>
                  <div style={{ color: "var(--accent-blue-bright)", textAlign: "center", fontWeight: 600 }}>
                    {Math.round(room.totalScore || 0)}
                  </div>
                  <div style={{ color: room.submissionStatus === "DISQUALIFIED" ? "var(--color-danger)" : room.status === "ACTIVE" ? "var(--color-success)" : room.status === "CLOSED" ? "var(--color-danger)" : "var(--color-warning)", fontWeight: 600 }}>
                    {room.submissionStatus || room.status}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                    {room.submittedAt ? formatDate(room.submittedAt) : "-"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <RoomKeyModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        roomCode={shareRoomCode}
        room={shareRoom}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
