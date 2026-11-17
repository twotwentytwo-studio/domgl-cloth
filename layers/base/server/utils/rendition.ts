import type { H3Event } from 'h3'

/**
 * The markdown rendition of one path, and the rule for who gets it.
 *
 * Two ways in, deliberately:
 *
 *   /work/staris.md        an explicit URL. Always markdown, cacheable, and the
 *                          one llms.txt and the <link rel=alternate> advertise.
 *   Accept: text/markdown  content negotiation on the page URL itself.
 *
 * User-agent sniffing is a third way and it is a switch (`kit.agents`),
 * because it is the one with a cost: two bodies at one URL keyed by UA means
 * `Vary: User-Agent`, and a CDN that keys its cache on the UA string caches
 * almost nothing. The explicit `.md` URL has none of that problem, which is
 * why it is what gets advertised.
 */

const AGENT_PATTERN =
	/(GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-Web|Claude-User|anthropic-ai|PerplexityBot|Perplexity-User|Google-Extended|Applebot-Extended|CCBot|Bytespider|Amazonbot|Meta-ExternalAgent|cohere-ai|Diffbot|YouBot)/i

export const wantsMarkdown = (event: H3Event) => {
	const accept = getRequestHeader(event, 'accept') ?? ''
	if (accept.includes('text/markdown')) return { by: 'accept' as const }

	if (!kitConfig().agents) return null

	const ua = getRequestHeader(event, 'user-agent') ?? ''
	return AGENT_PATTERN.test(ua) ? { by: 'user-agent' as const } : null
}

/**
 * Renders `path` as markdown, or null when nothing on the site answers to it
 * in a way markdown can express — which the caller treats as "carry on and
 * render HTML", never as a 404. A path the route map does not own is very
 * often a real page anyway (a listing, a hand-built route), and turning those
 * into 404s for agents only would be a hard bug to ever see.
 */
export const renditionFor = async (path: string) => {
	const match = matchRoute(path)
	if (!match) return null

	const doc = await cms.document(match.type, match.slug)
	if (!doc || doc.noIndex) return null

	const siteUrl = useRuntimeConfig().public.siteUrl as string

	return {
		document: doc,
		markdown: pageToMarkdown({
			title: doc.title,
			description: doc.description,
			url: siteUrl ? new URL(path, siteUrl).href : path,
			updatedAt: doc.updatedAt,
			blocks: doc.blocks,
			body: doc.body,
		}),
	}
}
