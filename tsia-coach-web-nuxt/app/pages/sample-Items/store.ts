import {defineStore} from "pinia";
import type { SampleItem } from '#shared/types/sample-items'

export const useSampleItemsStore = defineStore('sampleItems', () => {
    const items = ref<SampleItem[]>([])
    const selectedId = ref<string | null>(null)

    const selected = computed(
        () => items.value.find(i => i.id === selectedId.value) ?? null
    )
    async function load() {
        items.value = await $fetch<SampleItem[]>('/api/sample-items')
    }

    const first = computed(() => items.value[0] ?? null)

    function select(id: string) {
        selectedId.value = id
    }



    type Span = {
        start: number | string
        length: number | string
    }

    function joinTokens(tokens: Array<{ surface: string }>): string {
        return tokens.reduce((result, token) => {
            const value = token.surface

            if (!result) {
                return value
            }

            const attachesToPrevious = /^[,.;:!?%)\]}]$/.test(value)

            return attachesToPrevious
                ? result + value
                : `${result} ${value}`
        }, '')
    }

    function getSpanText(
        item: SampleItem,
        span: Span,
    ): string {
        const start = Number(span.start)
        const length = Number(span.length)
        const tokens = item.text.tokens.slice(start, start + length)

        return joinTokens(tokens)
    }

    function getQuestionText(item: SampleItem): string {
        return item.text.sentences
            .map(sentence => getSpanText(item, sentence.span))
            .join(' ')
    }

    return { items, selectedId, selected, select, load, first }
})