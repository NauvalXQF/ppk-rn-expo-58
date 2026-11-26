import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig({ ignores: ['dist/**', 'coverage/**'] }, ...tseslint.configs.recommended, {
  files: ['tests/**/*.mjs', 'eslint.config.mjs'],
  rules: { 'no-unused-vars': 'error' },
});
