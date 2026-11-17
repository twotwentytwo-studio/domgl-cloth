<template>
	<div v-if="show" aria-hidden="true" class="pointer-events-none fixed inset-0 z-999">
		<div class="site-max site-grid h-full">
			<div v-for="i in cols" :key="i" class="h-full bg-[#ff00aa]/10" />
		</div>
	</div>
</template>

<script setup lang="ts">
/*
 * The design-grid overlay — Shift+G. Draws .site-grid's own tracks over the
 * page, so a layout can be eyeballed against the comp and an item that fell
 * off the grid (an out-of-range col-start auto-places rather than erroring)
 * is visible rather than merely wrong by a column.
 *
 * It stands in site-max and site-grid and counts --site-cols live, so it can
 * never disagree with the grid it draws — a second spelling of the columns
 * or the gutter here is how an overlay and a page drift apart.
 */

const show = ref(false)
const cols = ref(0)

const measure = () => {
	cols.value = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--site-cols')) || 12
}

const keydown = (e: KeyboardEvent) => {
	if (!e.shiftKey || e.code !== 'KeyG') return

	const t = e.target as HTMLElement | null
	if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return

	measure()
	show.value = !show.value
}

onMounted(() => {
	window.addEventListener('keydown', keydown)
	window.addEventListener('resize', measure)
})

onUnmounted(() => {
	window.removeEventListener('keydown', keydown)
	window.removeEventListener('resize', measure)
})
</script>
