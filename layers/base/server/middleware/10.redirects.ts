/**
 * CMS-authored redirects, applied at runtime.
 *
 * A launch always turns up a list of old URLs somebody has to keep alive, and
 * every one arriving as a code change is a deploy an editor cannot make. These
 * are CMS entries; adding one is an edit.
 *
 * Only page requests are considered. An asset path that collides with a
 * redirect is a redirect somebody authored wrong, and 301ing a JS chunk breaks
 * the page rather than fixing it.
 */

const SKIP = ['/api/', '/_nuxt/', '/_ipx/', '/preview/']

export default defineEventHandler(async (event) => {
	const path = event.path || '/'

	if (SKIP.some((prefix) => path.startsWith(prefix))) return
	/* anything with an extension is a file, not a page */
	if (/\.[a-z0-9]+$/i.test(path.split('?')[0] ?? '')) return

	const redirects = await fetchRedirects()
	if (!redirects.length) return

	const from = normalizePath(path)
	const match = redirects.find((redirect) => normalizePath(redirect.from) === from)

	if (!match) return

	/* the query string rides along — a redirect must not eat the utm tags the
	   campaign that sent the visitor is measured by */
	const query = path.includes('?') ? path.slice(path.indexOf('?')) : ''
	const target = match.to.startsWith('/') ? `${match.to}${query}` : match.to

	await sendRedirect(event, target, match.permanent === false ? 302 : 301)
})
