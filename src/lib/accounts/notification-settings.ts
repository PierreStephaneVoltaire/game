import { isLocalDevelopment } from '$lib/local-development';

let localDiscordDm = false;

export async function loadDiscordDmSetting(): Promise<boolean> {
  if (isLocalDevelopment()) return localDiscordDm;
  const response = await fetch('/api/me/notifications', {
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error('Could not load notification settings.');
  return ((await response.json()) as { discordDm: boolean }).discordDm;
}

export async function saveDiscordDmSetting(enabled: boolean): Promise<boolean> {
  if (isLocalDevelopment()) return (localDiscordDm = enabled);
  const response = await fetch('/api/me/notifications', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ discordDm: enabled }),
  });
  if (!response.ok) throw new Error('Could not save notification settings.');
  return ((await response.json()) as { discordDm: boolean }).discordDm;
}
