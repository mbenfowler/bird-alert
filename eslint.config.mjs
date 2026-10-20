import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import cypress from 'eslint-plugin-cypress'
import query from '@tanstack/eslint-plugin-query'

export default tseslint.config(
  { ignores: ['dist', 'build', 'node_modules'] },
  {
    files: ['src/**/*.{ts,tsx}', 'vite.config.mts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, ...query.configs['flat/recommended']],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
    }
  },
  {
    files: ['cypress/**/*.js', 'cypress.config.js'],
    extends: [js.configs.recommended, cypress.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } }
  }
)
