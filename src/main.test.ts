import { afterAll, beforeAll, expect, test } from "bun:test";
import { isLocalRequest, startServer } from "./main";

let server: ReturnType<typeof startServer>;
let origin: string;
beforeAll(() => {
  server = startServer(0);
  origin = `http://127.0.0.1:${server.port}`;
});
afterAll(() => server?.stop(true));

test("binds only to IPv4 loopback and serves the embedded page", async () => {
  expect(server.hostname).toBe("127.0.0.1");
  const response = await fetch(origin);
  expect(response.status).toBe(200);
  expect(await response.text()).toContain("<html");
});

test("rejects a foreign Host before static assets or WebSocket upgrade", async () => {
  for (const path of ["/", "/ws"]) {
    expect((await fetch(origin + path, { headers: { Host: "attacker.example" } })).status).toBe(403);
  }
});

test("rejects foreign/null origins and cross-site browser requests", async () => {
  for (const Origin of ["https://attacker.example", "null"]) {
    expect((await fetch(origin, { headers: { Origin } })).status).toBe(403);
    expect((await fetch(origin + "/ws", { headers: { Origin } })).status).toBe(403);
  }
  expect((await fetch(origin, { headers: { "Sec-Fetch-Site": "cross-site" } })).status).toBe(403);
});

test("WebSocket controls require a matching browser origin", async () => {
  expect((await fetch(origin + "/ws")).status).toBe(403);
  // lib.dom's constructor omits Bun's documented custom-header extension.
  const LocalWebSocket = WebSocket as unknown as {
    new (url: string, options: Bun.WebSocketOptions): WebSocket;
  };
  const socket = new LocalWebSocket(origin.replace("http:", "ws:") + "/ws", { headers: { Origin: origin } });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WebSocket handshake timed out")), 2000);
      socket.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("WebSocket handshake failed")); }, { once: true });
    });
    expect(socket.readyState).toBe(WebSocket.OPEN);
    // Transport check only: never send detection/inference/task messages.
  } finally {
    socket.close();
  }
});

test("static serving only accepts GET", async () => {
  expect((await fetch(origin, { method: "POST", headers: { Origin: origin } })).status).toBe(405);
});

test("normalizes the default HTTP port without binding a privileged socket", () => {
  expect(isLocalRequest(new Request("http://localhost:80/ws", { headers: { Origin: "http://localhost" } }), 80)).toBe(true);
  expect(isLocalRequest(new Request("http://127.0.0.1:80/"), 80)).toBe(true);
  expect(isLocalRequest(new Request("http://127.0.0.1:81/"), 80)).toBe(false);
});
