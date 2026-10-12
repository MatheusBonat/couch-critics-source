import { ReadOnlyMemberGroup, rootServer } from "@rootsdk/server-app";
import { getSetting, setSetting, settingKeys } from "./settingsRepository";

export interface AdminState {
  isAdmin: boolean;
  // Ninguém foi escolhido como admin: o primeiro a salvar uma chave passa a ser o admin.
  canClaim: boolean;
}

// Quem administra o app é escolhido na instalação (configuração "admins" do manifesto).
function adminGroup(): ReadOnlyMemberGroup | null {
  try {
    const group = rootServer.globalSettings?.general?.admins as ReadOnlyMemberGroup | undefined;
    return group && typeof group.isMember === "function" ? group : null;
  } catch {
    return null;
  }
}

// O dono da comunidade sempre tem acesso elevado às configurações do app no Root, então também é admin aqui,
// mesmo que não tenha sido escolhido na configuração "admins". O dono muda raramente: a consulta é guardada por 5 minutos.
const ownerCacheMs = 5 * 60 * 1000;
const ownerRetryMs = 30 * 1000;
let ownerCache: { id: string | null; at: number } | null = null;

export function resetOwnerCache(): void {
  ownerCache = null;
}

async function communityOwner(): Promise<string | null> {
  if (ownerCache && Date.now() - ownerCache.at < ownerCacheMs) return ownerCache.id;

  try {
    const community = await rootServer.community?.communities?.get();
    const id = community?.ownerUserId ? String(community.ownerUserId) : null;
    ownerCache = { id, at: Date.now() };
    return id;
  } catch {
    // Se o Root não responder, vale só o resto das regras e tenta de novo em 30 segundos.
    ownerCache = { id: null, at: Date.now() - ownerCacheMs + ownerRetryMs };
    return null;
  }
}

export async function adminState(userId: string): Promise<AdminState> {
  const isOwner = (await communityOwner()) === userId;
  const group = adminGroup();
  const chosen = group !== null && (group.userIds.length > 0 || group.communityRoleIds.length > 0);

  if (chosen) {
    return { isAdmin: isOwner || (await group!.isMember({ userId: userId as never })), canClaim: false };
  }

  const claimed = await getSetting(settingKeys.claimedAdmin);
  if (claimed) return { isAdmin: isOwner || claimed === userId, canClaim: false };

  return { isAdmin: isOwner, canClaim: !isOwner };
}

export async function claimAdmin(userId: string): Promise<void> {
  await setSetting(settingKeys.claimedAdmin, userId);
}
