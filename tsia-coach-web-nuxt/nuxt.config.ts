// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  pages: {
    pattern: ['**/*.vue', '!**/components/**/*.vue'],
  },

  hooks: {
    'vite:extendConfig'(config) {
      const include = config.optimizeDeps?.include

      if (!include) {
        return
      }

      config.optimizeDeps.include = include.map(dependency =>
        dependency.replace(
          /^@nuxtjs\/mdc > /,
          '@nuxt/content > @nuxtjs/mdc > '
        )
      )
    },
  },

  runtimeConfig: {
    apiUrl: '',
    public: {
      telemetryEnabled: false,
      telemetrySamplingRatio: 1,
      // Learner action log (docs/architecture/playground-event-log-plan.md). Off until
      // storage, retention and consent are decided.
      playgroundEventsEnabled: false,
      // 'opt-in': record nothing until the learner accepts the notice in this
      // browser. 'not-required': consent is handled outside the app.
      playgroundEventsConsent: 'opt-in',
      // Shown in the consent notice; keep equal to the API's PlaygroundEvents:RetentionDays.
      playgroundEventsRetentionDays: 180,
    },
  },
  modules: ['@nuxt/ui', '@nuxt/content', '@nuxt/eslint'],

  content: {
    experimental: {
      sqliteConnector: 'better-sqlite3',
    },
  },
  typescript: {
    nodeTsConfig: {
      include: ['../vitest.config.*'],
    },
  },

})
