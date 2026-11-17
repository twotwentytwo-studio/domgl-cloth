<template>
	<article
		class="pointer-events-none fixed z-10 text-ink [container-type:size]"
		:style="{ left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` }"
	>
		<div ref="pane" class="absolute inset-x-0 inset-y-[4cqw] overflow-clip">
			<div ref="sheet" class="px-[6.7cqw] pb-[8cqw]">
				<header class="pt-[2.7cqw]">
					<div class="flex justify-between">
						<gl-text tag="p" class="t-sheet-note" data-cue="by" reveal="enter" :duration="0.5" :delay="cue('by')">Codrops &times; Jesper Landberg</gl-text>
						<gl-text tag="p" class="t-sheet-note" data-cue="notes" reveal="enter" :duration="0.5" :delay="cue('notes')">Notes</gl-text>
					</div>

					<gl-text tag="h2" class="t-sheet-heading mt-[9cqw] -ml-[.6cqw] whitespace-nowrap" data-cue="title" reveal="enter" :duration="1.25" :delay="cue('title')">{{ ARTICLE.title }}</gl-text>

					<gl-text tag="p" class="t-sheet-lede mt-[6cqw] max-w-[72.5cqw] max-s:max-w-none" data-cue="lede" reveal="enter" :duration="0.5" :stagger="LINE.lede" :delay="cue('lede')">{{ ARTICLE.lede }}</gl-text>
				</header>

				<section v-for="(part, i) in ARTICLE.sections" :key="part.label" class="mt-[13cqw] max-w-[72.5cqw] max-s:max-w-none">
					<gl-text tag="h3" class="t-sheet-lede" :data-cue="`label-${i}`" reveal="enter" :duration="0.5" :delay="cue(`label-${i}`)">{{ part.label }}</gl-text>

					<div class="mt-[3cqw] flex flex-col gap-y-[2.4cqw]">
						<gl-text v-for="(text, n) in part.body" :key="text" tag="p" class="t-sheet-body text-ink/55" :data-cue="`copy-${i}-${n}`" reveal="enter" :duration="0.5" :stagger="LINE.copy" :delay="cue(`copy-${i}-${n}`)">
							<template v-for="(bit, b) in bits(text)" :key="b"><span v-if="b % 2" class="text-ink">{{ bit }}</span><template v-else>{{ bit }}</template></template>
						</gl-text>
					</div>
				</section>
			</div>
		</div>
	</article>
</template>

<script setup lang="ts">
import { ARTICLE, bits } from '~/utils/article'

const props = defineProps<{
	box: { left: number; top: number; width: number; height: number }
	scrolled?: (dy: number) => void
}>()

const PACE = 0.01
const BEAT = 0.05
const LINE = { lede: 4.45 * 1.25 * PACE, copy: 2.85 * 1.4 * PACE }

const wait = (el: Element | null | undefined) => {
	const frame = pane.value
	if (!el || !frame) return 0

	const box = el.getBoundingClientRect()
	const top = box.top - frame.getBoundingClientRect().top

	if (frame.clientHeight - top < Math.max(1, box.height * 0.15)) return 0

	return BEAT + (Math.max(0, top) / props.box.width) * 100 * PACE
}

const cue = (key: string) => () => wait(pane.value?.querySelector(`[data-cue="${key}"]`))

const pane = useTemplateRef<HTMLElement>('pane')
const sheet = useTemplateRef<HTMLElement>('sheet')

const column = useColumn(sheet, pane, { whole: true, loop: false })

const { $event } = useNuxtApp()

let was = 0

const moved = () => {
	const col = column.value
	if (!col || col.y === was) return

	props.scrolled?.(col.y - was)
	was = col.y
}

onMounted(() => $event.on('tick', moved))
onBeforeUnmount(() => $event.off('tick', moved))
</script>
