import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Immutable client approval package; maintained in the Gazeta source repository.
  { ignores: ['dist', 'public/prototipos/gazeta-bragantina/aprovacao-15-09/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['public/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['*.config.cjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        fetch: 'readonly',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
)
