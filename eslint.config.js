import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'src/routeTree.gen.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Feature code goes through the app's wrappers: components/ui for Base UI primitives and
    // lib/notify for toasts, so either library can be swapped in one place.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/components/ui/**', 'src/lib/notify.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'sonner', message: 'Use notify from @/lib/notify.' }],
          patterns: [{ group: ['@base-ui/react', '@base-ui/react/*'], message: 'Use the components in @/components/ui.' }],
        },
      ],
    },
  },
  {
    // Vendored shadcn output exports variants next to components, and TanStack Router route
    // files export `Route`; the router plugin handles their hot reload.
    files: ['src/components/ui/**', 'src/routes/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
