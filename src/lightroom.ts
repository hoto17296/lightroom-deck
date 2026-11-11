// Minimal client for the Lightroom External Controller WebSocket API.

type Answer = {
  requestId?: string;
  success: boolean;
  response: unknown;
  message?: string;
};

type Pending = {
  resolve: (answer: Answer) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const APP_NAME = "lightroom-deck";
const APP_VERSION = "0.0.0";
const GUID_KEY = "lightroom-client-guid";

// Reuse the same client GUID across reloads so Lightroom may remember the pairing.
const clientGuid = (): string => {
  try {
    const saved = localStorage.getItem(GUID_KEY);
    if (saved) return saved;
    const guid = crypto.randomUUID();
    localStorage.setItem(GUID_KEY, guid);
    return guid;
  } catch {
    return crypto.randomUUID();
  }
};

export class LightroomClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  onClose: (() => void) | null = null;
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  /** Opens the socket and registers (pairs) with Lightroom. */
  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error(`Failed to connect to ${this.url}`));
      ws.onmessage = (event) => this.handleMessage(String(event.data));
      ws.onclose = () => {
        for (const p of this.pending.values()) {
          clearTimeout(p.timer);
          p.reject(new Error("Connection closed"));
        }
        this.pending.clear();
        this.ws = null;
        this.onClose?.();
      };
    });

    // Waiting for the user to click "Pair" in Lightroom can take a while.
    const answer = await this.send([APP_NAME, APP_VERSION, clientGuid()], "register", 120_000);
    if (!answer.success) {
      this.close();
      throw new Error("Pairing with Lightroom was rejected");
    }
  }

  close(): void {
    this.ws?.close();
  }

  send(params: unknown[], message: string, timeout = 5000): Promise<Answer> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Not connected"));
    }
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Timeout waiting for '${message}'`));
      }, timeout);
      this.pending.set(requestId, { resolve, reject, timer });
      ws.send(JSON.stringify({ requestId, object: null, params, message }));
    });
  }

  /**
   * Returns the current value of a develop parameter,
   * or null when no photo is open for editing (Lightroom answers with `{}`).
   */
  async getValue(parameter: string): Promise<number | null> {
    const answer = await this.send([parameter], "getValue");
    if (!answer.success || !Array.isArray(answer.response)) return null;
    const value = answer.response[0];
    return typeof value === "number" ? value : null;
  }

  /** Changes a parameter by a relative amount. */
  async adjust(parameter: string, delta: number): Promise<void> {
    if (delta === 0) return;
    const message = delta > 0 ? "increment" : "decrement";
    const answer = await this.send([parameter, Math.abs(delta)], message);
    if (!answer.success) throw new Error(`'${message}' failed for ${parameter}`);
  }

  private handleMessage(data: string): void {
    let answer: Answer;
    try {
      answer = JSON.parse(data);
    } catch {
      return;
    }
    if (answer.message === "close") {
      this.close();
      return;
    }
    const p = answer.requestId ? this.pending.get(answer.requestId) : undefined;
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(answer.requestId!);
    p.resolve(answer);
  }
}
