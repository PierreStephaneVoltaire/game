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

export function runArchiveExportMarkdown(model: GameViewModel): string {
  if (!model.ending) throw new Error('An active run has no archive to export.');
  const ending = model.ending;
  const timestamp = (at: number) => formatTimestamp(at, model.timezone);
  const death = ending.kind === 'death';
  const lines = [
    `# ${model.companion.name}'s ${death ? 'Graveyard Record' : 'Archived Run'}`,
    '',
    `- Outcome: ${ending.title}`,
    `- Run started: ${timestamp(model.runStartedAt)}`,
    `- Run ended: ${timestamp(ending.at)}`,
    `- Duration: ${formatDuration(model.runStartedAt, ending.at)}`,
    `- Mode: ${model.modeLabel}`,
    `- Timezone: ${model.timezone}`,
    '',
    death ? '## Cause of death' : '## Ending',
    '',
    ...(death
      ? ending.causes.map((cause) => `- ${cleanLine(cause.name)}`)
      : [
          cleanLine(ending.explanation),
          '',
          ...ending.evidence.map((line) => `- ${cleanLine(line)}`),
        ]),
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

export function runArchiveExportFilename(model: GameViewModel): string {
  if (!model.ending) throw new Error('An active run has no archive to export.');
  const name = model.companion.name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  const date = new Date(model.ending.at).toISOString().slice(0, 10);
  const suffix = model.ending.kind === 'death' ? 'graveyard' : 'run-archive';
  return `${name || 'companion'}-${suffix}-${date}.md`;
}
