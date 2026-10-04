import { createHmac } from "node:crypto";
import { isModelRequest, isModelResponse } from "../../valuation-api-contract";

export const runtime = "nodejs";
export const maxDuration = 60;
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const endpoint = process.env.VALUATION_BACKEND_URL;
  const token = process.env.VALUATION_BACKEND_TOKEN;
  if (!endpoint || !token || token.length < 40) return reply({ error: "offline" }, 503);
  try {
    const url = new URL(endpoint);
    const local = process.env.NODE_ENV !== "production" && url.protocol === "http:" && url.hostname === "127.0.0.1";
    if ((!local && (url.protocol !== "https:" || !/^[a-z0-9-]+\.trycloudflare\.com$/.test(url.hostname)))
      || url.username || url.password || url.search || url.hash || url.pathname !== "/") return reply({ error: "offline" }, 503);
    // Vercel overwrites x-vercel-forwarded-for. Never trust arbitrary browser IP headers.
    const ip = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for") : "local";
    if (!ip) return reply({ error: "offline" }, 503);
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "invalid_request" }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) { await reader.cancel(); return reply({ error: "too_large" }, 413); }
      chunks.push(value);
    }
    let input: unknown;
    try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return reply({ error: "invalid_request" }, 400); }
    if (!isModelRequest(input)) return reply({ error: "invalid_request" }, 400);
    const result = await fetch(new URL("/predict", url), {
      method: "POST", cache: "no-store", redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(45000)]),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`,
        "X-Valuation-Client": createHmac("sha256", token).update(ip).digest("hex") },
      body: JSON.stringify(input),
    });
    if (!result.ok) return reply({ error: result.status === 429 ? "busy" : "offline" }, result.status === 429 ? 429 : 503);
    const data: unknown = await result.json();
    if (!isModelResponse(data)) return reply({ error: "offline" }, 503);
    // Only the explicitly validated public fields leave this proxy.
    return reply({ schemaVersion: data.schemaVersion, modelRevision: data.modelRevision, status: data.status,
      midpoint: data.midpoint, currency: data.currency, range: null,
      seasonBands: data.seasonBands.map(b => ({ slug: b.slug, median: b.median, low: null, high: null,
        status: b.status, method: b.method, confidence: b.confidence, sampleCount: b.sampleCount, asOf: b.asOf })) });
  } catch {
    return reply({ error: "offline" }, 503);
  }
}
