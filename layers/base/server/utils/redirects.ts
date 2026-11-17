/**
 * The redirect list, cached in the instance that fetched it.
 *
 * Serverless memory is per-instance, so this is a TTL cache and not an
 * invalidation cache: a webhook can only clear the one instance it happened to
 * wake, and the rest age out on their own. A minute is the compromise — short
 * enough that a redirect added during a launch is live before anyone asks
 * twice, long enough that a crawler walking a thousand dead URLs makes one
 * query rather than a thousand.
 *
 * The build-time `_redirects` file carries the real load: the CDN answers from
 * it without waking a function. This path exists for the redirect added AFTER
 * the deploy, which is most of them.
 */

const TTL = 60_000

let cache: { at: number; list: Redirect[] } | null = null
let inflight: Promise<Redirect[]> | null = null

export const fetchRedirects = async (): Promise<Redirect[]> => {
	if (cache && Date.now() - cache.at < TTL) return cache.list

	/* one query however many requests arrive during a cold fetch */
	if (inflight) return inflight

	inflight = cms
		.redirects()
		.then((list) => {
			cache = { at: Date.now(), list: list ?? [] }
			return cache.list
		})
		.catch((error) => {
			console.error('[kit] could not fetch redirects', error)
			/* serve the stale list rather than none: a CMS blip must not turn
			   every redirect on the site into a 404 */
			return cache?.list ?? []
		})
		.finally(() => {
			inflight = null
		})

	return inflight
}

export const invalidateRedirects = () => {
	cache = null
}

/** Normalised for comparison: no trailing slash, no query, lowercase. */
export const normalizePath = (path: string) => {
	const [bare] = path.split('?')
	const trimmed = (bare ?? '').replace(/\/+$/, '')
	return (trimmed || '/').toLowerCase()
}
