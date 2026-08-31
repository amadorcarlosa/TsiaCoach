<script setup lang="ts">
import '~/assets/css/main.css'

useHead({
  htmlAttrs: {
    lang: 'en'
  },
  link: [{
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com'
  }, {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossorigin: ''
  }, {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Source+Sans+3:wght@300;400;500;600;700&display=swap'
  }]
})

useSeoMeta({
  title: 'TSIA Coach',
  description: 'Clear the TSIA2 math gate with scaffolded walkthroughs — not memorization.'
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<style>
html,
body,
#__nuxt {
  min-height: 100%;
}

body {
  margin: 0;
  font-family: "Source Sans 3", system-ui, sans-serif;
}

code,
pre,
kbd,
samp {
  font-family: "JetBrains Mono", monospace;
}
</style>
