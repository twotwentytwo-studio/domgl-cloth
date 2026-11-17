/**
 * /llms.txt — the site as an index an agent can read in one request.
 *
 * An H1 with the site name, a blockquote summarising it, and link lists
 * grouped by type. Each link points at the `.md` rendition rather than the
 * page, so following one costs an agent a page of prose instead of an
 * application shell.
 *
 * Grouped under the type's own route, the only grouping the kit can know. A
 * project that wants "Case studies" rather than "/work" overrides this route
 * with its own server/routes/llms.txt.get.ts — the project's file wins.
 */
export default defineEventHandler(async (event) => {
	const { indexed, routes, cacheMaxAge } = kitConfig()
	const siteUrl = (useRuntimeConfig().public.siteUrl as string) || ''

	const [settings, docs] = await Promise.all([
		cms.settings(),
		indexed.length ? cms.routable(indexed) : Promise.resolve([]),
	])

	const absolute = (path: string) => (siteUrl ? new URL(path, siteUrl).href : path)

	const lines: string[] = [`# ${settings?.title || 'Site'}`]

	if (settings?.description) lines.push('', `> ${settings.description}`)

	/* in the order the route map declares them — an author's ordering beats an
	   alphabetical one, and the map is where that ordering already lives */
	for (const type of indexed) {
		const group = docs.filter((doc) => doc.type === type)
		if (!group.length) continue

		const pattern = routes[type] ?? type
		lines.push('', `## ${pattern.replace('/:slug', '') || '/'}`, '')

		for (const doc of group) {
			const path = serverDocumentPath(doc)
			if (!path) continue

			const md = path === '/' ? '/index.md' : `${path}.md`
			const summary = doc.description ? `: ${doc.description}` : ''
			lines.push(`- [${doc.title || path}](${absolute(md)})${summary}`)
		}
	}

	setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
	setPageCacheControl(event, cacheMaxAge)
	addCacheTags(event, [
		'site',
		...indexed.map((type) => `type:${type}`),
		...(settings?.cacheTags ?? []),
		...docs.flatMap((doc) => doc.cacheTags ?? []),
	])

	return `${lines.join('\n')}\n`
})
