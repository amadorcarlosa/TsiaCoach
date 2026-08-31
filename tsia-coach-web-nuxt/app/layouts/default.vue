<script setup lang="ts">
import AppFooter from "~/components/AppFooter.vue";
</script>
<template>
  <div class="flex min-h-screen flex-col bg-(--mt-bg) text-(--mt-text)">
    <AppHeader />

    <UMain class="flex-1">
      <slot />
    </UMain>

    <AppFooter />
  </div>
</template>
