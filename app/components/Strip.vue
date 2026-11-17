<template>
	<main ref="stage" class="fixed inset-0 overflow-clip">
		<div ref="track" class="absolute left-0 top-1/2 flex -translate-y-1/2 gap-x-10 s:gap-x-20">
			<div
				v-for="(slide, i) in SLIDES"
				:key="i"
				:data-slide="i"
				class="relative aspect-[3/4] w-280 shrink-0 s:w-360"
			>
				<gl-media :src="sourced ? slide.src : ''" material="ghost" :alt="slide.title" />
			</div>
		</div>
	</main>
</template>

<script setup lang="ts">
import type { Column } from '@alpacka/scroll'
import { gsap } from 'gsap'
import { AXIS, SQUASH, clears } from '~/shaders/rig'

const props = defineProps<{
	move?: (column: Column, track: HTMLElement, ratio: number) => void
	held?: boolean
	go?: boolean
	sourced?: boolean
}>()

const { $event } = useNuxtApp()

const stage = useTemplateRef<HTMLElement>('stage')
const track = useTemplateRef<HTMLElement>('track')

const column = useColumn(track, stage, {
	x: true,
	overscan: 3,
	listen: () => !props.held,
	transforms: false,
	bleed: (box) => {
		const slide = track.value?.firstElementChild as HTMLElement | null

		return slide ? clears(slide.offsetWidth, slide.offsetHeight, box.width, box.height) : 0
	},
})

useDragScroll({
	axis: () => (props.held ? [0, 1] : AXIS),
	gear: () => (props.held ? 1.5 : 1.5 / SQUASH),
	finger: () => (props.held ? null : FINGER),
})

const FINGER: [number, number] = [Math.SQRT1_2, -Math.SQRT1_2]

const unfinger = ({ deltaY, event }: { deltaY: number; event?: Event | null }) => {
	if (props.held || !deltaY || typeof TouchEvent === 'undefined' || !(event instanceof TouchEvent)) return

	column.value?.add(0, -deltaY)
}

const ENTER = { from: 1.5, wait: 0.15, ease: 0.04 }

const EASE = 0.1

let entering: gsap.core.Tween | null = null

let gliding = false
let released = false
let stop: (() => void) | null = null

const landed = () => {
	if (!gliding) return

	gliding = false
	column.value?.set({ ease: EASE })

	for (const type of TAKES) removeEventListener(type, landed)
}

const TAKES = ['wheel', 'pointerdown', 'keydown', 'touchstart'] as const

const frame = ({ ratio }: { ratio: number }) => {
	if (gliding && released && column.value && Math.abs(column.value.gap) < 0.5) landed()

	if (column.value && track.value) props.move?.(column.value, track.value, ratio)
}

onMounted(async () => {
	$event.on('pre-tick', frame)
	$event.on('vs', unfinger)

	await nextTick()

	const col = column.value
	const first = track.value?.firstElementChild as HTMLElement | null
	if (!col || !first) return

	col.center(0)

	col.to(col.y - innerWidth * ENTER.from, true)
	col.set({ ease: ENTER.ease })

	gliding = true

	stop = watch(() => props.go, (go) => {
		if (!go || entering) return

		for (const type of TAKES) addEventListener(type, landed, { passive: true })

		entering = gsap.delayedCall(ENTER.wait, () => {
			col.seek(0)
			released = true
		})
	}, { immediate: true })
})

onBeforeUnmount(() => {
	$event.off('pre-tick', frame)
	$event.off('vs', unfinger)

	stop?.()
	entering?.kill()
	landed()
})
</script>
