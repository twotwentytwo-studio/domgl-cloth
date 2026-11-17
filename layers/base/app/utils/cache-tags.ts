/**
 * The cache-tag header, and the one merge that builds it.
 *
 * Both sides need this and they live in different bundles: pages tag
 * themselves from the Vue app during SSR (useCacheTags), and Nitro routes tag
 * their own responses (addCacheTags in server/utils). Nitro's auto-imports do
 * not reach the app bundle and the app's do not reach Nitro, so the shared
 * part is a plain module the server imports by path.
 *
 * Sanity drafts share their published document's id under a `drafts.` prefix;
 * it is stripped so an edit and its publish resolve to the same tag. Nothing
 * else a CMS hands out starts with it.
 */
export const CACHE_TAG_HEADER = 'Netlify-Cache-Tag'

export const mergeCacheTags = (existing: unknown, tags: (string | null | undefined)[]) => {
	const merged = new Set([
		...String(existing ?? '')
			.split(',')
			.map((tag) => tag.trim())
			.filter(Boolean),
		...tags
			.filter((tag): tag is string => Boolean(tag))
			.map((tag) => tag.trim().replace(/^drafts\./, ''))
			.filter(Boolean),
	])

	return [...merged].join(',')
}
