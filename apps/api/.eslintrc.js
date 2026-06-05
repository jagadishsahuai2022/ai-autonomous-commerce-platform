// Using .eslintrc.js (instead of .eslintrc.json) so we can use __dirname for
// tsconfigRootDir. This ensures VS Code's ESLint extension resolves the tsconfig
// relative to this file, not the workspace root's cwd.
/** @type {import('eslint').Linter.Config} */
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
  ignorePatterns: [
    '.eslintrc.js',
    'jest.config.ts',
    'prisma.config.ts',
    'prisma.config.updated.ts',
    'tests/**/*',
    'dist/**/*',
    'node_modules/**/*',
  ],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': 'off',
    'prefer-const': 'warn',
    'no-var': 'error',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/ban-types': 'off',
  },
  overrides: [
    {
      files: ['prisma/seed*.ts', 'prisma/seed*.js'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
