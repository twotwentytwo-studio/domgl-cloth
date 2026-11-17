/*
 * Shared IntersectionObserver visibility tracking.
 *
 * Reads are imperative (no state, no re-renders) — made for hot paths, so a
 * tick handler can bail cheaply while its section is scrolled off screen:
 *
 *   const { $inview } = useNuxtApp()
 *
 *   $inview.observe(el)                  // start tracking
 *   $inview.check(el)                    // boolean, false until the first IO callback
 *   $inview.observe(el, v => ...)        // or event-driven, for play/pause
 *   $inview.near(el, () => ...)          // one-shot, a viewport early — for downloads
 *   $inview.unobserve(el)
 */

export default defineNuxtPlugin({
	name: 'inview',
	setup() {
		const visible = new WeakMap<Element, boolean>()
		const callbacks = new WeakMap<Element, (visible: boolean) => void>()
		const nearCallbacks = new WeakMap<Element, () => void>()

		const io = new IntersectionObserver((entries) => {
			entries.forEach((e) => {
				visible.set(e.target, e.isIntersecting)
				callbacks.get(e.target)?.(e.isIntersecting)
			})
		})

		/* second observer with a viewport of lookahead in every direction —
		   fires one-shot callbacks for kicking off downloads before content
		   scrolls in */
		const nearIo = new IntersectionObserver(
			(entries) => {
				entries.forEach((e) => {
					if (!e.isIntersecting) return
					const cb = nearCallbacks.get(e.target)
					nearCallbacks.delete(e.target)
					nearIo.unobserve(e.target)
					cb?.()
				})
			},
			{ rootMargin: '100% 0px 100% 0px' },
		)

		return {
			provide: {
				inview: {
					observe(el: Element, onChange?: (visible: boolean) => void) {
						visible.set(el, false)
						if (onChange) callbacks.set(el, onChange)
						io.observe(el)
					},

					/* returns an unsubscribe — independent of observe/unobserve,
					   so tearing one down can't drop the other's tracking */
					near(el: Element, onNear: () => void) {
						nearCallbacks.set(el, onNear)
						nearIo.observe(el)
						return () => {
							nearCallbacks.delete(el)
							nearIo.unobserve(el)
						}
					},

					unobserve(el: Element) {
						visible.delete(el)
						callbacks.delete(el)
						io.unobserve(el)
					},

					check(el: Element) {
						return visible.get(el) ?? false
					},
				},
			},
		}
	},
})
