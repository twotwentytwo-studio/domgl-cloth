/*
 * Every load of the site starts at the top. The browser's own restore lands
 * before Lenis mounts, so a restored offset shows as a jump — and the site's
 * entry is an intro that assumes the top of the page.
 *
 * `manual` is set and never handed back: a `beforeunload` handoff to 'auto'
 * is what lets a reload restore, which is exactly what this prevents. The
 * explicit scroll is the belt to that braces — Firefox restores on its own
 * clock, after this plugin has already run.
 */
export default defineNuxtPlugin({
	name: 'scroll-behaviour',
	setup() {
		if ('scrollRestoration' in history) {
			history.scrollRestoration = 'manual'
		}

		const top = () => window.scrollTo(0, 0)

		top()
		window.addEventListener('load', top)

		if (import.meta.hot) {
			import.meta.hot.dispose(() => window.removeEventListener('load', top))
		}
	},
})
