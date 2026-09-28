import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['out/**', 'dist/**', 'node_modules/**', 'resources/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'error',
    },
  },
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'src/core/**/*.ts', 'scripts/**/*.mjs', '*.config.*'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // Renderer must never reach Node/Electron directly; go through window.voxcribe.
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['electron', 'node:*', 'fs', 'path', 'child_process', 'os'], message: 'Use window.voxcribe via preload.' },
            { group: ['@core/*', '**/core/**'], message: 'Renderer must not import main-process core code.' },
          ],
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
);
