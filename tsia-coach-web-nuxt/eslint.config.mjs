// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import vuejsAccessibility from 'eslint-plugin-vuejs-accessibility'

const playgroundFiles = [
  'app/pages/dev/playground.vue',
  'app/components/playground/**/*.vue',
]

const [
  accessibilitySetup,
  accessibilityRules,
] = vuejsAccessibility.configs['flat/recommended']

export default withNuxt(
  accessibilitySetup,
  {
    ...accessibilityRules,
    files: playgroundFiles,
  },
  {
    files: playgroundFiles,
    rules: {
      'max-statements-per-line': ['error', { max: 1 }],
      'vue/attributes-order': 'warn',
      'vue/block-order': ['error', {
        order: ['script', 'template', 'style'],
      }],
      'vue/first-attribute-linebreak': ['error', {
        singleline: 'beside',
        multiline: 'below',
      }],
      'vue/html-closing-bracket-newline': ['error', {
        singleline: 'never',
        multiline: 'always',
      }],
      'vue/html-indent': ['error', 2],
      'vue/max-attributes-per-line': ['error', {
        singleline: { max: 1 },
        multiline: { max: 1 },
      }],
      'vue/multiline-html-element-content-newline': 'error',
      'vue/singleline-html-element-content-newline': ['error', {
        ignoreWhenNoAttributes: true,
        ignores: ['pre', 'textarea'],
      }],
      // Nuxt UI controls are components, which this rule cannot associate
      // with their wrapping labels.
      'vuejs-accessibility/label-has-for': 'off',
    },
  },
  {
    files: [
      'app/components/playground/AlgebraTilePlayground.vue',
      'app/components/playground/ArrayBaseTenPlayground.vue',
    ],
    rules: {
      // These focusable board viewports intentionally implement pointer
      // interaction while their child manipulatives provide keyboard input.
      'vuejs-accessibility/no-static-element-interactions': 'off',
    },
  },
)
