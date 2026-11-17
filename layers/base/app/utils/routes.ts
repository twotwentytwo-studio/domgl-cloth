/**
 * Where a CMS type lives on the site, from the `kit.routes` map in runtime
 * config — the one map links, the sitemap, the renditions, llms.txt and the
 * CMS preview links all read. Nitro has its own copy of these two functions
 * (server/utils/routes) because a handler cannot call into the app bundle;
 * both read the same config.
 */

/**
 * Fills a route pattern. `:slug` is the only token; a slugged pattern with no
 * slug to fill it is the listing above it — /work/:slug with nothing is /work,
 * never /work/undefined.
 */
export function fillRoute(pattern: string, slug?: string | null) {
	if (!pattern.includes(':slug')) return pattern
	if (!slug) return pattern.replace(/\/:slug.*$/, '') || '/'

	return pattern.replace(':slug', slug)
}

/**
 * The path of a document of `type` with `slug`.
 *
 * A type with no entry resolves to the homepage rather than to a dead link —
 * loud in dev, harmless in production. The warning is the real fix: it is how
 * you find out the CMS can link to something the site cannot route.
 */
export function documentPath(type?: string | null, slug?: string | null) {
	const routes = (useRuntimeConfig().public.kit?.routes ?? {}) as Record<string, string>
	const pattern = type ? routes[type] : undefined

	if (!pattern) {
		if (import.meta.dev && type) {
			console.warn(`[kit] no route for type "${type}" — add it to kit.routes in nuxt.config`)
		}
		return '/'
	}

	return fillRoute(pattern, slug)
}

/* What counts as leaving the site. `www.` is a URL somebody typed without its
   scheme; tel: and mailto: are external in every way that matters here. */
export const externalUrl = (url?: string | null): url is string =>
	typeof url === 'string'
	&& /^(https?:\/\/|www\.|tel:|mailto:)/.test(url)

export const normalizeUrl = (url: string) => (url.startsWith('www.') ? `https://${url}` : url)
