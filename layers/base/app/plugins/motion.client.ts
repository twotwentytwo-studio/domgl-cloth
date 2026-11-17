import { Ticker } from '@lama/motion/core'

/*
 * @lama/motion's Ticker, on the page's clock.
 *
 *   const { $ticker } = useNuxtApp()
 *   const scale = new Spring(1, { response: 0.35, dampingRatio: 0.7 })
 *   const remove = $ticker.add(scale)                        // stepped every frame
 *   const unwrite = $ticker.onWrite(() => { el.style.scale = `${scale.value}` })
 *   onBeforeUnmount(() => { remove(); unwrite() })
 *
 * A Ticker can run its own requestAnimationFrame (`.start()`) — never here:
 * the scroll plugin owns the one rAF, and a second loop is two clocks that
 * drift. This one is stepped in the `pre-tick` phase, with the frame's length
 * in seconds, so springs move and their writes land before anything that
 * reads the page this frame (plugins/events).
 *
 * A lone spring can equally be stepped by hand from the same phase —
 * `$event.on('pre-tick', ({ ratio }) => spring.step(ratio / 60))` — the
 * Ticker is for the several-springs-and-a-write-phase case, and for the
 * DomAdapter and Flip (`new DomAdapter($ticker)`, `$ticker.add(flip)`).
 */

export default defineNuxtPlugin({
	name: 'motion',
	dependsOn: ['events'],
	setup(nuxtApp) {
		const { $event } = nuxtApp
		const ticker = new Ticker()

		/* ratio is the frame's length in 60fps frames; the Ticker clamps a
		   tab-switch-sized dt itself */
		const step = ({ ratio }: { ratio: number }) => ticker.tick(ratio / 60)

		$event.on('pre-tick', step)

		if (import.meta.hot) {
			import.meta.hot.dispose(() => $event.off('pre-tick', step))
		}

		return {
			provide: { ticker },
		}
	},
})
