<script setup lang="ts">
import type { components } from '~~/server/types/schema'

type Model = components['schemas']['FoundryDeploymentResponse']

definePageMeta({
  layout: 'admin'
})

useSeoMeta({
  title: 'Admin · TSIA Coach',
  description: 'Operational overview for TSIA Coach.'
})

const {
  data: health,
  status: healthStatus,
  refresh: refreshHealth
} = await useFetch<{ ok: boolean }>('/api/health')

const {
  data: models,
  status: modelsStatus,
  error: modelsError,
  refresh: refreshModels
} = await useFetch<Model[]>('/api/models', {
  default: () => []
})

const refreshing = ref(false)

const apiHealthy = computed(() => (
  healthStatus.value === 'success' && health.value?.ok === true
))

async function refreshOverview() {
  refreshing.value = true

  try {
    await Promise.all([
      refreshHealth(),
      refreshModels()
    ])
  } finally {
    refreshing.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <section class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="mt-eyebrow">
          Internal operations
        </p>
        <h1 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Admin overview
        </h1>
        <p class="mt-3 max-w-2xl text-base leading-relaxed text-(--mt-text-sub)">
          Check the services and model catalog that power the TSIA Coach experience.
        </p>
      </div>

      <UButton
        label="Refresh status"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="refreshing"
        class="self-start sm:self-auto"
        @click="refreshOverview"
      />
    </section>

    <UAlert
      title="Access controls are not enabled"
      description="This workspace is intentionally open for now. Add authentication and authorization before exposing it outside local development."
      icon="i-lucide-shield-alert"
      color="warning"
      variant="subtle"
    />

    <section
      class="grid gap-4 md:grid-cols-3"
      aria-label="System summary"
    >
      <article class="mt-panel p-5">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="font-mono text-xs font-medium uppercase tracking-[0.14em] text-(--mt-text-muted)">
              API
            </p>
            <p class="mt-3 text-2xl font-semibold tracking-tight">
              {{ apiHealthy ? 'Healthy' : healthStatus === 'pending' ? 'Checking' : 'Unavailable' }}
            </p>
          </div>

          <span
            class="mt-1 h-2.5 w-2.5 rounded-full"
            :class="apiHealthy ? 'bg-green-600' : healthStatus === 'pending' ? 'bg-orange-500' : 'bg-red-600'"
            aria-hidden="true"
          />
        </div>
        <p class="mt-2 text-sm leading-relaxed text-(--mt-text-sub)">
          Nuxt server route health.
        </p>
      </article>

      <article class="mt-panel p-5">
        <p class="font-mono text-xs font-medium uppercase tracking-[0.14em] text-(--mt-text-muted)">
          Model catalog
        </p>
        <p class="mt-3 text-2xl font-semibold tracking-tight">
          {{ modelsStatus === 'pending' ? '—' : models?.length ?? 0 }}
        </p>
        <p class="mt-2 text-sm leading-relaxed text-(--mt-text-sub)">
          Deployments available to the coach.
        </p>
      </article>

      <article class="mt-panel p-5">
        <p class="font-mono text-xs font-medium uppercase tracking-[0.14em] text-(--mt-text-muted)">
          Admin access
        </p>
        <p class="mt-3 text-2xl font-semibold tracking-tight">
          Open
        </p>
        <p class="mt-2 text-sm leading-relaxed text-(--mt-text-sub)">
          No sign-in or role checks yet.
        </p>
      </article>
    </section>

    <section class="mt-panel overflow-hidden">
      <div class="flex flex-col gap-2 border-b border-(--mt-border) px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            Available models
          </h2>
          <p class="mt-1 text-sm text-(--mt-text-sub)">
            Live inventory reported by the API.
          </p>
        </div>

        <UBadge
          :label="modelsStatus === 'pending' ? 'Loading' : `${models?.length ?? 0} total`"
          color="neutral"
          variant="subtle"
        />
      </div>

      <div
        v-if="modelsStatus === 'pending'"
        class="space-y-3 p-5"
      >
        <USkeleton class="h-14 w-full" />
        <USkeleton class="h-14 w-full" />
      </div>

      <div
        v-else-if="modelsError"
        class="p-5"
      >
        <p class="font-medium text-red-600">
          The model catalog could not be loaded.
        </p>
        <p class="mt-1 text-sm text-(--mt-text-sub)">
          Confirm the API is available, then refresh this page.
        </p>
      </div>

      <ul
        v-else-if="models?.length"
        class="divide-y divide-(--mt-border)"
      >
        <li
          v-for="model in models"
          :key="model.name"
          class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0">
            <p class="truncate font-semibold">
              {{ model.displayName }}
            </p>
            <code class="mt-1 block truncate text-xs text-(--mt-text-muted)">
              {{ model.name }}
            </code>
          </div>

          <UBadge
            :label="model.vendor"
            color="neutral"
            variant="outline"
            class="self-start sm:self-auto"
          />
        </li>
      </ul>

      <div
        v-else
        class="p-5"
      >
        <p class="font-medium">
          No models are available.
        </p>
        <p class="mt-1 text-sm text-(--mt-text-sub)">
          Add a model deployment to the API configuration, then refresh this page.
        </p>
      </div>
    </section>
  </div>
</template>
