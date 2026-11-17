/**
 * The seam between the base layer and a CMS.
 *
 * Everything on the server that is the same whatever the CMS — the sitemap,
 * llms.txt, the markdown renditions, the redirects, the form handler — asks
 * for content through ONE object, `cms`, which the CMS layer defines in its
 * own server/utils:
 *
 *   export const cms = defineCmsAdapter({ routable, document, settings, redirects })
 *
 * A third CMS is a third implementation of this, and nothing in the base
 * layer changes.
 *
 * Every read here is PUBLISHED content, always: a sitemap, an llms.txt or a
 * rendition that leaks a draft has published it to a crawler.
 */

/** One routable document, enough to place it and describe it. */
export type CmsRoutable = {
	id: string
	/** The key into kit.routes — Sanity's _type, Dato's model api_key. */
	type: string
	slug: string | null
	title?: string | null
	description?: string | null
	updatedAt?: string | null
	/**
	 * What to tag a cached response built from this with, so the CMS webhook
	 * purges it. Dato hands out opaque cache tags per query; Sanity's layer
	 * names the document id and its type. Omitted: `[id, 'type:<type>']`.
	 */
	cacheTags?: string[]
}

/** One document, wide enough to serialise to markdown without a per-type query. */
export type CmsDocument = CmsRoutable & {
	noIndex?: boolean | null
	/** The page-builder stack, if the type has one. */
	blocks?: unknown[] | null
	/** A long-form body (Portable Text, Structured Text), if it has one. */
	body?: unknown
}

export type CmsSettings = {
	title?: string | null
	description?: string | null
	/** Where form submissions are emailed. */
	formRecipients?: string[] | null
	cacheTags?: string[]
}

export type Redirect = { from: string; to: string; permanent?: boolean | null }

export type FormSubmission = {
	form: string
	fields: { label: string; value: string }[]
	spam: boolean
	source?: string
	submittedAt: string
}

export type CmsAdapter = {
	/**
	 * Is this request in the CMS's draft/preview mode? Verified, not merely
	 * present — it decides whether a response may be cached and whether the
	 * staging password is waived, so a hand-made cookie must answer false.
	 */
	isDraft(event: import('h3').H3Event): boolean
	/** Every published document of these types that has a route. */
	routable(types: string[]): Promise<CmsRoutable[]>
	/** One published document by type and slug (null slug: a singleton). */
	document(type: string, slug: string | null): Promise<CmsDocument | null>
	settings(): Promise<CmsSettings | null>
	redirects(): Promise<Redirect[]>
	/** Optional. Without it a submission is emailed (if mail is set up) and not stored. */
	storeSubmission?(submission: FormSubmission): Promise<void>
}

export const defineCmsAdapter = (adapter: CmsAdapter) => adapter
