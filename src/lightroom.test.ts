import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { LightroomClient } from "./lightroom.ts";

type Request = { requestId: string; object: null; params: unknown[]; message: string };
type Reply = { success: boolean; response: unknown } | undefined;

/** Minimal stand-in for the browser WebSocket, answering like Lightroom. */
class FakeWebSocket {
  static OPEN = 1;
  static last: FakeWebSocket;
  /** Return a reply for a request, or undefined to never answer. */
  static respond: (req: Request) => Reply = () => ({ success: true, response: {} });

  readyState = 0;
  sent: Request[] = [];
  onopen?: () => void;
  onerror?: () => void;
  onclose?: () => void;
  onmessage?: (e: { data: string }) => void;

  constructor(public url: string) {
    FakeWebSocket.last = this;
    queueMicrotask(() => {
      this.readyState = 1;
      this.onopen?.();
    });
  }

  send(data: string) {
    const req = JSON.parse(data) as Request;
    this.sent.push(req);
    const reply = FakeWebSocket.respond(req);
    if (reply) queueMicrotask(() => this.reply({ ...reply, requestId: req.requestId }));
  }

  reply(answer: object) {
    this.onmessage?.({ data: JSON.stringify(answer) });
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}

const realWebSocket = globalThis.WebSocket;

beforeEach(() => {
  (globalThis as { WebSocket: unknown }).WebSocket = FakeWebSocket;
  FakeWebSocket.respond = () => ({ success: true, response: {} });
});

afterEach(() => {
  globalThis.WebSocket = realWebSocket;
});

const connected = async () => {
  const client = new LightroomClient("ws://test");
  await client.connect();
  return { client, ws: FakeWebSocket.last };
};

describe("LightroomClient", () => {
  test("connect() registers with app name, version and a client GUID", async () => {
    const { ws } = await connected();
    const [reg] = ws.sent;
    expect(reg.message).toBe("register");
    expect(reg.object).toBeNull();
    expect(reg.params[0]).toBe("lightroom-deck");
    expect(reg.params[2]).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("connect() rejects and closes when pairing is refused", async () => {
    FakeWebSocket.respond = () => ({ success: false, response: [] });
    const client = new LightroomClient("ws://test");
    await expect(client.connect()).rejects.toThrow();
    expect(FakeWebSocket.last.readyState).toBe(3);
  });

  test("getValue() returns the number, or null when no photo is open", async () => {
    const { client } = await connected();
    FakeWebSocket.respond = () => ({ success: true, response: [0.74] });
    expect(await client.getValue("Exposure2012")).toBe(0.74);
    FakeWebSocket.respond = () => ({ success: true, response: {} });
    expect(await client.getValue("Exposure2012")).toBeNull();
  });

  test("adjust() sends increment/decrement with an absolute amount", async () => {
    const { client, ws } = await connected();
    await client.adjust("Exposure2012", 0.5);
    await client.adjust("Exposure2012", -0.25);
    await client.adjust("Exposure2012", 0);
    const sent = ws.sent.slice(1).map((r) => [r.message, ...r.params]);
    expect(sent).toEqual([
      ["increment", "Exposure2012", 0.5],
      ["decrement", "Exposure2012", 0.25],
    ]);
  });

  test("adjust() throws when Lightroom reports failure", async () => {
    const { client } = await connected();
    FakeWebSocket.respond = () => ({ success: false, response: ["invalid_request"] });
    await expect(client.adjust("Exposure2012", 1)).rejects.toThrow();
  });

  test("matches responses to requests by requestId, even out of order", async () => {
    const { client, ws } = await connected();
    FakeWebSocket.respond = () => undefined; // answer manually below
    const a = client.getValue("A");
    const b = client.getValue("B");
    const [reqA, reqB] = ws.sent.slice(1);
    ws.reply({ requestId: reqB.requestId, success: true, response: [2] });
    ws.reply({ requestId: reqA.requestId, success: true, response: [1] });
    expect(await a).toBe(1);
    expect(await b).toBe(2);
  });

  test("pending requests are rejected when the connection closes", async () => {
    const { client, ws } = await connected();
    let closed = false;
    client.onClose = () => (closed = true);
    FakeWebSocket.respond = () => undefined;
    const pending = client.getValue("A");
    ws.close();
    await expect(pending).rejects.toThrow("Connection closed");
    expect(closed).toBe(true);
  });

  test("send() rejects when not connected", async () => {
    const client = new LightroomClient("ws://test");
    await expect(client.getValue("A")).rejects.toThrow("Not connected");
  });
});
