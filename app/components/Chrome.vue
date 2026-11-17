<template>
	<div
		class="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-(--margin) pt-safe-20 pb-safe-20 transition-opacity s:pt-safe-40 s:pb-safe-40"
		:class="{ 'opacity-0': !shown }"
	>
		<header data-corner="top" class="flex items-start gap-x-20 max-s:justify-between">
			<p class="t-label opacity-55">Codrops &times; Jesper Landberg</p>

			<button
				type="button"
				class="t-label -m-10 cursor-pointer p-10 transition-opacity hover:opacity-55 active:opacity-55"
				:class="shown ? 'pointer-events-auto' : 'pointer-events-none'"
				@pointerdown.stop
				@click.stop="how?.()"
			>
				How it works
			</button>
		</header>

		<footer data-corner="bottom" class="flex items-end justify-end gap-x-20 max-s:justify-between">
			<p class="t-label opacity-55">
				<span class="touch:hidden">Scroll, drag, click</span>
				<span class="has-hover:hidden">Swipe, tap</span>
			</p>

			<p class="t-label min-w-[7ch] text-right tabular-nums" aria-hidden="true">{{ fps }} FPS</p>
		</footer>
	</div>
</template>

<script setup lang="ts">
defineProps<{
	how?: () => void
	shown?: boolean
}>()

const { $event } = useNuxtApp()

const fps = ref('--')

const EVERY = 500

let frames = 0
let since = 0

const count = () => {
	const now = performance.now()

	if (!since) since = now

	frames++

	if (now - since < EVERY) return

	const next = String(Math.round((frames * 1000) / (now - since))).padStart(2, '0')

	if (next !== fps.value) fps.value = next

	frames = 0
	since = now
}

onMounted(() => $event.on('tick', count))
onBeforeUnmount(() => $event.off('tick', count))
</script>
