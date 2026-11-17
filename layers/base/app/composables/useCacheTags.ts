import type { H3Event } from 'h3'
import { CACHE_TAG_HEADER, mergeCacheTags } from '../utils/cache-tags'

/**
 * Tags this page's HTML with what it was rendered from, so the CMS webhook can
 * purge exactly the pages an edit touched instead of the whole site.
 *
 *   useCacheTags(() => [page.value?._id, 'type:page'])
 *
 * The Dato layer calls this for you: every useContent() on the server adds the
 * cache tags DatoCMS returned for its query. On Sanity a page names its
 * documents itself — the `_id` rather than the slug (a slug can change, and
 * the edit that changes it is exactly the one that must purge the old page),
 * plus a `type:` tag so a NEW document, whose id nothing has been rendered
 * from yet, still purges the listings that have to grow a row for it.
 *
 * Server-only by construction: headers are set before any HTML is sent, and a
 * client navigation has no response to tag. The header goes through the raw
 * response rather than h3's setResponseHeader, which is a Nitro auto-import
 * and does not exist in the app bundle.
 */
export const tagResponse = (event: H3Event | undefined, tags: (string | undefined | null)[]) => {
	const response = event?.node?.res
	if (!response || response.headersSent) return

	const value = mergeCacheTags(response.getHeader(CACHE_TAG_HEADER), tags)
	if (!value) return

	response.setHeader(CACHE_TAG_HEADER, value)
}

export const useCacheTags = (tags: MaybeRefOrGetter<(string | undefined | null)[]>) => {
	tagResponse(useRequestEvent(), toValue(tags))
}
