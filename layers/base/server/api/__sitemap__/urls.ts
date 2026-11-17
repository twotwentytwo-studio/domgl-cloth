/**
 * The CMS half of the sitemap. Static routes are found by @nuxtjs/sitemap on
 * its own; everything under a `[slug]` has to be listed, and only the CMS
 * knows what those are.
 *
 * Every indexed type is walked, from kit.routes — so a project that adds
 * `journal: '/journal/:slug'` gets its posts in the sitemap without touching
 * this file. Published content only: a draft in a sitemap is a draft
 * submitted to Google.
 */
export default defineSitemapEventHandler(async () => {
	const { indexed } = kitConfig()
	if (!indexed.length) return []

	const docs = await cms.routable(indexed)

	return docs.flatMap((doc) => {
		const loc = serverDocumentPath(doc)
		if (!loc) return []

		return [{ loc, lastmod: doc.updatedAt ?? undefined }]
	})
})
