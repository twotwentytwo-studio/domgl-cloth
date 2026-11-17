<template>
	<div>
		<Titles ref="titles" :veiled="cloth.veil.value" />
		<Strip :move :held="cloth.open.value" :go="cloth.unveiled.value" :sourced="cloth.sourced.value" />
		<DetailPage v-if="cloth.page.value" v-bind="cloth.page.value" :scrolled="cloth.scrolled" />
		<ArticlePage v-if="cloth.article.value" v-bind="cloth.article.value" :scrolled="cloth.scrolled" />
		<CoverPage v-if="cloth.cover.value" />
		<Chrome :how="cloth.read" :shown="cloth.unveiled.value" />

		<div
			v-if="!bared"
			class="pointer-events-none fixed inset-0 z-30 bg-sheet transition-opacity"
			:class="{ 'opacity-0': !cloth.covered.value }"
			@transitionend="bared = true"
		/>

		<div v-if="cloth.unsupported.value" class="fixed inset-0 z-40 flex items-center bg-sheet p-(--margin) text-ink">
			<p class="t-label">This demo only works in WebGPU-enabled browsers.</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { Column } from '@alpacka/scroll'

useSeo({ title: 'Draped cloth — a DomGL carousel' })

const titles = useTemplateRef<{ follow: (track: HTMLElement, ratio: number) => void }>('titles')

const cloth = useCloth()

const bared = ref(false)

const move = (column: Column, track: HTMLElement, ratio: number) => {
	cloth.move(column, track, ratio)
	titles.value?.follow(track, ratio)
}
</script>
