// src/profiles/web-dev.profile.ts
import type { MCPClientProfile } from "./types.js";

export const webDevProfile: MCPClientProfile = {
  id: "web-dev",
  description: "Zero-config web development MCP stack",

  server: {
    kind: "builtin",
    command: "mcp-server-general",
    autoInstall: true,
    package: "mcp-server-general",
  },

  plugins: [
    {
      name: "web-tools",
      entry: "@mcp/plugin-web-tools",
    },
  ],

  ui: {
    enabled: true,
    hint: "Launches browser-based MCP UI for web development",
  },

  notes: [
    "Automatically installs and runs the reference MCP server",
    "Designed for zero-config onboarding",
  ],
};

