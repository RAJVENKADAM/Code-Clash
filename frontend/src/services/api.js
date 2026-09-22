import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const api = axios.create({
  baseURL: API_BASE_URL,
  // Tolerance for the Secure Code Engine's cold starts on Render (up to 120s).
  // Code execution paths (run/submit) may override this per-request as well.
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const guestId = localStorage.getItem("ccp_guest_id");
    if (guestId) config.headers["X-Guest-ID"] = guestId;
    // Add request ID if available
    config.headers["X-Request-Id"] =
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response) {
      const { data } = error.response;

      const message = data?.error || data?.message || "An error occurred";
      return Promise.reject(new Error(message));
    }

    if (error.code === "ECONNABORTED") {
      return Promise.reject(new Error("Request timed out. Please try again."));
    }

    if (!error.response) {
      return Promise.reject(
        new Error("Network error. Please check your connection."),
      );
    }

    return Promise.reject(error);
  },
);

export default api;
