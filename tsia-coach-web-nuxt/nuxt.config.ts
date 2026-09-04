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
  },
  modules: ['@nuxt/ui', '@nuxt/content', '@pinia/nuxt', '@nuxt/eslint'],

  content: {
    experimental: {
      sqliteConnector: 'better-sqlite3',
    },
  },

})
