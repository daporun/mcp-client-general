let idCounter = 1;
export function createRequest(method, params) {
    return {
        jsonrpc: "2.0",
        id: idCounter++,
        method,
        params
    };
}
