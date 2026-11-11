import { useCallback, useEffect, useRef, useState } from "react";

import { LightroomClient } from "./lightroom.ts";
import { PARAMS, type ParamDef } from "./params.ts";
import { isBusy, newSyncState, quantize, syncToTarget, type SyncState } from "./sync.ts";

const WS_URL = import.meta.env.VITE_LIGHTROOM_WS_URL ?? "ws://localhost:7682";
const POLL_MS = 1000;

export type Status = "idle" | "connecting" | "connected";
/** null for a key = no value (no photo open in edit mode). */
export type Values = Record<string, number | null>;

export function useLightroom() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Values | null>(null);

  const clientRef = useRef<LightroomClient | null>(null);
  // Per-parameter bookkeeping (not rendered, so kept in a ref).
  const syncRef = useRef(new Map<string, SyncState>(PARAMS.map((p) => [p.key, newSyncState(p)])));
  const state = (key: string) => syncRef.current.get(key)!;

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    const client = new LightroomClient(WS_URL);
    client.onClose = () => {
      clientRef.current = null;
      setStatus("idle");
      setValues(null);
    };
    try {
      await client.connect();
      clientRef.current = client;
      setStatus("connected");
    } catch (e) {
      client.close();
      setError(e instanceof Error ? e.message : String(e));
      setStatus("idle");
    }
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.close();
  }, []);

  // Poll current values so the UI follows changes made in Lightroom.
  useEffect(() => {
    if (status !== "connected") return;
    let cancelled = false;
    const poll = async () => {
      const client = clientRef.current;
      if (!client) return;
      const idle = PARAMS.filter((p) => !isBusy(state(p.key)));
      const results = await Promise.all(
        idle.map((p) => client.getValue(p.key).catch(() => undefined)),
      );
      if (cancelled) return;
      const update: Values = {};
      idle.forEach((p, i) => {
        const v = results[i];
        const s = state(p.key);
        // Skip failed requests and params that became busy while waiting.
        if (v === undefined || isBusy(s)) return;
        s.applied = v;
        s.ui = v;
        update[p.key] = v;
      });
      setValues((prev) => ({ ...prev, ...update }));
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [status]);

  useEffect(() => () => clientRef.current?.close(), []);

  // Push the latest target to Lightroom; one request at a time per parameter.
  const sync = async (p: ParamDef) => {
    const s = state(p.key);
    const client = clientRef.current;
    if (s.syncing || !client) return;
    s.syncing = true;
    try {
      await syncToTarget(client, p, s);
    } catch (e) {
      // Errors after a disconnect are expected; don't report them.
      if (clientRef.current === client) setError(e instanceof Error ? e.message : String(e));
    } finally {
      s.syncing = false;
    }
  };

  /** Sets an absolute value (API units). */
  const setValue = (p: ParamDef, v: number) => {
    const s = state(p.key);
    if (s.applied === null) return;
    const q = quantize(p, v);
    s.ui = q;
    s.target = q;
    setValues((prev) => ({ ...prev, [p.key]: q }));
    sync(p);
  };

  /** Changes the value by `steps` × param.step. */
  const nudge = (p: ParamDef, steps: number) => {
    const s = state(p.key);
    if (s.ui === null) return;
    setValue(p, s.ui + steps * p.step);
  };

  const setDragging = (p: ParamDef, dragging: boolean) => {
    state(p.key).dragging = dragging;
  };

  return { status, error, values, connect, disconnect, setValue, nudge, setDragging };
}
