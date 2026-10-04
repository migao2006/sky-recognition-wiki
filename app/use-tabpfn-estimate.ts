"use client";
import { useEffect, useState } from "react";
import { isModelResponse, type ModelRequest, type ModelResponse } from "./valuation-api-contract";

export function useTabpfnEstimate(input: ModelRequest | null) {
  const body = input ? JSON.stringify(input) : "";
  const [attempt, setAttempt] = useState(0);
  const key = `${attempt}:${body}`;
  const [result, setResult] = useState<{ key: string; response?: ModelResponse; error?: string }>();
  useEffect(() => {
    if (!body) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 47000);
    let current = true;
    void (async () => {
      try {
        const res = await fetch("/api/valuation", { method: "POST", headers: { "Content-Type": "application/json" },
          body, cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error(res.status === 429 ? "估價服務忙碌，請稍後重試。" : "估價服務暫時離線，請稍後重試。");
        const response: unknown = await res.json();
        if (!isModelResponse(response)) throw new Error("估價回應無效，請稍後重試。");
        if (current) setResult({ key, response });
      } catch (error) {
        if (current) setResult({ key, error: controller.signal.aborted ? "估價逾時，請稍後重試。" : error instanceof Error ? error.message : "估價服務暫時離線。" });
      } finally { clearTimeout(timer); }
    })();
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [body, key]);
  const active = result?.key === key ? result : undefined;
  return { response: active?.response, error: active?.error, loading: Boolean(body && !active), retry: () => setAttempt(v => v + 1) };
}
