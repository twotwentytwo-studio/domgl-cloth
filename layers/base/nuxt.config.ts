import tailwindcss from '@tailwindcss/vite'

/**
 * The base layer: what is true of every site, whatever the CMS behind it.
 *
 * The motion base (one rAF, Lenis, gsap, the page transition), the Tailwind
 * scale and grid, the server machinery (cache tags, staging auth, redirects,
 * sitemap, agent renditions, forms) and the seams a CMS layer plugs into.
 *
 * A project never edits this folder for a site-specific reason. It lives in
 * alpacka-kit/base and is copied into every starter as layers/base; a change
 * that is true of every project is made in the kit and synced out.
 *
 * Two rules hold inside any layer and nowhere else:
 *
 * 1. No `~/` or `@/` imports. Those aliases resolve to the CONSUMING app's
 *    srcDir, not to the layer's, so `~/utils/x` in a layer file reads the
 *    project's file if one exists and fails the build if not. Everything
 *    internal is imported relatively.
 *
 * 2. Nothing here may be required to be overridden. A project that sets only
 *    its CMS credentials must boot and be correct; every knob has a default
 *    that is safe rather than clever.
 *
 * The CMS layer (layers/dato or layers/sanity) supplies the `cms` adapter the
 * server side reads through — see server/utils/cms.ts for the contract.
 */
export default defineNuxtConfig({
	compatibilityDate: '2026-08-07',

	devtools: { enabled: false },

	/* The router, whether or not the site has written a page yet — the
	   transition plugin and every useRoute() in the layers need it. */
	pages: true,

	modules: ['@nuxtjs/sitemap', '@nuxtjs/robots'],

	site: {
		url: process.env.NUXT_PUBLIC_SITE_URL || process.env.URL || '',
		/* Off until the real domain goes live. A staging deploy that gets
		   indexed outranks the site it was staging for. */
		indexable: process.env.NUXT_PUBLIC_INDEXABLE === 'true',
	},

	/* Static routes are found by the module on its own; everything under a
	   [slug] only the CMS knows — see server/api/__sitemap__/urls. */
	sitemap: { sources: ['/api/__sitemap__/urls'] },

	/* Not /api/ as a whole: a crawler that renders the page fetches the same
	   payloads a visitor's navigation does. The preview plumbing is secret-
	   guarded anyway; this only keeps it out of crawl logs. */
	robots: { disallow: ['/api/draft/', '/preview/'] },

	runtimeConfig: {
		/* "user:pass". Set it on staging, leave it empty on production. */
		basicAuth: '',

		/* Shared with the CMS webhook. The revalidate endpoint refuses every
		   request while this is empty, rather than accepting all of them. */
		revalidateSecret: '',

		/* Netlify's purge API. Both are needed to invalidate by cache tag;
		   with neither, the webhook still answers and logs that it could not
		   purge, so a local run is not an error. */
		netlifySiteId: '',
		netlifyToken: '',

		/* Optional. With no key, form submissions are stored (where the CMS
		   layer stores them) and not emailed. */
		resendApiKey: '',
		mailFrom: '',

		/* Optional. With no secret the captcha is skipped; the honeypot and
		   the timing trap still run. */
		turnstileSecret: '',

		public: {
			siteUrl: process.env.NUXT_PUBLIC_SITE_URL || process.env.URL || '',
			turnstileSiteKey: '',
			/* provider: 'plausible' | 'fathom' | 'umami' | 'ga' | '' */
			analytics: { provider: '', siteId: '', host: '' },

			kit: {
				/**
				 * The single map from a CMS type to where it lives on the site.
				 * Links, the sitemap, the markdown renditions, llms.txt and the
				 * CMS preview links all read it, so a new routable type is one
				 * line here rather than five edits.
				 *
				 * `:slug` is the only token. A singleton's path is written out
				 * whole ('/', '/about').
				 *
				 * Runtime config rather than app config because Nitro needs it
				 * too, and two copies of a route map is how the sitemap starts
				 * disagreeing with the links.
				 */
				routes: {} as Record<string, string>,

				/* Which types the sitemap, llms.txt and the agent renditions
				   walk. Empty falls back to every :slug route above. */
				indexed: [] as string[],

				/* Seconds the CDN may hold a page before revalidating. The
				   webhook purge is what keeps pages fresh, so this is the
				   ceiling for a purge that got lost, not the freshness budget. */
				cacheMaxAge: 3600,

				/* Also serve markdown to known agents at the page URL itself.
				   Off by default: it means `Vary: User-Agent` on every page, and
				   the CDN keys its cache on the UA string, which caches almost
				   nothing. The `.md` URLs and `Accept: text/markdown` work
				   either way — see server/utils/rendition. */
				agents: false,

				/* The cookie that puts a visitor in the CMS's draft/preview
				   mode. Set by the CMS layer. Cached responses vary on it, so
				   an editor never gets the published page out of the CDN. */
				draftCookie: '',
			},
		},
	},

	vue: {
		/* Template comments compiled out in dev too, as a build already does.
		   With them kept, a comment between a root v-if and its v-else is
		   moved INTO the else branch, and the SSR compiler hands that branch's
		   fallthrough attrs to its first child — the comment. The server then
		   renders the element without the class a parent passed, the client
		   with it: a hydration class mismatch in dev on every such component,
		   and a commented template is the house style. */
		compilerOptions: { comments: false },
	},

	nitro: {
		/* Netlify's CDN compresses what it serves, so this changes nothing
		   there — it is for `nuxt preview` and every other way the build gets
		   run, which otherwise ship the bundle raw. */
		compressPublicAssets: { gzip: true, brotli: true },
	},

	vite: {
		/* Tailwind 4 is a Vite plugin. @nuxtjs/tailwindcss is v3-only and is
		   deliberately absent — there is no tailwind.config.js; the theme is
		   CSS, in this layer's app/assets/css and the site's globals.css. */
		plugins: [tailwindcss()],
	},
})
