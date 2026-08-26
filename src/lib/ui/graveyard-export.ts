import type { GameViewModel } from './game-view-model';

function formatTimestamp(at: number, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(at);
}

function cleanLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function formatDuration(start: number, end: number): string {
  const totalMinutes = Math.floor((end - start) / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${hours}h ${minutes}m`;
}

export function graveyardExportMarkdown(model: GameViewModel): string {
  if (!model.death) throw new Error('A living run has no grave to export.');
  const timestamp = (at: number) => formatTimestamp(at, model.timezone);
  const lines = [
    `# ${model.companion.name}'s Graveyard Record`,
    '',
    `- Run started: ${timestamp(model.runStartedAt)}`,
    `- Run ended: ${timestamp(model.death.at)}`,
    `- Duration: ${formatDuration(model.runStartedAt, model.death.at)}`,
    `- Mode: ${model.modeLabel}`,
    `- Timezone: ${model.timezone}`,
    '',
    '## Cause of death',
    '',
    ...model.death.causes.map((cause) => `- ${cleanLine(cause.name)}`),
    '',
    '## Causal chain',
    '',
    ...model.causalEvents.map(
      (event, index) =>
        `${index + 1}. ${timestamp(event.at)} — ${cleanLine(event.message)}`,
    ),
    '',
    '## Journey',
    '',
    ...model.events.map(
      (event) => `- ${timestamp(event.at)} — ${cleanLine(event.message)}`,
    ),
    '',
  ];
  return lines.join('\n');
}

export function graveyardExportFilename(model: GameViewModel): string {
  if (!model.death) throw new Error('A living run has no grave to export.');
  const name = model.companion.name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  const date = new Date(model.death.at).toISOString().slice(0, 10);
  return `${name || 'companion'}-graveyard-${date}.md`;
}
