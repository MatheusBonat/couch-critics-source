export type ProviderErrorCode = "invalid_key" | "rate_limited" | "unavailable" | "not_found";

// Erro de um serviço externo (TMDB, OMDb, IGDB), já traduzido para o que o app precisa saber.
export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

interface RequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<{
  status: number;
  json(): Promise<unknown>;
}>;

let fetchImpl: FetchLike = (url, init) => fetch(url, init);

// Só para testes: troca o fetch real por um simulado.
export function setFetchForTests(replacement: FetchLike | null): void {
  fetchImpl = replacement ?? ((url, init) => fetch(url, init));
}

async function requestJson(
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
  timeoutMs: number,
): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: init.method,
      headers: { Accept: "application/json", ...init.headers },
      body: init.body,
      signal: controller.signal,
    });

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // Resposta sem JSON: o status basta para decidir.
    }
    return { status: response.status, body };
  } catch {
    throw new ProviderError("unavailable", "The service did not answer in time.");
  } finally {
    clearTimeout(timer);
  }
}

export function getJson(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 8000,
): Promise<{ status: number; body: unknown }> {
  return requestJson(url, { method: "GET", headers }, timeoutMs);
}

export function postJson(
  url: string,
  body: string,
  headers: Record<string, string> = {},
  timeoutMs = 8000,
): Promise<{ status: number; body: unknown }> {
  return requestJson(url, { method: "POST", headers, body }, timeoutMs);
}

type BytesReader = { read(): Promise<{ done: boolean; value?: Uint8Array }>; cancel(): Promise<void> };
type BytesResponse = {
  status: number;
  headers: { get(name: string): string | null };
  body?: { getReader(): BytesReader } | null;
  arrayBuffer(): Promise<ArrayBuffer>;
};
type BytesFetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal; redirect?: "manual" | "follow" },
) => Promise<BytesResponse>;

let bytesImpl: BytesFetch = (url, init) => fetch(url, init) as unknown as Promise<BytesResponse>;

// Só para testes: troca o fetch de imagens por um simulado.
export function setBytesFetchForTests(replacement: BytesFetch | null): void {
  bytesImpl = replacement ?? ((url, init) => fetch(url, init) as unknown as Promise<BytesResponse>);
}

export interface BytesResult {
  status: number;
  mime: string;
  data: Buffer;
}

const maxRedirects = 3;

// Redirecionamento só para https, sem porta nem credencial, e só para o mesmo host ou para o Internet Archive (a Cover Art
// Archive entrega as imagens por lá). Qualquer outro destino é recusado, mesmo vindo de um serviço de confiança.
function redirectTarget(from: string, location: string | null): string | null {
  if (!location) return null;
  let next: URL;
  try {
    next = new URL(location, from);
  } catch {
    return null;
  }
  const host = next.hostname.toLowerCase();
  const sameHost = host === new URL(from).hostname.toLowerCase();
  const archive = host === "archive.org" || host.endsWith(".archive.org");
  const plain = next.protocol === "https:" && next.port === "" && next.username === "" && next.password === "";
  return plain && (sameHost || archive) ? next.toString() : null;
}

// Lê o corpo no máximo até maxBytes (para de baixar ao passar disso, mesmo sem Content-Length). null = grande demais.
async function readBounded(response: BytesResponse, maxBytes: number): Promise<Buffer | null> {
  const reader = response.body?.getReader();
  if (!reader) {
    const whole = Buffer.from(await response.arrayBuffer());
    return whole.length > maxBytes ? null : whole;
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

// Baixa um arquivo pequeno (as capas). Devolve null se o serviço não respondeu a tempo. Redirecionamentos são seguidos à mão
// (até 3, só para destinos permitidos; outro destino devolve status 403) e o corpo nunca passa de maxBytes (status 413).
export async function getBytes(url: string, maxBytes: number, timeoutMs = 7000): Promise<BytesResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const empty = (status: number, mime = ""): BytesResult => ({ status, mime, data: Buffer.alloc(0) });

  try {
    let current = url;
    for (let hop = 0; ; hop++) {
      const response = await bytesImpl(current, { headers: { Accept: "image/*" }, signal: controller.signal, redirect: "manual" });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const next = hop < maxRedirects ? redirectTarget(current, response.headers.get("location")) : null;
        if (!next) return empty(403);
        current = next;
        continue;
      }

      const mime = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (response.status !== 200) return empty(response.status, mime);

      // Arquivo grande demais: não vale baixar (status 413, para quem chama tratar como "sem capa").
      const declared = Number(response.headers.get("content-length") ?? 0);
      if (declared > maxBytes) return empty(413, mime);

      const data = await readBounded(response, maxBytes);
      return data === null ? empty(413, mime) : { status: 200, mime, data };
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
