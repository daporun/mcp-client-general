export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

let idCounter = 1;

export function createRequest(method: string, params?: unknown): JSONRPCRequest {
  return {
    jsonrpc: "2.0",
    id: idCounter++,
    method,
    params
  };
}
