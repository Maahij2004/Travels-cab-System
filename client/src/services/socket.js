import { io } from "socket.io-client";
import { baseURL } from "./api";

const getSocketURL = () => {
  const explicit = (import.meta.env.VITE_SOCKET_URL || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  if (baseURL.endsWith("/api")) return baseURL.slice(0, -4);
  return baseURL;
};

let socket = null;
let currentToken = null;

export const connectDispatchSocket = () => {
  const token = localStorage.getItem("travels_token");
  if (!token || typeof window === "undefined") {
    if (socket) {
      socket.disconnect();
      socket = null;
      currentToken = null;
    }
    return null;
  }

  // If socket already exists with the same token, reuse it
  if (socket && currentToken === token) {
    if (!socket.connected && !socket.active) {
      socket.connect();
    }
    return socket;
  }

  // Disconnect existing socket if token changed
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;
  socket = io(getSocketURL(), {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 400,
    timeout: 10000,
  });

  return socket;
};

export const getDispatchSocket = () => socket;

export const disconnectDispatchSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
};

