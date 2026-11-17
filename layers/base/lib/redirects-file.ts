import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/**
 * Appends CMS redirects to Netlify's `_redirects` in the build output.
 *
 * Deliberately outside modules/, which Nuxt scans in every layer and would
 * try to load as a module. Each CMS layer's modules/redirects.ts fetches its
 * list at build time and hands it here, so the file format lives in one place.
 *
 * The runtime middleware already answers these, so this is about WHERE the
 * answer comes from: a rule in `_redirects` is served by the CDN in
 * milliseconds without waking a function. Together they cover everything —
 * this file what existed at deploy time, the middleware what was added since.
 */
export const appendRedirects = async (
	publicDir: string,
	redirects: { from: string; to: string; permanent?: boolean | null }[],
) => {
	if (!redirects.length) return 0

	/* 301! and 302! — the bang forces the rule even where a real file or
	   function route exists at that path. Without it a redirect authored for a
	   page that still exists silently does nothing, which is the one case
	   somebody authors a redirect for. */
	const body = redirects
		.filter(({ from, to }) => from && to)
		.map(({ from, to, permanent }) => `${from}  ${to}  ${permanent === false ? '302' : '301'}!`)
		.join('\n')

	const target = join(publicDir, '_redirects')

	await mkdir(dirname(target), { recursive: true })

	/* appended, not written: @nuxtjs/sitemap and Nuxt's own Netlify preset
	   both put rules in this file, and clobbering it breaks them in a way
	   nothing reports */
	const existing = await readFile(target, 'utf8').catch(() => '')

	await writeFile(target, `${existing ? `${existing.trimEnd()}\n` : ''}${body}\n`, 'utf8')

	return redirects.length
}
