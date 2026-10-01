import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("ccp_access_token");
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    config.headers["X-Request-Id"] =
      `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (
        status === 401 &&
        !String(error.config?.url || "").startsWith("/auth/")
      ) {
        window.dispatchEvent(new Event("ccp-auth-expired"));
      }
      let message = data?.error || data?.message || "An error occurred";
      if (status === 401) {
        message = data?.error || "Unauthorized. Please log in again.";
      } else if (status === 403) {
        message = data?.error || "Access forbidden.";
      } else if (status === 404) {
        message = data?.error || "Resource not found.";
      } else if (status === 429) {
        message =
          data?.error || "Too many requests. Please wait a moment and try again.";
      } else if ([500, 502, 503].includes(status)) {
        message =
          data?.error || "Server error. Please try again in a few moments.";
      }
      return Promise.reject(new Error(message));
    }

    if (error.code === "ECONNABORTED") {
      return Promise.reject(new Error("Request timed out. Please try again."));
    }

    if (!error.response && error.message) {
      return Promise.reject(
        new Error("Network error. Please check your connection."),
      );
    }

    return Promise.reject(error);
  },
);

export default api;
