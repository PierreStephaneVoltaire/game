import { resolve } from 'node:path';
import { publishGlobalData } from './publisher.js';
import { loadGlobalDataRecords } from './records.js';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (!connectionString)
  throw new Error('AZURE_STORAGE_CONNECTION_STRING is required.');

const repositoryRoot = resolve(process.cwd(), '..');
const records = await loadGlobalDataRecords(repositoryRoot);
const result = await publishGlobalData(connectionString, records);
process.stdout.write(`${JSON.stringify(result)}\n`);
