import mitt from 'mitt'

/*
 * The bus every per-frame consumer subscribes to. One ticker, one resize
 * observer, one intersection observer — components listen rather than each
 * starting their own rAF loop or observer.
 *
 *   const { $event } = useNuxtApp()
 *   $event.on('tick', ({ y, ratio, still }) => { ... })
 *
 * A frame is two phases, in this order:
 *
 *   pre-tick — the page moves itself. Anything that WRITES a transform from
 *              the scroll or a lerp (a parallax, a marquee, a follower).
 *   tick     — everything that READS the page as it now is (a GL layer
 *              mirroring the DOM, a meter). Reading in the same phase as the
 *              writers leaves whoever subscribed first a frame behind.
 *
 * `page:inserted` fires when a transition puts the entering page into the
 * document — the moment a component that mounted detached can measure. See
 * composables/useConnected.
 *
 * `scroll` and `vs` belong to the two scroll plugins, and a site hears one or
 * the other. The base plugin (Lenis, or the native scroll) emits `scroll`, a
 * position. The virtual scroll a full-WebGL site swaps in for it emits `vs`,
 * raw input each column adds to its own target — see the header of
 * plugins/scroll.client.ts. The base never sends `vs`; it is typed here so
 * that plugin and its columns take $event as it is, with no local type or
 * cast.
 */

export type Frame = {
	/** Scroll position, px. */
	y: number
	/** Seconds since the page loaded. */
	time: number
	/** This frame's length in 60fps frames — multiply a lerp by it. */
	ratio: number
	/** Scroll speed, px per frame. Differenced on touch — a sampling, not a physics value. */
	velocity: number
	/** No scroll movement this frame. */
	still: boolean
}

/**
 * One input to the virtual scroll. Lenis' sign: positive deltaY scrolls DOWN.
 * deltaX is only ever the mouse drag, the one input that is an axis. `event`
 * is the last event of what was summed — read it for what KIND of input this
 * was, never for its delta.
 */
export type VirtualScroll = {
	deltaY: number
	deltaX: number
	event: Event | null
}

export type Events = {
	'pre-tick': Frame
	tick: Frame
	scroll: { y: number; direction: number }
	resize: { ww: number; wh: number; small: boolean; landscape: boolean }
	'page:inserted': void
	/* a key, not `vs?:` — mitt would widen every handler's payload to
	   `| undefined` and accept an emit with none */
	vs: VirtualScroll
}

export default defineNuxtPlugin({
	name: 'events',
	setup() {
		return {
			provide: {
				event: mitt<Events>(),
			},
		}
	},
})
