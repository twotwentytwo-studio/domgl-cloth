import { virtual } from '@alpacka/scroll'
import { gsap } from 'gsap'

export default defineNuxtPlugin({
	name: 'scroll',
	dependsOn: ['events', 'resize'],
	setup(nuxtApp) {
		const { $event } = nuxtApp

		gsap.config({ autoSleep: 0 })
		gsap.ticker.lagSmoothing(0)

		const scroll = virtual({ reducedMotion: false })

		scroll.on('input', ({ x, y, e }) => {
			$event.emit('vs', { deltaY: y, deltaX: x, event: e })
		})

		scroll.on('tick', ({ time, ratio }) => {
			const beat = { y: 0, time, ratio, velocity: 0, still: true }

			$event.emit('pre-tick', beat)
			$event.emit('tick', beat)
		})

		scroll.across(() => true)

		if (import.meta.hot) {
			import.meta.hot.dispose(() => scroll.destroy())
		}

		return { provide: { scroll } }
	},
})
