<script setup lang="ts">
const open = ref(false)

const items = [{
  label: 'How it works',
  to: '/#how'
}, {
  label: "What's on the test",
  to: '/#areas'
}]
</script>

<template>
  <div class="sticky top-0 z-40">
    <div
      class="mt-accent-strip"
      aria-hidden="true"
    />

    <UHeader
      v-model:open="open"
      class="mt-overlay border-b border-(--mt-border)"
    >
      <template #left>
        <NuxtLink
          to="/"
          class="flex items-baseline gap-0.5 rounded-md p-1 -ms-1 no-underline outline-primary/25 focus-visible:outline-3"
          aria-label="TSIA Coach home"
        >
          <span class="text-lg font-semibold tracking-tight text-(--mt-text)">
            TSIA
          </span>
          <span class="border-b-2 border-primary-500 pb-px text-lg font-semibold tracking-tight text-primary-600">
            Coach
          </span>
        </NuxtLink>
      </template>

      <UNavigationMenu
        :items="items"
        variant="link"
      />

      <template #right>
        <UColorModeButton
          color="neutral"
          variant="ghost"
          aria-label="Toggle color mode"
        />

        <NuxtLink
          to="#"
          class="hidden text-sm text-(--mt-text-sub) no-underline transition-colors hover:text-(--mt-text) lg:inline-flex"
        >
          Log in
        </NuxtLink>

        <UButton
          label="Start free"
          color="primary"
          class="hidden lg:inline-flex"
        />
      </template>

      <template #body>
        <UNavigationMenu
          :items="items"
          orientation="vertical"
          class="-mx-2.5"
        />

        <USeparator class="my-6" />

        <NuxtLink
          to="#"
          class="mb-3 flex justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-(--mt-text-sub) no-underline transition-colors hover:bg-(--mt-bg-inset) hover:text-(--mt-text)"
          @click="open = false"
        >
          Log in
        </NuxtLink>

        <UButton
          label="Start free"
          color="primary"
          block
          @click="open = false"
        />
      </template>
    </UHeader>
  </div>
</template>
