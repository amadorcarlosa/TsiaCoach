<script setup lang="ts">
import {useSampleItemsStore} from "~/pages/sample-Items/store.ts";
import {storeToRefs} from "pinia";

const store = useSampleItemsStore()
const { first } = storeToRefs(store)

await store.load()
</script>

<template>
  <div v-if="first">
    <h1>{{ first.id}}</h1>
    <p>{{first.text}}   </p>
    <p>{{first.answers}}</p>
    <p>{{first.semantics}}</p>
  </div>
  <p v-else>No items.</p>
</template>
