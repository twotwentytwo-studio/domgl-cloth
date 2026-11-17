import { gsap } from 'gsap'

/*
 * Bind a registered gsap effect to a ScrollTrigger on one element.
 *
 *   <h2 ref="title">…</h2>
 *   const title = useSt('lines', { start: 'top 90%' })
 *   const media = useSt('parallax', { to: -0.15, scrub: true, trigger: 'parent' })
 *
 * Everything not consumed here is forwarded to the effect.
 *
 * It waits for the webfonts before building (capped — see utils/fonts): the
 * text effects split lines, and a split measured against the fallback face
 * animates lines that are not the ones on screen.
 */

type Options = {
	start?: string
	end?: string
	scrub?: boolean | number
	/** a gsap.matchMedia query — the effect only exists while it matches */
	media?: string | null
	/** 'parent' when the effect transforms the element it would measure */
	trigger?: 'self' | 'parent'
	[key: string]: any
}

export function useSt<T extends HTMLElement = HTMLElement>(name: string, opts: Options = {}) {
	const el = ref<T | null>(null)
	let ctx: gsap.Context | null = null
	let alive = true

	onMounted(async () => {
		await fontsReady()
		if (!alive || !el.value) return

		const { start = 'top 80%', end, scrub = false, media = null, trigger = 'self', ...rest } = opts

		/* start/end are measured off the trigger with getBoundingClientRect,
		   which includes transforms — so an effect that transforms the element
		   would measure its own output. 'parent' hands ScrollTrigger the
		   untransformed wrapper instead. */
		const triggerEl = (trigger === 'parent' && el.value.parentElement) || el.value

		ctx = gsap.context(() => {
			const make = () => {
				const tl = gsap.timeline({
					/* re-read function values (the parallax's viewport
					   fractions) whenever ScrollTrigger refreshes */
					scrollTrigger: { trigger: triggerEl, start, end, scrub, invalidateOnRefresh: true },
				}) as any

				tl[name](el.value, rest)
			}

			if (media) {
				const mm = gsap.matchMedia()

				mm.add(media, () => {
					make()

					/* gsap only reverts what it set itself, and an effect can
					   write inline styles by hand. Clear them, or a device that
					   stops matching mid-session is left holding the last pose. */
					return () => {
						const s = el.value?.style
						if (!s) return
						s.clipPath = ''
						s.transform = ''
						s.willChange = ''
					}
				})

				return () => mm.revert()
			}

			make()
		}, el.value)
	})

	onUnmounted(() => {
		alive = false
		ctx?.revert()
		ctx = null
	})

	return el
}
