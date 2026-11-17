<template>
	<div ref="stage" class="pointer-events-none fixed inset-0 overflow-clip transition-opacity" :class="{ 'opacity-0': veiled }">
		<ul ref="list" class="absolute inset-x-0 top-0 flex flex-col items-center">
			<li
				v-for="(slide, i) in SLIDES"
				:key="i"
				class="contain-paint transition-opacity"
				:class="i === active ? 'opacity-100' : 'opacity-10'"
			>
				<gl-text tag="span" class="t-display -my-[30vh] block py-[30vh] whitespace-nowrap" mode="lens" :duration="1.25" :delay="arrival(i)">{{ slide.title }}</gl-text>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
const STIR = 9

const REACH = 0.6

const RISE = 0.16
const SINK = 0.06

const FLAT = 0.002

defineProps<{
	veiled?: boolean
}>()

type Slide = HTMLElement & { _vrect?: { left: number; width: number } | null; _parked?: boolean }

const { $event } = useNuxtApp()

const stage = useTemplateRef<HTMLElement>('stage')
const list = useTemplateRef<HTMLElement>('list')

const arrival = (i: number) => 0.3 + Math.min(i, SLIDES.length - i) * 0.08

const active = ref(0)

const TRAIL = 0.3

const column = useColumn(list, stage, { listen: false, overscan: 1.5, bleed: (box) => box.height * TRAIL + line })

let pitch = 0
let line = 0
let origin = 0
let last = Number.NaN

let stale = 2

let pull = 0

const tug = (travel: number, ratio: number) => {
	const to = Math.tanh((travel / Math.max(ratio, 0.25)) * STIR)

	pull += (to - pull) * (1 - Math.pow(1 - (Math.abs(to) > Math.abs(pull) ? RISE : SINK), ratio))

	if (Math.abs(pull) < FLAT && !travel) pull = 0

	bow.current = -pull * REACH * innerHeight
}

const measure = (track: HTMLElement) => {
	const col = column.value
	const el = list.value
	const [a, b] = track.children as unknown as HTMLElement[]
	const [c, d] = (el?.children ?? []) as unknown as HTMLElement[]
	if (!col || !a || !b || !c || !d) return false

	pitch = b.offsetLeft - a.offsetLeft
	line = d.offsetTop - c.offsetTop

	col.measure()

	col.center(0)
	origin = col.y
	last = Number.NaN

	return pitch > 0 && line > 0
}

const follow = (track: HTMLElement, ratio: number) => {
	const col = column.value
	if (!col) return

	if (stale > 0) {
		if (--stale > 0 || !measure(track)) {
			stale = Math.max(stale, 1)
			return
		}
	}

	const middle = innerWidth / 2

	let index = -1
	let offset = Infinity

	for (let i = 0; i < track.children.length; i++) {
		const slide = track.children[i] as Slide
		if (slide._parked) continue

		const r = slide._vrect ?? slide.getBoundingClientRect()
		const d = middle - (r.left + r.width / 2)

		if (Math.abs(d) < Math.abs(offset)) {
			offset = d
			index = i
		}
	}

	if (index < 0) return

	const at = index + offset / pitch

	const travel = Number.isNaN(last) || Math.abs(at - last) > 4 ? 0 : at - last

	tug(Math.abs(travel) < 1e-4 ? 0 : travel, ratio)

	if (Math.abs(at - last) < 1e-4) return
	last = at

	col.to(origin + at * line, true)

	const count = SLIDES.length
	const i = ((Math.round(at) % count) + count) % count

	if (i !== active.value) active.value = i
}

const resized = () => {
	stale = 2
}

onMounted(() => {
	$event.on('resize', resized)
})
onBeforeUnmount(() => {
	$event.off('resize', resized)
	bow.current = 0
})

if (import.meta.client) document.fonts?.ready.then(resized)

defineExpose({ follow })
</script>
