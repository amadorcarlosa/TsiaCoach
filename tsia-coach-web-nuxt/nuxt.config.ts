// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  runtimeConfig: {
    apiUrl: '',
  },
  modules: ['@nuxt/ui', '@nuxt/content', '@pinia/nuxt'],

  content: {
    experimental: {
      sqliteConnector: 'better-sqlite3',
    },
  },

})
