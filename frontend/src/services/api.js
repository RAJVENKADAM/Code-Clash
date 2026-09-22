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
    // Handle response errors from server
    if (error.response) {
      const { status, data } = error.response;
      let message = data?.error || data?.message || "An error occurred";
      
      // Handle specific status codes with user-friendly messages
      if (status === 401) {
        message = data?.error || "Unauthorized. Please log in again.";
      } else if (status === 403) {
        message = data?.error || "Access forbidden.";
      } else if (status === 404) {
        message = data?.error || "Resource not found.";
      } else if (status === 429) {
        message = data?.error || "Too many requests. Please wait a moment and try again.";
      } else if (status === 500 || status === 502 || status === 503) {
        message = data?.error || "Server error. Please try again in a few moments.";
      }
      
      return Promise.reject(new Error(message));
    }

    // Handle timeout
    if (error.code === "ECONNABORTED") {
      return Promise.reject(new Error("Request timed out. Please try again."));
    }

    // Handle network errors
    if (!error.response && error.message) {
      return Promise.reject(
        new Error("Network error. Please check your connection."),
      );
    }

    return Promise.reject(error);
  },
);

export default api;
