/*
 * The default page transition: none. Both hooks hand straight back.
 *
 * It is here as the SHAPE a project's transition takes, and so the seam in
 * plugins/transition already exists the day the first real one is written —
 * a cover, a wipe, a flip — as another module like this one:
 *
 *   export default (ctx) => ({
 *     css: false,
 *     mode: 'out-in',
 *     onLeave(el, done) { gsap.to(cover, { autoAlpha: 1, ...MOTION.fade, onComplete: done }) },
 *     onEnter(el, done) { done(); gsap.to(cover, { autoAlpha: 0, ...MOTION.fade }) },
 *   })
 *
 * A transition that can be interrupted parks the leaving done() and exports a
 * flush() the plugin calls on every navigation, or a killed tween strands the
 * old page mounted under the new one. Transitions that keep both pages on
 * screen at once: see the jl-lenis-transition-pin skill.
 *
 * Scroll is not a transition's job here: Nuxt's own scroll behaviour waits for
 * the leave to finish, then goes to the top — or to the saved position on
 * back/forward, or to a #hash — so under a cover it happens unseen.
 */
export default () => ({
	css: false,
	mode: 'out-in' as const,

	onLeave(_el: Element, done: () => void) {
		done()
	},

	onEnter(_el: Element, done: () => void) {
		done()
	},
})
