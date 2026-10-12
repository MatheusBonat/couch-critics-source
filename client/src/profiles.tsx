import { useEffect, useRef, useState } from "react";
import { ImageUriResolution, rootClient, UserProfile } from "@rootsdk/client-app";

// Busca nome e foto de cada membro uma única vez e guarda em cache.
export function useProfiles(userIds: string[]): Map<string, UserProfile> {
  const [profiles, setProfiles] = useState<Map<string, UserProfile>>(new Map());
  const requested = useRef<Set<string>>(new Set());
  const key = [...new Set(userIds)].sort().join(",");

  useEffect(() => {
    const missing = key ? key.split(",").filter((id) => !requested.current.has(id)) : [];
    if (missing.length === 0) return;

    missing.forEach((id) => requested.current.add(id));

    rootClient.users
      .getUserProfiles(missing)
      .then((found) => {
        setProfiles((previous) => {
          const next = new Map(previous);
          found.forEach((profile) => next.set(profile.id, profile));
          return next;
        });
      })
      .catch(() => {
        // Deixa tentar de novo na próxima atualização da lista.
        missing.forEach((id) => requested.current.delete(id));
      });
  }, [key]);

  return profiles;
}

export function displayName(profiles: Map<string, UserProfile>, userId: string, fallback: string): string {
  return profiles.get(userId)?.nickname ?? fallback;
}

export function Avatar({ profile, small }: { profile?: UserProfile; small?: boolean }) {
  const uri = profile?.profilePictureUri;
  const url = uri ? rootClient.assets.toImageUrl(uri, ImageUriResolution.Small) : "";
  const size = small ? " avatar-sm" : "";

  if (url) return <img className={`avatar${size}`} src={url} alt="" />;

  const initial = (profile?.nickname ?? "?").trim().charAt(0).toUpperCase();
  return (
    <span className={`avatar avatar-fallback${size}`} aria-hidden="true">
      {initial}
    </span>
  );
}
