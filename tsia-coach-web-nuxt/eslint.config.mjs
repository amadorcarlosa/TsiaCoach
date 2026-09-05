// @ts-check
// Generated base config lives in .nuxt/eslint.config.mjs (run `nuxt prepare`).
// It already knows about Nuxt auto-imports, Vue SFCs, and TypeScript.
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    ignores: [
      'build/**',
      'test-results/**',
      'playwright-report/**',
      'public/**',
      '**/*.generated.ts',
    ],
  },
  {
    rules: {
      // Unused values are a bug signal, but a leading underscore marks them as intentional.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Nuxt pages and layouts are conventionally single-word (index, default).
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    // Tests stub real types freely; `any` is acceptable there but not in app code.
    files: ['**/*.spec.ts', '**/*.test.ts', 'tests/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
