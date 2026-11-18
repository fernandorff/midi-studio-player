import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'demo/assets'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  prettier,
  // noUncheckedIndexedAccess makes every index read optional; `!` marks the reads already proven in bounds
  { rules: { '@typescript-eslint/no-non-null-assertion': 'off' } },
);
