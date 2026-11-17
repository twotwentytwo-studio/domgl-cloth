/*
 * One ResizeObserver on <html>, debounced, feeding both reactive state and an
 * imperative read path.
 *
 * Reactive (re-renders):   const small = useState('_small')
 * Imperative (hot paths):  const { $resize } = useNuxtApp(); $resize.small
 * Subscribe:               $resize.add((ww, wh, small, landscape) => { ... })
 *
 * Breakpoints (max-width): small 649 · sm 1099 · medium 1299 — the same as
 * the `s`, `sm` and `m` variants in theme.css.
 *
 * A layout can change without the viewport changing, and the commonest case is
 * a webfont swapping in: every run of text changes width, everything below it
 * moves, and nothing resized. So a face finishing its load re-runs the same
 * callbacks — which is what keeps ScrollTrigger's start/end positions (and any
 * cached rect) true after the swap rather than a font's-worth off.
 */

export default defineNuxtPlugin({
	name: 'resize',
	dependsOn: ['events'],
	setup(nuxtApp) {
		const cbs = new Set<(ww: number, wh: number, small: boolean, landscape: boolean) => void>()
		const { $event } = nuxtApp

		const mq = (q: string) => window.matchMedia(q).matches

		const ww = useState('_width', () => document.documentElement.clientWidth)
		const wh = useState('_height', () => document.documentElement.clientHeight)
		const small = useState('_small', () => mq('(max-width: 649px)'))
		const sm = useState('_sm', () => mq('(max-width: 1099px)'))
		const medium = useState('_medium', () => mq('(max-width: 1299px)'))
		const mouse = useState('_mouse', () => mq(POINTER))
		const landscape = useState('_landscape', () => mq('(orientation: landscape)'))

		/* Mobile chrome collapsing changes 100vh mid-scroll. --vh-c is the
		   current viewport hundredth, --vh-e the expanded one (screen height),
		   so an element can opt out of reflowing when the bars hide. */
		const vh = () => {
			const doc = document.documentElement
			doc.style.setProperty('--vh-c', `${(wh.value || window.innerHeight) / 100}px`)
			doc.style.setProperty(
				'--vh-e',
				`${(window.screen.availHeight || screen.height || doc.clientHeight || wh.value || window.innerHeight) / 100}px`,
			)
		}

		let timer: ReturnType<typeof setTimeout>
		const resize = () => {
			clearTimeout(timer)
			timer = setTimeout(() => {
				ww.value = document.documentElement.clientWidth
				wh.value = document.documentElement.clientHeight

				small.value = mq('(max-width: 649px)')
				sm.value = mq('(max-width: 1099px)')
				medium.value = mq('(max-width: 1299px)')
				mouse.value = mq(POINTER)
				landscape.value = mq('(orientation: landscape)')

				cbs.forEach((cb) => cb(ww.value, wh.value, small.value, landscape.value))

				$event.emit('resize', {
					ww: ww.value,
					wh: wh.value,
					small: small.value,
					landscape: landscape.value,
				})
			}, 50)
		}

		const observer = new ResizeObserver(resize)
		observer.observe(document.documentElement)

		/* a face landing moves text without resizing anything — see the top */
		document.fonts?.addEventListener('loadingdone', resize)
		document.fonts?.ready.then(resize)

		/*
		 * The pointer is settled ONCE, at boot: the scroll plugin runs Lenis
		 * on a fine pointer and native scrolling on touch, and a site's own
		 * boot-time forks (a GL layer, a cursor) read the same fact. A hybrid
		 * that switches its primary pointer mid-session gets a reload rather
		 * than a page wired for the other device.
		 */
		watch(mouse, () => location.reload())

		let orientationObserver: ResizeObserver | null = null

		nuxtApp.hook('app:mounted', () => {
			if (mouse.value) return

			vh()

			/* Only re-measure on an actual orientation flip, not on every
			   resize — on touch the address bar collapsing fires resize
			   constantly and would rewrite --vh-e each time, which is the
			   reflow the variable exists to avoid. The delay lets the new
			   orientation settle before reading. */
			let last = landscape.value

			orientationObserver = new ResizeObserver(() => {
				const current = mq('(orientation: landscape)')
				if (current !== last) {
					last = current
					setTimeout(vh, 100)
				}
			})
			orientationObserver.observe(document.documentElement)
		})

		if (import.meta.hot) {
			import.meta.hot.dispose(() => {
				observer.disconnect()
				orientationObserver?.disconnect()
				document.fonts?.removeEventListener('loadingdone', resize)
				clearTimeout(timer)
			})
		}

		return {
			provide: {
				resize: {
					/* fires immediately with current values — a subscriber
					   never has to duplicate the first measurement */
					add(cb: (ww: number, wh: number, small: boolean, landscape: boolean) => void) {
						cbs.add(cb)
						cb(ww.value, wh.value, small.value, landscape.value)
					},
					remove(cb: (ww: number, wh: number, small: boolean, landscape: boolean) => void) {
						cbs.delete(cb)
					},
					/* re-run every subscriber now — for a layout change nothing
					   observed, like content swapped in by script */
					refresh: resize,
					get ww() { return ww.value },
					get wh() { return wh.value },
					get small() { return small.value },
					get sm() { return sm.value },
					get medium() { return medium.value },
					get mouse() { return mouse.value },
					get landscape() { return landscape.value },
				},
			},
		}
	},
})
