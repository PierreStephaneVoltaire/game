import type { GameViewModel } from './game-view-model';
import {
  runArchiveExportFilename,
  runArchiveExportMarkdown,
} from './run-archive-export';

export function graveyardExportMarkdown(model: GameViewModel): string {
  if (model.ending?.kind !== 'death')
    throw new Error('A run without Death has no grave to export.');
  return runArchiveExportMarkdown(model);
}

export function graveyardExportFilename(model: GameViewModel): string {
  if (model.ending?.kind !== 'death')
    throw new Error('A run without Death has no grave to export.');
  return runArchiveExportFilename(model);
}
