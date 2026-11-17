<template>
	<dom-gl :tick :options="{ bow: () => bow.current, textures: { minCompressed: 800 } }">
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</dom-gl>
</template>

<script setup lang="ts">
useHead({
	htmlAttrs: { lang: 'en' },
	meta: [
		{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
		{ name: 'theme-color', content: '#d9d9d9' },
	],
})

const { $event } = useNuxtApp()

const tick = (fn: (ratio: number) => void) => {
	const beat = ({ ratio }: { ratio: number }) => fn(ratio)

	$event.on('tick', beat)
	return () => $event.off('tick', beat)
}
</script>
