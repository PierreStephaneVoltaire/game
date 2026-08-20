import { en, type Copy } from './en';

export type CopyKey = keyof Copy;

export const copy: Copy = en;

export function translate(value: string, variables: Record<string, string>) {
  return value.replace(
    /\{(\w+)\}/g,
    (_, key: string) => variables[key] ?? `{${key}}`,
  );
}

export function createTranslator(variables: Record<string, string>) {
  return (value: string) => translate(value, variables);
}
