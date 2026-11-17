/**
 * Turns a CMS page into markdown, for agents that would rather read prose than
 * parse a page built for eyes.
 *
 * Two paths, and the generic one is the important one. A project registers a
 * serializer per block type for the two or three sections whose meaning is
 * structural. Everything else falls through to a walker that pulls the
 * text-bearing fields out of whatever shape the block happens to be — so a
 * new block is readable by agents the moment it exists, without anyone
 * remembering to teach this file about it.
 *
 * Rich text arrives in two dialects and both are understood: Sanity's Portable
 * Text (an array of `_type: 'block'`) and Dato's Structured Text (a `dast`
 * document under `value`).
 */

type Block = Record<string, unknown>

const serializers = new Map<string, (block: Block) => string>()

/**
 * Register serializers from a Nitro plugin, keyed by block type — Sanity's
 * `_type`, Dato's `__typename`:
 *
 *   export default defineNitroPlugin(() => {
 *     defineBlockMarkdown({
 *       stats: (b) => b.items.map((i) => `- **${i.value}** ${i.label}`).join('\n'),
 *     })
 *   })
 */
export const defineBlockMarkdown = (map: Record<string, (block: Block) => string>) => {
	for (const [type, fn] of Object.entries(map)) serializers.set(type, fn)
}

const blockType = (block: Block) =>
	[block._type, block.__typename, block._modelApiKey].find((v): v is string => typeof v === 'string')

/* Fields that hold prose, in the order a section usually reads. Anything not
   listed is skipped rather than guessed at — an id, a ratio or a hex colour
   rendered as a paragraph is worse than a gap. */
const HEADINGS = ['heading', 'title', 'name', 'question']
const BODIES = ['body', 'text', 'description', 'caption', 'quote', 'answer', 'content']
const LABELS = ['label', 'eyebrow', 'tag', 'role', 'subtitle']

const isObject = (value: unknown): value is Block =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

/* ── Portable Text ───────────────────────────────────────────────────── */

const looksLikePortableText = (value: unknown): value is unknown[] =>
	Array.isArray(value) && value.some((entry) => isObject(entry) && entry._type === 'block')

const portableText = (blocks: unknown[]): string =>
	blocks
		.filter(isObject)
		.map((block) => {
			const children = Array.isArray(block.children) ? block.children : []
			const text = children.filter(isObject).map((child) => String(child.text ?? '')).join('')

			if (!text.trim()) return ''

			const style = String(block.style ?? 'normal')
			if (/^h[1-6]$/.test(style)) return `${'#'.repeat(Math.min(Number(style[1]) + 1, 6))} ${text}`
			if (block.listItem) return `- ${text}`
			if (style === 'blockquote') return `> ${text}`

			return text
		})
		.filter(Boolean)
		.join('\n\n')

/* ── Structured Text (DAST) ──────────────────────────────────────────── */

const looksLikeStructuredText = (value: unknown): value is { value: { document: Block } } =>
	isObject(value) && isObject(value.value) && value.value.schema === 'dast' && isObject(value.value.document)

const dastInline = (node: Block): string => {
	if (node.type === 'span') return String(node.value ?? '')
	const children = Array.isArray(node.children) ? node.children.filter(isObject) : []
	return children.map(dastInline).join('')
}

const dastBlock = (node: Block, depth = 0): string => {
	const children = Array.isArray(node.children) ? node.children.filter(isObject) : []

	switch (node.type) {
		case 'root':
			return children.map((child) => dastBlock(child, depth)).filter(Boolean).join('\n\n')
		case 'heading':
			return `${'#'.repeat(Math.min(Number(node.level ?? 2) + 1, 6))} ${dastInline(node)}`
		case 'paragraph':
			return dastInline(node)
		case 'blockquote':
			return children.map((child) => `> ${dastBlock(child, depth)}`).join('\n')
		case 'list':
			return children
				.map((item, i) => `${'  '.repeat(depth)}${node.style === 'numbered' ? `${i + 1}.` : '-'} ${dastBlock(item, depth + 1).trim()}`)
				.join('\n')
		case 'listItem':
			return children.map((child) => dastBlock(child, depth)).join('\n')
		case 'code':
			return `\`\`\`\n${String(node.code ?? '')}\n\`\`\``
		default:
			return ''
	}
}

const structuredText = (value: { value: { document: Block } }) => dastBlock(value.value.document).trim()

/* ── Blocks ──────────────────────────────────────────────────────────── */

const richText = (value: unknown) => {
	if (looksLikePortableText(value)) return portableText(value)
	if (looksLikeStructuredText(value)) return structuredText(value)
	return ''
}

/** One block, without a registered serializer. */
const genericBlock = (block: Block, depth = 3): string => {
	const out: string[] = []

	for (const key of LABELS) {
		const value = block[key]
		if (typeof value === 'string' && value.trim()) out.push(`*${value.trim()}*`)
	}

	for (const key of HEADINGS) {
		const value = block[key]
		if (typeof value === 'string' && value.trim()) out.push(`${'#'.repeat(depth)} ${value.trim()}`)
	}

	for (const key of BODIES) {
		const value = block[key]
		if (typeof value === 'string' && value.trim()) out.push(value.trim())
		else {
			const text = richText(value)
			if (text) out.push(text)
		}
	}

	/* alt text is the only thing a picture can say in markdown, and an
	   unwritten alt says nothing — which is its own signal. Sanity nests the
	   image inside the media object; Dato's asset carries alt itself. */
	const asset = [block.image, block.media, isObject(block.media) ? block.media.image : null]
		.find((candidate) => isObject(candidate) && typeof candidate.alt === 'string' && candidate.alt.trim()) as Block | undefined

	if (asset) out.push(`![${String(asset.alt).trim()}]()`)

	/* nested repeaters — items, members, details. One level of recursion per
	   level of nesting; past depth 6 a block is describing a widget, not prose. */
	for (const value of Object.values(block)) {
		if (!Array.isArray(value) || !value.length || looksLikePortableText(value)) continue

		const rows = value
			.filter(isObject)
			.map((entry) => genericBlock(entry, Math.min(depth + 1, 6)))
			.filter(Boolean)

		if (rows.length) out.push(rows.join('\n\n'))
	}

	return out.filter(Boolean).join('\n\n')
}

export const blockToMarkdown = (block: Block) => {
	const type = blockType(block)
	const custom = type ? serializers.get(type) : undefined

	return (custom ? custom(block) : genericBlock(block)).trim()
}

/**
 * The whole page: front matter, an H1, the description a crawler would have
 * read from the meta tag, then the sections in order. The canonical URL is in
 * the front matter so an agent quoting this can cite the page a person would
 * open.
 */
export const pageToMarkdown = (options: {
	title?: string | null
	description?: string | null
	url?: string
	updatedAt?: string | null
	blocks?: unknown[] | null
	body?: unknown
}) => {
	const frontMatter = [
		'---',
		`title: ${JSON.stringify(options.title ?? '')}`,
		options.description ? `description: ${JSON.stringify(options.description)}` : null,
		options.url ? `url: ${options.url}` : null,
		options.updatedAt ? `updated: ${options.updatedAt}` : null,
		'---',
	].filter(Boolean)

	const body: string[] = []

	if (options.title) body.push(`# ${options.title}`)
	if (options.description) body.push(options.description)

	const text = richText(options.body)
	if (text) body.push(text)

	for (const block of options.blocks ?? []) {
		if (!isObject(block)) continue
		const md = blockToMarkdown(block)
		if (md) body.push(md)
	}

	return `${frontMatter.join('\n')}\n\n${body.join('\n\n')}\n`
}
