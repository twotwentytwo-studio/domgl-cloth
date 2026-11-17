/**
 * Analytics, if any, and only where it belongs.
 *
 * Four providers behind one config key, because which one a client insists on
 * is a decision made after the site is built and should not be a code change:
 *
 *   NUXT_PUBLIC_ANALYTICS_PROVIDER=plausible
 *   NUXT_PUBLIC_ANALYTICS_SITE_ID=example.com
 *
 * Nothing loads in dev, nothing loads on a preview deploy, nothing loads with
 * no provider set. Dev pageviews in a client's dashboard are noise nobody can
 * clean out afterwards, and a staging deploy sharing production's site id is
 * how a launch week's numbers get quietly wrong.
 *
 * The scripts are all cookieless and none of them needs a consent banner —
 * which is the reason the list is these four. A provider that does need one
 * needs the banner to gate it, not this plugin.
 */

type Provider = 'plausible' | 'fathom' | 'umami' | 'ga' | ''

export default defineNuxtPlugin({
	name: 'kit-analytics',
	parallel: true,

	setup() {
		if (import.meta.dev) return

		const { provider, siteId, host } = useRuntimeConfig().public.analytics as {
			provider: Provider
			siteId: string
			host: string
		}

		if (!provider || !siteId) return

		/* Do Not Track is a request, and honouring it costs one page view. */
		if (navigator.doNotTrack === '1') return

		const scripts: Record<Exclude<Provider, ''>, { src: string; attrs?: Record<string, string> }> = {
			plausible: {
				src: `${host || 'https://plausible.io'}/js/script.js`,
				attrs: { 'data-domain': siteId },
			},
			fathom: {
				src: `${host || 'https://cdn.usefathom.com'}/script.js`,
				attrs: { 'data-site': siteId },
			},
			umami: {
				src: `${host || 'https://cloud.umami.is'}/script.js`,
				attrs: { 'data-website-id': siteId },
			},
			ga: {
				src: `https://www.googletagmanager.com/gtag/js?id=${siteId}`,
			},
		}

		const script = scripts[provider]
		if (!script) return

		useHead({
			script: [
				{ src: script.src, defer: true, ...(script.attrs ?? {}) },
				...(provider === 'ga'
					? [
							{
								innerHTML: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${siteId}',{anonymize_ip:true})`,
							},
						]
					: []),
			],
		})
	},
})
