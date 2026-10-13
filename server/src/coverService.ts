import { Client } from "@rootsdk/server-app";
import { Cover, CoverRequest, CoverResponse } from "@notas-app/gen-shared";
import { CoverServiceBase } from "@notas-app/gen-server";
import { coverRepository } from "./coverRepository";
import { getBytes } from "./providers/http";

// O cliente do app não acessa a internet direto e, no Root, as capas de endereços externos podem não carregar.
// Então o servidor baixa cada capa uma vez, guarda no banco da comunidade e entrega os bytes ao cliente.
export const coverTuning = {
  // Quantas capas cabem num pedido, e quantos bytes no total (o Root limita cada mensagem a 256 KiB).
  maxPaths: 6,
  maxResponseBytes: 200_000,
  // Tamanho máximo de uma capa.
  maxImageBytes: 150_000,
  // Depois de uma falha de rede, espera isto antes de tentar de novo.
  retryAfterMs: 30_000,
};

const tmdbBase = "https://image.tmdb.org/t/p";
const igdbBase = "https://images.igdb.com/igdb/image/upload";
const openLibraryBase = "https://covers.openlibrary.org/b/id";
const aniListBase = "https://s4.anilist.co/file/anilistcdn";
const coverArtBase = "https://coverartarchive.org/release-group";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Endereço da capa a partir do que fica guardado no título. Só endereços dos serviços conhecidos, com o identificador
// conferido: nada que o cliente mande vira um endereço qualquer. Vazio quando a capa é inválida.
export function coverUrl(path: string): string {
  if (!path || path.length > 200) return "";

  if (path.startsWith("igdb:")) {
    const id = path.slice(5);
    return /^[A-Za-z0-9_-]+$/.test(id) ? `${igdbBase}/t_cover_small/${id}.jpg` : "";
  }
  if (path.startsWith("ol:")) {
    const id = path.slice(3);
    return /^\d{1,12}$/.test(id) ? `${openLibraryBase}/${id}-M.jpg` : "";
  }
  if (path.startsWith("al:")) {
    const rest = path.slice(3);
    return /^[A-Za-z0-9/_.-]+$/.test(rest) && !rest.includes("..") ? `${aniListBase}/${rest}` : "";
  }
  if (path.startsWith("mb:")) {
    const id = path.slice(3);
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) ? `${coverArtBase}/${id}/front-250` : "";
  }
  return /^\/[A-Za-z0-9_.-]+\.(jpg|png)$/i.test(path) ? `${tmdbBase}/w154${path}` : "";
}

type Loaded = { mime: string; data: Buffer } | "retry";

export class CoverService extends CoverServiceBase {
  private failedAt = new Map<string, number>();
  private inFlight = new Map<string, Promise<Loaded>>();

  async get(request: CoverRequest, _client: Client): Promise<CoverResponse> {
    const paths = [...new Set(request.paths ?? [])].slice(0, coverTuning.maxPaths);
    const covers: Cover[] = [];
    let bytes = 0;

    // Até 3 downloads ao mesmo tempo.
    const loaded = new Map<string, Loaded>();
    for (let i = 0; i < paths.length; i += 3) {
      const group = paths.slice(i, i + 3);
      const results = await Promise.all(group.map((path) => this.load(path)));
      group.forEach((path, index) => loaded.set(path, results[index]));
    }

    for (const path of paths) {
      const result = loaded.get(path)!;
      if (result === "retry" || bytes + result.data.length > coverTuning.maxResponseBytes) {
        covers.push({ path, mime: "", data: new Uint8Array(0), retry: true });
        continue;
      }
      bytes += result.data.length;
      covers.push({ path, mime: result.mime, data: new Uint8Array(result.data), retry: false });
    }
    return { covers };
  }

  private load(path: string): Promise<Loaded> {
    const running = this.inFlight.get(path);
    if (running) return running;

    const job = this.fetchOnce(path).finally(() => this.inFlight.delete(path));
    this.inFlight.set(path, job);
    return job;
  }

  private async fetchOnce(path: string): Promise<Loaded> {
    const url = coverUrl(path);
    if (!url) return { mime: "", data: Buffer.alloc(0) };

    try {
      const saved = await coverRepository.get(path);
      if (saved) return saved;
    } catch {
      // Sem o cache, baixa de novo.
    }

    const failed = this.failedAt.get(path);
    if (failed !== undefined && Date.now() - failed < coverTuning.retryAfterMs) return "retry";

    const result = await getBytes(url, coverTuning.maxImageBytes);
    if (result === null || result.status === 429 || result.status >= 500) {
      this.failedAt.set(path, Date.now());
      return "retry";
    }

    // 404 e parecidos: esta capa não existe. Guarda assim mesmo, para não pedir de novo a cada vez.
    const valid = result.status === 200 && allowedTypes.has(result.mime) && result.data.length > 0;
    const entry = valid ? { mime: result.mime, data: result.data } : { mime: "", data: Buffer.alloc(0) };
    try {
      await coverRepository.put(path, entry.mime, entry.data, Date.now());
    } catch {
      // Não salvar não impede de mostrar.
    }
    this.failedAt.delete(path);
    return entry;
  }
}

export const coverService = new CoverService();
