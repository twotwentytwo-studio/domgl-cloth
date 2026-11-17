<template>
	<main>
		<h1>{{ status }}</h1>
		<p>{{ message }}</p>
		<NuxtLink to="/" @click.prevent="clearError({ redirect: '/' })">Home</NuxtLink>
	</main>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

/**
 * The error page, and the reason 404s on a kit site are real 404s.
 *
 * A page whose record is missing throws `createError({ statusCode: 404,
 * fatal: true })` rather than rendering an empty state. The difference is not
 * visual, it is the status line: a soft 404 returns 200, and a crawler
 * indexes it, keeps the dead URL, and spends crawl budget re-fetching it.
 * The 503 is the other direction: a CMS that cannot be reached is temporary,
 * and answering 404 to it invites Google to drop pages that are fine.
 *
 * Unstyled on purpose — every site designs its own. Replace it with the
 * project's app/error.vue; keep the statuses and the noindex.
 */
const props = defineProps<{ error?: NuxtError }>()

const status = computed(() => props.error?.statusCode ?? 500)

const message = computed(() => {
	if (status.value === 404) return 'Page not found.'
	if (status.value === 503) return 'The site is briefly unavailable. Try again in a moment.'
	return 'Something went wrong.'
})

useHead({ title: () => `${status.value}` })

/* an error page is never indexed, whatever the site's own setting */
useSeoMeta({ robots: 'noindex, nofollow' })
</script>
