/**
 * Everything a page has to say about itself to a crawler, from one call.
 *
 * CMS-agnostic: the CMS layer's usePageSeo() maps its own document and
 * settings shapes into these two and calls this — so title rules, canonical
 * URLs and share tags are decided once, not per CMS.
 *
 * Each value falls back: the page's SEO field, then the page's own title,
 * then the site's defaults — so a document nobody opened the SEO tab on is
 * still correctly tagged. Strings arrive already cleaned of any visual-editing
 * metadata; the CMS layer strips it before calling.
 */

export type Seo = {
	/** The page's title, without the site name. */
	title?: string | null
	description?: string | null
	/** An ABSOLUTE url, ~1200×630. A relative og:image is ignored by every scraper that matters. */
	image?: string | null
	noIndex?: boolean | null
	/** The page's own JSON-LD as an editor pasted it, `<script>` tag or not. Printed beside the site's, never instead. */
	schema?: string | null
}

export type SiteSeo = {
	/** The site's name — the whole title on the homepage. */
	name?: string | null
	/** `%s` is the page title, e.g. `%s — Studio`. Defaults to `%s — {name}`. */
	titleTemplate?: string | null
	description?: string | null
	image?: string | null
}

export const useSeo = (
	page: MaybeRefOrGetter<Seo | null | undefined>,
	site: MaybeRefOrGetter<SiteSeo | null | undefined> = null,
) => {
	const route = useRoute()
	const siteUrl = useRuntimeConfig().public.siteUrl as string

	const seo = computed(() => toValue(page) ?? {})
	const defaults = computed(() => toValue(site) ?? {})

	const title = computed(() => seo.value.title || defaults.value.name || '')
	const description = computed(() => seo.value.description || defaults.value.description || '')
	const image = computed(() => seo.value.image || defaults.value.image || undefined)

	/**
	 * The template runs on every page BUT the one whose title already is the
	 * site name. "Studio — Studio" is the classic homepage bug, and it is what
	 * a naive `%s — Site` gives you.
	 *
	 * A plain function rather than a computed: unhead re-invokes it on every
	 * resolve, so it stays reactive without being a ref — and titleTemplate
	 * takes a function or a string, never a ref of either.
	 */
	const titleTemplate = (chunk?: string) => {
		const name = defaults.value.name
		if (!name) return chunk ?? ''
		if (!chunk || chunk === name) return name

		return (defaults.value.titleTemplate || `%s — ${name}`).replace('%s', chunk)
	}

	const canonical = computed(() => (siteUrl ? new URL(route.path, siteUrl).href : route.path))

	/* parsed and written back out rather than printed as pasted: the tag is
	   ours, so a pasted `<script>` wrapper is dropped, JSON that does not parse
	   prints nothing, and `<` is escaped so no string can close the tag early */
	const schema = computed(() => {
		const raw = seo.value.schema?.replace(/^\s*<script[^>]*>|<\/script>\s*$/gi, '').trim()
		if (!raw) return []
		try {
			const json = JSON.parse(raw)
			if (!json || typeof json !== 'object') return []
			return [{ key: 'schema-page', type: 'application/ld+json' as const, innerHTML: JSON.stringify(json).replace(/</g, '\\u003c') }]
		} catch {
			return []
		}
	})

	useHead({
		titleTemplate,
		link: [{ rel: 'canonical', href: () => canonical.value }],
		script: schema,
	})

	useSeoMeta({
		title: () => title.value,
		description: () => description.value,
		ogTitle: () => title.value,
		ogDescription: () => description.value,
		ogType: 'website',
		ogUrl: () => canonical.value,
		ogSiteName: () => defaults.value.name || undefined,
		ogImage: () => image.value,
		twitterCard: 'summary_large_image',
		twitterTitle: () => title.value,
		twitterDescription: () => description.value,
		twitterImage: () => image.value,
		robots: () => (seo.value.noIndex ? 'noindex, nofollow' : undefined),
	})

	return { title, description, canonical, image }
}
