import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['script.js'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ['*.js'],
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'eqeqeq': 'error',
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },
];
