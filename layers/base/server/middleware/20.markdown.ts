/**
 * Markdown renditions, and the content negotiation in front of them — see
 * server/utils/rendition for who gets markdown and why.
 *
 * The `Vary` is not optional. Two bodies at one URL without it and the CDN
 * serves whichever it cached first to everybody — a browser gets raw
 * markdown, or an agent gets the application shell.
 *
 * One middleware rather than a middleware plus a route, because Nitro's file
 * routing cannot spell "any path, ending in .md".
 */

const SKIP = ['/api/', '/_nuxt/', '/_ipx/', '/preview/', '/llms.txt']

const send = async (event: import('h3').H3Event, path: string, vary: string) => {
	const rendition = await renditionFor(path)
	if (!rendition) return null

	setResponseHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
	setResponseHeader(event, 'Vary', vary)
	setPageCacheControl(event, kitConfig().cacheMaxAge)
	const doc = rendition.document
	addCacheTags(event, ['site', ...(doc.cacheTags ?? [doc.id, `type:${doc.type}`])])

	return rendition.markdown
}

export default defineEventHandler(async (event) => {
	const full = event.path || '/'
	const path = full.split('?')[0] ?? '/'

	if (SKIP.some((prefix) => full.startsWith(prefix))) return

	/* the explicit URL. A .md that maps to no page IS a 404 — somebody typed or
	   followed it deliberately, and falling through would render the app shell
	   under a markdown URL. */
	if (path.endsWith('.md')) {
		const stripped = path.slice(0, -3)
		/* the homepage has no path to hang `.md` off, so it is /index.md */
		const target = stripped === '/index' || stripped === '' ? '/' : stripped

		const body = await send(event, target, 'Accept')
		if (body !== null) return body

		throw createError({ statusCode: 404, message: 'No markdown rendition for this path' })
	}

	/* every other file extension is an asset */
	if (/\.[a-z0-9]+$/i.test(path)) return

	const wants = wantsMarkdown(event)
	const vary = kitConfig().agents ? 'Accept, User-Agent' : 'Accept'

	if (!wants) {
		/* tell every other client the rendition exists */
		setResponseHeader(
			event,
			'Link',
			`<${(path.replace(/\/+$/, '') || '/index')}.md>; rel="alternate"; type="text/markdown"`,
		)
		setResponseHeader(event, 'Vary', vary)
		return
	}

	return (await send(event, path, wants.by === 'accept' ? 'Accept' : vary)) ?? undefined
})
