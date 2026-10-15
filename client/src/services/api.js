import axios from "axios";

const isLocalBrowser = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
const configuredBaseURL = (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
const baseURL = configuredBaseURL || (isLocalBrowser ? "http://localhost:5000/api" : "/api");

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("travels_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("travels_token");
      localStorage.removeItem("travels_user");
      window.dispatchEvent(new Event("travels:unauthorized"));
    }
    return Promise.reject(error);
  },
);

export { baseURL };
export default api;
