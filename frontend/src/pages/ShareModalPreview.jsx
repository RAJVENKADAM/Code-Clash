import BattleRoomShareModal from "../components/battleRoom/BattleRoomShareModal";

export default function ShareModalPreview() {
  const result = {
    room: {
      title: "Java DSA Battle",
    },
    submission: {
      totalScore: 850,
      totalPassed: 8,
      totalQuestions: 10,
      codingBehavior: {
        totalLinesWritten: 142,
        totalEdits: 37,
        completedEarly: true,
        languagesUsed: ["Java"],
      },
    },
    rank: 3,
    totalParticipants: 25,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#111",
        padding: "40px",
      }}
    >
      <BattleRoomShareModal
        isOpen={true}
        onClose={() => {}}
        result={result}
        userName="Rajvenkadam"
      />
    </div>
  );
}
