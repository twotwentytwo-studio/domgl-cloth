<template>
	<article
		class="pointer-events-none fixed z-10 text-ink [container-type:size]"
		:style="{ left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` }"
	>
		<div ref="pane" class="absolute inset-x-0 inset-y-[4cqw] overflow-clip">
			<div ref="sheet" class="px-[6.7cqw]">
				<section class="flex min-h-[min(85cqw,calc(100cqh_-_10.7cqw))] flex-col justify-between pt-[2.7cqw]">
					<header>
						<div class="flex justify-between opacity-55">
							<gl-text tag="p" class="t-sheet-label" :duration="0.5">No. {{ number }}</gl-text>
							<gl-text tag="p" class="t-sheet-label" :duration="0.5">Series</gl-text>
						</div>

						<gl-text tag="h2" class="t-sheet-title mt-[9cqw] -ml-[.8cqw]" :duration="1.25" :delay="0.05">{{ poster.title }}</gl-text>
					</header>

					<dl>
						<div v-for="([label, value], i) in poster.facts" :key="label" class="relative flex justify-between py-[2cqw]">
							<div class="absolute inset-x-0 top-0 h-px origin-left transition-transform duration-1000 ease-(--ease-snappy)" :class="{ 'scale-x-0': !ruled }">
								<gl-solid class="size-full bg-ink/15" />
							</div>

							<gl-text tag="dt" class="t-sheet-label opacity-55" :duration="0.5" :delay="0.25 + i * 0.07">{{ label }}</gl-text>
							<gl-text tag="dd" class="t-sheet-label" :duration="0.5" :delay="0.25 + i * 0.07">{{ value }}</gl-text>
						</div>
					</dl>
				</section>

				<ol class="flex flex-col gap-[6.7cqw] pt-[6.7cqw] pb-[2.7cqw]">
					<li v-for="src in poster.series" :key="src" class="relative aspect-[3/4] w-full">
						<gl-media :src lazy sizes="40vw" />
					</li>
				</ol>
			</div>
		</div>
	</article>
</template>

<script setup lang="ts">
import type { Poster } from '~/utils/posters'

const props = defineProps<{
	poster: Poster
	index: number
	box: { left: number; top: number; width: number; height: number }
	scrolled?: (dy: number) => void
}>()

const number = computed(() => String(props.index + 1).padStart(2, '0'))

const pane = useTemplateRef<HTMLElement>('pane')
const sheet = useTemplateRef<HTMLElement>('sheet')

const column = useColumn(sheet, pane, { whole: true, loop: false })

const FADE = 0

const { $event } = useNuxtApp()

let top = -1
let foot = -1

let was = 0

const fade = () => {
	const col = column.value
	const el = pane.value
	if (!col || !el) return

	if (col.y !== was) {
		props.scrolled?.(col.y - was)
		was = col.y
	}

	const most = props.box.width * FADE

	const above = Math.round(Math.min(most, Math.max(0, col.y)))
	const below = Math.round(Math.min(most, Math.max(0, col.max - col.y)))

	if (above !== top) el.style.setProperty('--gl-feather-top', `${(top = above)}px`)
	if (below !== foot) el.style.setProperty('--gl-feather-bottom', `${(foot = below)}px`)
}

onMounted(() => $event.on('tick', fade))
onBeforeUnmount(() => $event.off('tick', fade))

const ruled = ref(false)

onMounted(() => requestAnimationFrame(() => (ruled.value = true)))
</script>
