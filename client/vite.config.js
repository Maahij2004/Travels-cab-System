import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const PORTS = {
  portal: 5173,
  customer: 5175,
  driver: 5177,
  admin: 5179,
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const role = env.VITE_PORTAL_ROLE || "portal";
  const port = PORTS[role] || PORTS.portal;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: "localhost",
      port,
      strictPort: true,
    },
    preview: {
      host: "localhost",
      port: port + 1000,
      strictPort: true,
    },
  };
});
