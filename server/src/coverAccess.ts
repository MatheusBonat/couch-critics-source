import { knex } from "./db";

// Quais capas o servidor aceita baixar. Qualquer membro pode pedir capas, então o pedido só vale para o que o app mostra de
// verdade: a capa de um título que já está na comunidade ou a de um resultado de busca recente. Sem isso, dá para fazer o
// servidor buscar e guardar um caminho qualquer, sem fim (cada um vira uma linha no banco e uma consulta ao serviço de imagens).
const maxRemembered = 600;
const remembered = new Set<string>();

// Guarda as capas dos resultados de uma busca (as mais antigas saem primeiro).
export function rememberCovers(paths: string[]): void {
  for (const path of paths) {
    if (!path) continue;
    remembered.delete(path);
    remembered.add(path);
  }
  while (remembered.size > maxRemembered) {
    const oldest = remembered.values().next().value;
    if (oldest === undefined) break;
    remembered.delete(oldest);
  }
}

export function forgetCoversForTests(): void {
  remembered.clear();
}

export async function coverAllowed(path: string): Promise<boolean> {
  if (path === "") return false;
  if (remembered.has(path)) return true;
  try {
    const row = await knex("titles").where({ poster_en: path }).orWhere({ poster_pt: path }).first("id");
    return row !== undefined;
  } catch {
    // Sem conseguir conferir, a resposta é "não" (falha fechada).
    return false;
  }
}
