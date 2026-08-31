<template>
  <footer class="mt-auto border-t border-(--mt-border) bg-(--mt-bg-elevated)">
    <UContainer class="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 py-8 text-sm text-(--mt-text-muted)">
      <p>TSIA Coach · Built on the MathTabla scaffold system</p>

      <nav
        class="flex flex-wrap gap-x-6 gap-y-2"
        aria-label="Footer navigation"
      >
        <a
          href="#"
          class="transition-colors hover:text-primary-600"
        >
          Accessibility
        </a>
        <a
          href="#"
          class="transition-colors hover:text-primary-600"
        >
          Privacy
        </a>
        <a
          href="#"
          class="transition-colors hover:text-primary-600"
        >
          Contact
        </a>
      </nav>
    </UContainer>
  </footer>
</template>

<style scoped>
a {
  text-decoration: none;
}
</style>
