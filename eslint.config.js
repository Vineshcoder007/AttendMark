import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // PascalCase names are React components used via JSX — no-unused-vars
      // doesn't track JSX references, so we ignore them here.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z]' }],
      // Async data-fetching via useEffect → setState is the standard React
      // pattern; this rule produces false positives for it.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
