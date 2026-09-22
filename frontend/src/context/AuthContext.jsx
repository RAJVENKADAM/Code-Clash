import {
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";
const AuthContext = createContext(null);
const GUEST_ID_KEY = "ccp_guest_id";
const GUEST_NAME_KEY = "ccp_guest_name";

function getGuestIdentity() {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return {
    id,
    name: localStorage.getItem(GUEST_NAME_KEY) || "Guest participant",
    role: "GUEST",
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getGuestIdentity);

  const updateUser = useCallback((userData) => {
    setUser(userData);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        updateUser,
        isAuthenticated: true,
        isAdmin: false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
