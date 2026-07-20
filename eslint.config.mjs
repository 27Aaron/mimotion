import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['lib/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@/app/**', '@/features/**'],
          message: 'Shared infrastructure must not depend on routes or feature internals.',
        }],
      }],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    '.worker/**',
    'next-env.d.ts',
  ]),
])
