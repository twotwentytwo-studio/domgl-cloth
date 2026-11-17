/**
 * HTTP basic auth, for staging.
 *
 * Set `NUXT_BASIC_AUTH=user:pass` on the branch deploys and leave it unset on
 * production. Unset means off — the check costs nothing and the site is
 * public, which is the correct default for the deploy that matters.
 *
 * This runs before everything else (the `00.` prefix orders Nitro middleware
 * lexically) so nothing downstream can answer first. It is not a substitute
 * for `site.indexable = false`: a crawler that never reaches the page cannot
 * index it, but a link shared out of the 401 still leaks the URL.
 *
 * Compared in constant time. A basic-auth password is low-value, and the
 * timing side channel on a string compare is a long way from practical over
 * the internet — but the constant-time compare is three lines and removes the
 * question entirely.
 */

const EXEMPT = [
	/* the CMS webhook cannot send an Authorization header; it authenticates
	   itself with a signature or a bearer secret instead */
	'/api/revalidate',
	/* the CMS's preview plumbing — each endpoint checks its own secret, and
	   they are called from inside the CMS, which has no staging password */
	'/api/draft/',
	'/preview/',
	/* built assets */
	'/_nuxt/',
]

const constantTimeEqual = (a: string, b: string) => {
	if (a.length !== b.length) return false

	let diff = 0
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)

	return diff === 0
}

export default defineEventHandler((event) => {
	const expected = useRuntimeConfig().basicAuth as string
	if (!expected) return

	const path = event.path || ''
	if (EXEMPT.some((prefix) => path.startsWith(prefix))) return

	/* An editor previewing from inside the CMS. The draft session could only
	   be had through the preview secret, so it is already authenticated — and
	   the CMS's iframe has no way to answer a basic-auth prompt. */
	if (cms.isDraft(event)) return

	const header = getRequestHeader(event, 'authorization') ?? ''

	if (header.startsWith('Basic ')) {
		const supplied = Buffer.from(header.slice(6), 'base64').toString('utf8')
		if (constantTimeEqual(supplied, expected)) return
	}

	setResponseHeader(event, 'WWW-Authenticate', 'Basic realm="Staging", charset="UTF-8"')
	/* never let a 401 be cached — the CDN would then serve it to somebody who
	   has already authenticated */
	setResponseHeader(event, 'Cache-Control', 'no-store')

	throw createError({ statusCode: 401, message: 'Authentication required' })
})
