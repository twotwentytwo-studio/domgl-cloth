/**
 * The server's half of the route map. Same data as documentPath() in the app,
 * same kit.routes — this exists only because a Nitro handler cannot call into
 * the app bundle.
 */
export const serverDocumentPath = (doc: { type?: string | null; slug?: string | null }) => {
	const { routes } = kitConfig()
	const pattern = doc.type ? routes[doc.type] : undefined

	if (!pattern) return null
	if (!pattern.includes(':slug')) return pattern
	if (!doc.slug) return pattern.replace(/\/:slug.*$/, '') || '/'

	return pattern.replace(':slug', doc.slug)
}

/**
 * Which type — if any — owns a given path: `/work/staris` back into
 * `{ type: 'work', slug: 'staris' }`. Longest pattern first, so /work/:slug
 * wins over a catch-all /:slug whatever order the map is written in.
 */
export const matchRoute = (path: string) => {
	const { routes } = kitConfig()
	const clean = path.replace(/\/+$/, '') || '/'

	const patterns = Object.entries(routes).sort(
		([, a], [, b]) => b.split('/').length - a.split('/').length,
	)

	for (const [type, pattern] of patterns) {
		if (!pattern.includes(':slug')) {
			if ((pattern.replace(/\/+$/, '') || '/') === clean) return { type, slug: null }
			continue
		}

		const prefix = pattern.slice(0, pattern.indexOf(':slug'))
		if (!clean.startsWith(prefix)) continue

		const slug = clean.slice(prefix.length)
		/* one segment only — /work/staris matches, /work/staris/gallery does not */
		if (!slug || slug.includes('/')) continue

		return { type, slug }
	}

	return null
}
