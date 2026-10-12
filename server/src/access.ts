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

export async function adminState(userId: string): Promise<AdminState> {
  const group = adminGroup();
  const chosen = group !== null && (group.userIds.length > 0 || group.communityRoleIds.length > 0);

  if (chosen) {
    return { isAdmin: await group!.isMember({ userId: userId as never }), canClaim: false };
  }

  const claimed = await getSetting(settingKeys.claimedAdmin);
  if (claimed) return { isAdmin: claimed === userId, canClaim: false };

  return { isAdmin: false, canClaim: true };
}

export async function claimAdmin(userId: string): Promise<void> {
  await setSetting(settingKeys.claimedAdmin, userId);
}
