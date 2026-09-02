import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    files: ['api/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    ignores: ['api/dist/', 'build/', '.svelte-kit/', 'node_modules/'],
  },
];
