import js from '@eslint/js'
import tseslint from 'typescript-eslint'

// Pureza de dominio: el dominio no importa framework, cliente de datos ni E/S.
const FORBIDDEN = [
  'react', 'react-dom', 'react-*', '@supabase/*', 'pdf-lib', 'node:*', 'fs', 'path',
  'http', 'https', 'child_process', 'zod',
]

export default tseslint.config(
  { ignores: ['dist', 'reports', '.stryker-tmp', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: FORBIDDEN.map((group) => ({
        group: [group],
        message: 'El dominio es puro: nada de framework, datos ni E/S (ver AGENTS.md).',
      })) }],
      'no-restricted-globals': ['error', 'fetch', 'process', 'window', 'document', 'localStorage'],
    },
  },
)
