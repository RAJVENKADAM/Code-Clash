import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";

import Home from "../pages/Home";
import BattleRoom from "../pages/BattleRoom";
import CreateBattleRoom from "../pages/CreateBattleRoom";
import BattleRoomChallenge from "../pages/BattleRoomChallenge";
import BattleRoomLeaderboard from "../pages/BattleRoomLeaderboard";

import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";

function AppLayout({ children }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "var(--bg-main)",
      }}
    >
      <Navbar />
      <main style={{ flex: 1, padding: "0" }}>{children}</main>
      <Footer />
    </div>
  );
}

function ProtectedLayout({ children }) {
  return <AppLayout>{children}</AppLayout>;
}

// Full-screen layout for the challenge assessment: no navbar, no footer.
function FullScreenProtectedLayout({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-main)" }}>
      {children}
    </div>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedLayout>
                <Home />
              </ProtectedLayout>
            }
          />
          <Route
            path="/battle-room"
            element={
              <ProtectedLayout>
                <BattleRoom />
              </ProtectedLayout>
            }
          />
          <Route
            path="/battle-room/create"
            element={
              <ProtectedLayout>
                <CreateBattleRoom />
              </ProtectedLayout>
            }
          />
          <Route
            path="/battle-room/:roomCode/challenge"
            element={
              <FullScreenProtectedLayout>
                <BattleRoomChallenge />
              </FullScreenProtectedLayout>
            }
          />
          <Route
            path="/battle-room/:roomCode/leaderboard"
            element={
              <ProtectedLayout>
                <BattleRoomLeaderboard />
              </ProtectedLayout>
            }
          />
          <Route
            path="/battle-room/:roomCode"
            element={
              <FullScreenProtectedLayout>
                <BattleRoomChallenge />
              </FullScreenProtectedLayout>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
