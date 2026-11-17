import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

/*
 * The page's scroll and its clock.
 *
 *   const { $scroll } = useNuxtApp()
 *   $scroll.to(500) · $scroll.to('#section') · $scroll.to(el, 1.5)
 *   $scroll.stop() / .start() / .reset() / .resize()
 *   $scroll.y · $scroll.velocity · $scroll.smooth · $scroll.lenis
 *
 * Emits 'scroll' on $event, and 'pre-tick' then 'tick' once per frame — see
 * plugins/events for which phase a consumer belongs in.
 *
 * ── A fine pointer: Lenis on the window ──
 *
 * Wheel and trackpad are smoothed, driven off this plugin's own rAF so smooth
 * scroll, ScrollTrigger and every per-frame consumer share one clock.
 *
 * ── Touch: no Lenis in the room at all ──
 *
 * The browser owns a finger's scroll, and must keep owning it. Lenis cannot
 * merely observe: even with syncTouch off it binds wheel, touchstart and
 * touchmove as NON-passive listeners on the window (lenis 1.3,
 * `listenerOptions = { passive: false }`), and a non-passive touchmove makes
 * the browser wait on JS before every scroll step — which takes the scroll
 * off the compositor and the fling with it. So on touch the window scrolls
 * natively and this plugin only reads where it is. Same API either way:
 * $scroll.y, the events and ScrollTrigger downstream do not know which.
 *
 * Reduced motion is the native path on every device — an eased scroll is
 * exactly the motion the preference asks to drop.
 *
 * ── Full WebGL: the virtual scroll instead ──
 *
 * A site where nothing scrolls natively swaps this plugin for the virtual
 * scroll: its own app/plugins/scroll.client.ts, emitting 'vs' and then
 * 'pre-tick' and 'tick' on the same bus, AND this one taken out in its
 * nuxt.config —
 *
 *   hooks: {
 *     'app:resolve'(app) {
 *       app.plugins = app.plugins.filter((plugin) =>
 *         !plugin.src.endsWith('/layers/base/app/plugins/scroll.client.ts'))
 *     },
 *   },
 *
 * — because a file of the same name does not replace this one. Nuxt gathers
 * every layer's plugins and dedupes them by resolved path alone (middleware
 * is deduped by name; plugins are not), so the site's file runs BESIDE this
 * one: two rAF loops each emitting the frame, Lenis still bound to the
 * window, and `$scroll` provided twice, which throws at boot — Nuxt defines
 * each $name once.
 *
 * ScrollTrigger leaves with this file: it is registered here, and a fixed
 * document gives it no scroll to read, so useSt has nothing to bind to. The
 * document is fixed in the site's own CSS — html and body `position: fixed;
 * overflow: hidden; touch-action: none`, and `scrollbar-gutter: auto` on
 * html, or theme.css's reserved gutter is an empty strip down the right edge.
 */

export default defineNuxtPlugin({
	name: 'scroll',
	dependsOn: ['events', 'resize'],
	setup(nuxtApp) {
		gsap.registerPlugin(ScrollTrigger)

		const { $resize, $event } = nuxtApp

		/* read live rather than cached — the preference can change mid-session */
		const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

		/* the device is settled at boot; the resize plugin reloads on a switch */
		const smooth = window.matchMedia(POINTER).matches && !reduced()

		const lenis = smooth ? new Lenis({ lerp: 0.125, autoResize: false }) : null

		const ease = (x: number) => // expo in-out, for $scroll.to
			x === 0 ? 0 : x === 1 ? 1 : x < 0.5
				? Math.pow(2, 20 * x - 10) / 2
				: (2 - Math.pow(2, -20 * x + 10)) / 2

		let y = lenis ? lenis.scroll : window.scrollY
		let velocity = 0

		if (lenis) {
			/* Lenis moves the window itself, so ScrollTrigger needs no
			   scrollerProxy — only telling that the position changed */
			lenis.on('scroll', ({ scroll, direction }: { scroll: number; direction: number }) => {
				ScrollTrigger.update()
				$event.emit('scroll', { y: scroll, direction })
			})
		}

		/* native: ScrollTrigger listens to the window on its own; this is only
		   the bus's copy. Passive, or it would be the very listener the touch
		   note above is about. */
		let lastNative = window.scrollY
		const onNativeScroll = () => {
			const now = window.scrollY
			$event.emit('scroll', { y: now, direction: Math.sign(now - lastNative) || 1 })
			lastNative = now
		}

		if (!lenis) window.addEventListener('scroll', onNativeScroll, { passive: true })

		/* ── The heartbeat: our rAF, not gsap's ──
		 *
		 * Every frame the display gives us, and not one fewer. gsap.ticker drops
		 * frames on a 120Hz display: gsap-core caps the interval between ticks at
		 * 4ms, rAF clumps under load, and the ticker then skips one.
		 *
		 * TWO LOOPS, deliberately. gsap keeps its own ticker for its own tweens;
		 * everything continuous — the lerps, a GL render — runs on this one.
		 *
		 * gsap must never doze off, and this line is load-bearing: gsap-core's
		 * autoSleep check is `_ticker._listeners.length < 2`, so with nothing
		 * else on its ticker it sleeps whenever nothing animates — and the next
		 * tween wakes into a gap lagSmoothing(0) declines to correct, is handed
		 * the whole idle period in one step, and finishes on its first frame.
		 * 0 rather than false: a falsy value never sleeps, and 0 is the one its
		 * types allow. */
		gsap.config({ autoSleep: 0 })

		/* still off for gsap's own tweens: after a real stall it would hand them
		   one enormous delta and jump every animation to its end */
		gsap.ticker.lagSmoothing(0)

		let prev = 0
		let raf = 0

		const frame = (time: number) => {
			raf = requestAnimationFrame(frame)

			/* how many 60fps frames this one was worth, so every lerp keeps its
			   feel at any refresh rate. Zero on the first frame. Consumers clamp
			   the top end themselves, for the tab-switch case where it arrives
			   enormous. */
			const ratio = prev ? (time - prev) / (1000 / 60) : 0
			prev = time

			let still: boolean

			if (lenis) {
				lenis.raf(time)
				y = lenis.scroll
				velocity = lenis.velocity
				still = !lenis.isScrolling
			} else {
				/* differenced per frame: a native fling is the browser's to know,
				   so this is a sampling of it, not its physics */
				const now = window.scrollY
				velocity = now - y
				y = now
				still = velocity === 0
			}

			const beat = { y, time: time / 1000, ratio, velocity, still }

			$event.emit('pre-tick', beat)
			$event.emit('tick', beat)
		}

		const resize = () => {
			ScrollTrigger.refresh()
			lenis?.resize()
		}

		/* AFTER gsap is imported, and that ordering matters. Two rAF loops are
		   dispatched in registration order and gsap registers its own at import,
		   so gsap's tweens advance first every frame and only then does 'tick'
		   fire — a reader of a tweened value always sees this frame's. */
		raf = requestAnimationFrame(frame)

		$resize.add(resize)

		/* A navigation lands where Nuxt's scroll behaviour puts it — the top, a
		   saved position, a #hash — through a native scroll, which Lenis only
		   follows while it is not gliding. So a glide still running when the new
		   page arrives is stopped here, or it would carry on toward the old
		   page's target and drag the new page back down. (Its new height needs
		   nothing: the resize plugin watches <html> and calls resize() above.) */
		nuxtApp.hook('page:finish', () => {
			if (!lenis?.isScrolling) return
			lenis.stop()
			lenis.start()
		})

		const resolve = (target: number | string | HTMLElement) => {
			if (typeof target === 'number') return target

			const el = typeof target === 'string'
				? qs(target.startsWith('#') ? target : `#${target}`)
				: target

			if (!el) {
				console.error(`scroll.to: no element found for "${target}"`)
				return null
			}

			return el
		}

		if (import.meta.hot) {
			import.meta.hot.dispose(() => {
				cancelAnimationFrame(raf)
				window.removeEventListener('scroll', onNativeScroll)
				$resize.remove(resize)
				lenis?.destroy()
			})
		}

		return {
			provide: {
				scroll: {
					to(target: number | string | HTMLElement, duration = 1) {
						const to = resolve(target)
						if (to === null) return

						if (lenis) {
							lenis.scrollTo(to, reduced() ? { immediate: true } : { duration, easing: ease })
							return
						}

						const top = typeof to === 'number'
							? to
							: to.getBoundingClientRect().top + window.scrollY

						window.scrollTo({ top, behavior: reduced() ? 'instant' : 'smooth' })
					},

					/*
					 * Straight to the top, now — for a transition that moves the
					 * scroll itself (under a cover, or pinning the leaving page)
					 * instead of leaving it to Nuxt's scroll behaviour. Refresh
					 * FIRST: ScrollTrigger's refresh restores the scroll it started
					 * from with a native scroll event, and Lenis reads that as the
					 * user taking over and cancels a scrollTo already queued.
					 * `force` because a transition may have stopped Lenis.
					 */
					reset() {
						resize()

						if (lenis) lenis.scrollTo(0, { immediate: true, force: true })
						else window.scrollTo(0, 0)
					},

					stop() {
						if (lenis) lenis.stop()
						else document.documentElement.classList.add('scroll-locked')
					},

					start() {
						if (lenis) lenis.start()
						else document.documentElement.classList.remove('scroll-locked')
					},

					resize,

					get y() { return y },
					get velocity() { return velocity },
					/** Lenis is running — a fine pointer, motion allowed. */
					get smooth() { return Boolean(lenis) },
					get lenis() { return lenis },
				},
			},
		}
	},
})
