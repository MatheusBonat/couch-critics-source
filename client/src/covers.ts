import { coverServiceClient } from "@notas-app/gen-client";

// As capas chegam pelo servidor do app (o cliente do Root não acessa a internet direto e, no Root, as capas de endereços
// externos podem não carregar). Os pedidos de várias linhas são juntados e vão em lotes pequenos (a resposta do Root tem
// no máximo 256 KiB), com uma pausa entre os lotes por causa do limite de chamadas por segundo.

export interface CoverImage {
  mime: string;
  bytes: Uint8Array;
  blobUrl?: string;
  dataUrl?: string;
}

// "none": o serviço de imagens não tem esta capa. "failed": não deu para buscar agora (vale tentar o endereço direto).
export type CoverResult = CoverImage | "none" | "failed";

const batchSize = 6;
const pauseMs = 150;
const maxAttempts = 3;

const cache = new Map<string, CoverImage | "none">();
const waiting = new Map<string, Array<(result: CoverResult) => void>>();
const attempts = new Map<string, number>();
let queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function settle(path: string, result: CoverResult): void {
  if (result !== "failed") cache.set(path, result);
  const list = waiting.get(path) ?? [];
  waiting.delete(path);
  attempts.delete(path);
  for (const resolve of list) resolve(result);
}

async function flush(): Promise<void> {
  running = true;
  try {
    while (queue.length > 0) {
      const batch = queue.splice(0, batchSize);

      let response;
      try {
        response = await coverServiceClient.get({ paths: batch });
      } catch {
        for (const path of batch) retryOrFail(path);
        await sleep(pauseMs * 4);
        continue;
      }

      const answered = new Set<string>();
      for (const cover of response.covers) {
        answered.add(cover.path);
        if (cover.retry) retryOrFail(cover.path);
        else settle(cover.path, cover.data.length > 0 ? { mime: cover.mime, bytes: cover.data } : "none");
      }
      for (const path of batch) if (!answered.has(path)) retryOrFail(path);

      await sleep(pauseMs);
    }
  } finally {
    running = false;
  }
}

// Tenta de novo algumas vezes; passando disso, desiste desta vez (a tela cai no endereço direto ou na inicial).
function retryOrFail(path: string): void {
  const count = (attempts.get(path) ?? 0) + 1;
  attempts.set(path, count);
  if (count >= maxAttempts) settle(path, "failed");
  else queue.push(path);
}

function schedule(): void {
  if (timer || running) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, 40);
}

export function loadCover(path: string): Promise<CoverResult> {
  const hit = cache.get(path);
  if (hit) return Promise.resolve(hit);

  return new Promise((resolve) => {
    const list = waiting.get(path);
    if (list) {
      list.push(resolve);
    } else {
      waiting.set(path, [resolve]);
      queue.push(path);
    }
    schedule();
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function blobUrlOf(image: CoverImage): string {
  if (!image.blobUrl) image.blobUrl = URL.createObjectURL(new Blob([image.bytes as BlobPart], { type: image.mime }));
  return image.blobUrl;
}

export function dataUrlOf(image: CoverImage): string {
  if (!image.dataUrl) image.dataUrl = `data:${image.mime};base64,${toBase64(image.bytes)}`;
  return image.dataUrl;
}

// Os endereços que a tela tenta, em ordem: a imagem como arquivo local (blob), como texto (data) e, por último, o endereço direto.
// Se um falhar ao carregar (o Root pode bloquear alguns tipos), a tela passa para o próximo.
// Cada item é uma função, para só montar o texto (data) se o anterior falhar. Se o servidor disse que não há capa, não tem nenhum.
export function coverSources(result: CoverResult, direct: string): Array<() => string> {
  if (result === "none") return [];

  const list: Array<() => string> = [];
  if (result !== "failed") list.push(() => blobUrlOf(result), () => dataUrlOf(result));
  if (direct) list.push(() => direct);
  return list;
}
