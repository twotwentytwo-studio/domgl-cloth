/**
 * The default caching posture for rendered HTML.
 *
 * Every page gets a long CDN lifetime and a `site` tag; pages add what they
 * were built from on top (useCacheTags, or automatically through the Dato
 * layer's useContent). The webhook is what keeps any of it fresh, so the
 * lifetime is a ceiling for a purge that got lost, not a freshness budget.
 *
 * Three things are never cached, and each has cost somebody a day:
 *
 * - a page rendered in draft mode, which contains drafts — the CMS layer's
 *   isDraft() decides, by verifying its cookie rather than noticing one
 * - a 401 from the staging basic auth, which would then be served to somebody
 *   who has already authenticated
 * - an error page, which would pin a transient CMS outage into the CDN for an
 *   hour after the CMS came back
 */
export default defineNitroPlugin((nitro) => {
	nitro.hooks.hook('render:response', (_response, { event }) => {
		const status = event.node.res.statusCode

		if (status >= 300 || cms.isDraft(event)) {
			setNoStore(event)
			return
		}

		setPageCacheControl(event, kitConfig().cacheMaxAge)
		addCacheTags(event, ['site'])
	})
})
