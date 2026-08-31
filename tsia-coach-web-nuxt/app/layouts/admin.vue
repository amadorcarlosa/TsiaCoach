<script setup lang="ts">
const route = useRoute()

const navigation = computed(() => [{
  label: 'Overview',
  icon: 'i-lucide-layout-dashboard',
  to: '/admin',
  active: route.path === '/admin'
}, {
  label: 'Coach chat',
  icon: 'i-lucide-message-square-text',
  to: '/admin/chat',
  active: route.path.startsWith('/admin/chat')
}, {
  label: 'Public site',
  icon: 'i-lucide-arrow-up-right',
  to: '/'
}])
</script>

<template>
  <div class="min-h-screen bg-(--mt-bg) text-(--mt-text)">
    <div
      class="mt-accent-strip"
      aria-hidden="true"
    />

    <header class="mt-overlay sticky top-0 z-40 border-b border-(--mt-border)">
      <UContainer class="flex h-16 items-center justify-between gap-4">
        <NuxtLink
          to="/admin"
          class="flex min-w-0 items-center gap-3 rounded-md no-underline outline-primary/25 focus-visible:outline-3"
        >
          <span class="flex items-baseline gap-0.5">
            <span class="text-lg font-semibold tracking-tight text-(--mt-text)">TSIA</span>
            <span class="border-b-2 border-primary-500 pb-px text-lg font-semibold tracking-tight text-primary-600">
              Coach
            </span>
          </span>

          <span class="h-5 w-px bg-(--mt-border)" />
          <span class="truncate font-mono text-xs font-medium uppercase tracking-[0.16em] text-(--mt-text-muted)">
            Admin
          </span>
        </NuxtLink>

        <div class="flex items-center gap-2">
          <UColorModeButton
            color="neutral"
            variant="ghost"
            aria-label="Toggle color mode"
          />

          <UButton
            label="View site"
            icon="i-lucide-arrow-up-right"
            color="neutral"
            variant="outline"
            to="/"
            class="hidden sm:inline-flex"
          />
        </div>
      </UContainer>
    </header>

    <UContainer class="grid gap-8 py-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:py-8">
      <aside class="lg:sticky lg:top-24 lg:self-start">
        <p class="mt-eyebrow mb-3 px-2">
          Workspace
        </p>

        <UNavigationMenu
          :items="navigation"
          orientation="vertical"
          variant="link"
          class="-mx-2 lg:mx-0"
        />
      </aside>

      <main class="min-w-0 pb-12">
        <slot />
      </main>
    </UContainer>
  </div>
</template>
