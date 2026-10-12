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
