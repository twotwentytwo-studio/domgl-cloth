/*
 * A frame-rate meter, dev only — Shift+F.
 *
 * Driven off the shared tick rather than a loop of its own: update() measures
 * the gap between ticks, which is the whole frame, so the panel reads what a
 * frame of THIS site costs. A standalone meter next to the real loop reports
 * the display's refresh rate and nothing else.
 *
 * stats.js is a devDependency, imported dynamically inside the dev branch, so
 * it never reaches a production bundle.
 */
export default defineNuxtPlugin({
	name: 'stats',
	dependsOn: ['events'],
	async setup(nuxtApp) {
		if (!import.meta.dev) return

		const { $event } = nuxtApp
		const { default: Stats } = await import('stats.js')

		const stats = new Stats()
		stats.showPanel(0)
		stats.dom.style.cssText = 'position:fixed;bottom:0;right:0;z-index:1000'
		stats.dom.hidden = true
		document.body.appendChild(stats.dom)

		const tick = () => stats.update()
		$event.on('tick', tick)

		const keydown = (e: KeyboardEvent) => {
			if (!e.shiftKey || e.code !== 'KeyF') return

			const t = e.target as HTMLElement | null
			if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return

			stats.dom.hidden = !stats.dom.hidden
		}

		window.addEventListener('keydown', keydown)

		if (import.meta.hot) {
			import.meta.hot.dispose(() => {
				$event.off('tick', tick)
				window.removeEventListener('keydown', keydown)
				stats.dom.remove()
			})
		}
	},
})
