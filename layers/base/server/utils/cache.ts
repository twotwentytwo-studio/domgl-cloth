import type { H3Event } from 'h3'
import { CACHE_TAG_HEADER, mergeCacheTags } from '../../app/utils/cache-tags'

/**
 * Cache tagging and invalidation.
 *
 * Every rendered response names what it was built from, the CDN stores those
 * names against it, and the CMS webhook asks the CDN to drop everything
 * carrying a name that changed. An edit to one case study purges that case
 * study and the listings that show it, not the site.
 *
 * `durable` in the CDN cache-control is what makes it worth doing on Netlify:
 * without it a response only lives in the edge node that served it, and a
 * purge has nothing central to purge.
 */

export const addCacheTags = (event: H3Event, tags: (string | null | undefined)[]) => {
	const value = mergeCacheTags(getResponseHeader(event, CACHE_TAG_HEADER), tags)
	if (!value) return

	setResponseHeader(event, CACHE_TAG_HEADER, value)
}

/**
 * The CDN cache-control for a cacheable response — a page, a rendition, a
 * content payload.
 *
 * `s-maxage` long and the BROWSER's short, on purpose: a purge reaches the CDN
 * and can never reach a browser that already has the file, so anything cached
 * client-side is a stale page no webhook can fix. The CDN holds it, the
 * browser re-asks every time and is answered from the edge.
 *
 * `Netlify-Vary` does two jobs:
 *
 * - `cookie=<draft cookie>` keeps an editor out of the published cache.
 *   Without it a previewing request for a URL the CDN already holds is
 *   answered from the cache and never reaches the function that would have
 *   rendered the draft.
 * - `query=…` for a response whose query string IS its identity. Netlify
 *   leaves query parameters out of the cache key by default (utm tags would
 *   otherwise shred the hit rate), so /api/content/page?v={"slug":"a"} and
 *   ?v={"slug":"b"} would share one entry. Name the parameters that matter.
 */
export const setPageCacheControl = (event: H3Event, maxAge: number, options: { query?: string[] } = {}) => {
	/* Behind the staging password, nothing is cached at all. A CDN answers a
	   cached URL without running the function, which is where the password is
	   checked — so the first authenticated visit would publish the page to
	   every visitor after it. */
	if (useRuntimeConfig().basicAuth) return setNoStore(event)

	setResponseHeader(
		event,
		'Netlify-CDN-Cache-Control',
		`public, durable, s-maxage=${maxAge}, stale-while-revalidate=604800`,
	)
	setResponseHeader(event, 'Cache-Control', 'public, max-age=0, must-revalidate')

	const { draftCookie } = kitConfig()
	const vary = [
		options.query?.length ? `query=${options.query.join('|')}` : null,
		draftCookie ? `cookie=${draftCookie}` : null,
	].filter(Boolean)

	if (vary.length) setResponseHeader(event, 'Netlify-Vary', vary.join(','))
}

/** Nothing about this response may be stored anywhere. */
export const setNoStore = (event: H3Event) => {
	setResponseHeader(event, 'Cache-Control', 'no-store')
	setResponseHeader(event, 'Netlify-CDN-Cache-Control', 'no-store')
}

/**
 * Drops every cached response carrying one of these tags.
 *
 * Missing credentials are logged rather than thrown: a local `nuxt dev` has no
 * site id and no token, and a webhook that 500s there would retry forever
 * against a machine that can never satisfy it.
 */
export const purgeCacheTags = async (tags: string[]) => {
	if (!tags.length) return { purged: 0, skipped: 'no tags' as const }

	const { netlifySiteId, netlifyToken } = useRuntimeConfig()

	if (!netlifySiteId || !netlifyToken) {
		console.warn('[kit] purge skipped — set NUXT_NETLIFY_SITE_ID and NUXT_NETLIFY_TOKEN')
		return { purged: 0, skipped: 'no credentials' as const }
	}

	await $fetch('https://api.netlify.com/api/v1/purge', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${netlifyToken}`,
			'Content-Type': 'application/json',
		},
		body: { site_id: netlifySiteId, cache_tags: tags },
	})

	return { purged: tags.length }
}
