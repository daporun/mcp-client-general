// src/profiles/types.ts
export interface MCPClientProfile {
  id: string;
  description: string;

  server: {
    kind: "builtin" | "external";
    command: string;
    autoInstall?: boolean;
    package?: string;
  };

  plugins: {
    name: string;
    entry: string;
  }[];

  ui?: {
    enabled: boolean;
    hint?: string;
  };

  notes?: string[];
}

export interface MCPProfilePlugin {
  name: string;
  entry: string;
}
