/* one import per plugin, never `gsap/all` — that barrel pulls every plugin in
   the package into the bundle whether it is registered or not */
import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { LamaSplit } from '@lama/split'

/*
 * Named eases and effects, registered once. ScrollTrigger is registered by the
 * scroll plugin, which owns it. Flip, ScrambleText, Draggable and the rest are
 * registered here by the project that uses one — shipping plugins nothing
 * calls is ~80KB of nothing. Type is cut by @lama/split, not gsap's SplitText.
 *
 * Effects use extendTimeline, so every one is available three ways:
 *
 *   gsap.effects.lines(el)                 // standalone
 *   tl.lines('.js-title', {}, '+=0.5')     // inside a timeline
 *   useSt('lines', { start: 'top 90%' })   // bound to a ScrollTrigger
 *
 * Durations and eases come from MOTION (utils/motion) — the motion defaults.
 * Add a project's effects here rather than tweening inline in components, so
 * the motion vocabulary stays in one place and page transitions can use it.
 *
 * Anything that SPLITS type must run after the webfonts land (fontsReady): a
 * split reads the lines the browser painted, and lines painted in the
 * fallback face are not the ones on screen once the real one lands. useSt
 * waits for that on its own.
 */

export default defineNuxtPlugin({
	name: 'gsap',
	parallel: true,
	setup() {
		gsap.registerPlugin(CustomEase)

		/* The CSS twins of snappy and reveal live in theme.css as linear()
		   samples — re-sample them if a path here changes. */
		CustomEase.create('snappy', 'M0,0 C0.094,0.026 0.124,0.127 0.157,0.29 0.197,0.486 0.254,0.8 0.348,0.884 0.42,0.949 0.374,1 1,1')
		CustomEase.create('reveal', 'M0,0 C0.15,0 0.18,0.1 0.21,0.3 0.24,0.58 0.28,0.84 0.36,0.9 0.44,0.95 0.55,1 1,1')
		CustomEase.create('mask', 'M0,0 C0.25,0 0.289,0.216 0.321,0.426 0.355,0.654 0.441,0.838 0.496,0.886 0.535,0.92 0.698,1 1,1')
		CustomEase.create('unmask', 'M0,0 C0.16,1 0.3,1 1,1')
		CustomEase.create('expo-hard', 'M0,0 C0.084,0.61 0.156,0.822 0.218,0.883 0.287,0.951 0.374,1 1,1')

		/* a bare gsap.to() is a fade unless it says otherwise */
		gsap.defaults({ ...MOTION.fade })

		/*
		 * Lines rise out of their own masks. @lama/split cuts the lines the
		 * browser painted — by geometry, so tight display leading cannot merge
		 * two lines, and indents and <br>s survive — and wraps each in a mask.
		 * `pad` is the slack for type set tighter than its face (caps and
		 * descenders stand outside the line box and the mask would crop them):
		 * padding on the line, the same negative margin on the mask, so the
		 * block keeps its height. `pad: 0` for copy at a normal leading.
		 *
		 * Once every line has landed the cut is reverted — the masks and line
		 * blocks only exist to move under, and a later reflow (a resize, a
		 * face) must re-wrap the real text, not stale lines. Don't let Vue
		 * change a block's contents while it is split: the revert would put
		 * back what it removed.
		 *
		 * `rotate` tilts each line back in z as it rises (-70 is the usual);
		 * 0, the default, is a straight rise.
		 */
		const rise = (target: HTMLElement[], config: any) => {
			const split = new LamaSplit(target, {
				type: 'lines',
				mask: 'lines',
				...(parseFloat(config.pad) ? { pad: config.pad } : {}),
			})

			const lines = split.lines.map((line) => line.el)

			const tilt = config.rotate
				? { rotationX: config.rotate, transformPerspective: config.perspective, transformOrigin: '50% 0%' }
				: {}

			/* 100: a line's own height, from under its mask */
			return gsap.timeline({ onComplete: () => split.revert() }).fromTo(lines, { yPercent: 100, ...tilt }, {
				yPercent: 0,
				...(config.rotate ? { rotationX: 0 } : {}),
				duration: config.duration,
				stagger: config.stagger,
				ease: config.ease,
			})
		}

		/* big text — display, headings, ledes */
		gsap.registerEffect({
			name: 'lines',
			effect: rise,
			/* half an em of slack clears a descender (about .25em) and a sup */
			defaults: { ...MOTION.text, stagger: 0.1, rotate: 0, perspective: 500, pad: '.5em' },
			extendTimeline: true,
		})

		/* small text — body, labels, captions, nav items. `pad: 0`: copy at a
		   normal leading has nothing outside its line box to protect. */
		gsap.registerEffect({
			name: 'linesSmall',
			effect: rise,
			defaults: { ...MOTION.textSmall, stagger: 0.05, rotate: 0, perspective: 500, pad: 0 },
			extendTimeline: true,
		})

		gsap.registerEffect({
			name: 'fade',
			effect: (target: HTMLElement[], config: any) =>
				gsap.timeline().fromTo(target, { autoAlpha: 0 }, {
					autoAlpha: 1,
					duration: config.duration,
					stagger: config.stagger,
					ease: config.ease,
				}),
			defaults: { ...MOTION.fade, stagger: 0 },
			extendTimeline: true,
		})

		/*
		 * Scroll-linked drift. `from` and `to` are fractions of the VIEWPORT
		 * height, never pixels: the travel runs over a screen of scroll, so the
		 * distance belongs in the same unit — a fixed 20px is a visible drift on
		 * a laptop and a rounding error against a card on a large display.
		 *
		 *   useSt('parallax', { to: -0.15, scrub: true, trigger: 'parent' })
		 *
		 * Function values, so a refresh on resize re-reads the viewport
		 * (useSt sets invalidateOnRefresh).
		 */
		gsap.registerEffect({
			name: 'parallax',
			effect: (target: HTMLElement[], config: any) =>
				gsap.timeline().fromTo(target,
					{ y: () => config.from * window.innerHeight },
					{ y: () => config.to * window.innerHeight, duration: 1, ease: 'none' },
				),
			defaults: { from: 0, to: -0.1 },
			extendTimeline: true,
		})

		return {
			provide: { gsap },
		}
	},
})
