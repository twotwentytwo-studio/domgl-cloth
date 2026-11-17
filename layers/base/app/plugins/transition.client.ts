import defaultTransition from '../transitions/default'

/**
 * Stamps the page transition on every navigation.
 *
 * A global route middleware rather than a `pageTransition` in nuxt.config,
 * because a real site's transition is chosen per navigation — a case study
 * arrives differently from a listing — and this is the seam that choice hangs
 * off:
 *
 *   const transition = to.meta.case ? caseTransition() : defaultTransition()
 *
 * Out of the box the transition is empty (transitions/default).
 *
 * `page:inserted` goes out once the leave is finished and the entering page is
 * in the document — Nuxt's `page:transition:finish` is exactly that moment,
 * whatever the transition does. awaitConnected() (composables/useConnected)
 * waits on it.
 */
export default defineNuxtPlugin({
	name: 'transition',
	dependsOn: ['events'],

	setup(nuxtApp) {
		addRouteMiddleware(
			'transition',
			(to, from) => {
				if (from.fullPath === to.fullPath) return

				const transition = defaultTransition()

				/* both routes, because Vue reads the LEAVING route's transition
				   for onLeave and the entering one's for onEnter */
				from.meta.pageTransition = transition
				to.meta.pageTransition = transition
			},
			{ global: true },
		)

		nuxtApp.hook('page:transition:finish', () => {
			nuxtApp.$event.emit('page:inserted')
		})
	},
})
