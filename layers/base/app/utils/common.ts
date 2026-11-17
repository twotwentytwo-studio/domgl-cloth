/*
 * Auto-imported by Nuxt (app/utils), from this layer as from the project's
 * own. A project file exporting the same name wins, so anything here can be
 * replaced without editing the layer.
 */

export const qs = <T extends Element = HTMLElement>(s: string, o: Document | Element = document) =>
	o.querySelector<T>(s)

export const qsa = <T extends Element = HTMLElement>(s: string, o: Document | Element = document) =>
	[...o.querySelectorAll<T>(s)]

export const rect = (el: Element) => el.getBoundingClientRect()

/* The pointer-device test, shared by the scroll plugin, $resize.mouse and the
   `has-hover` / `touch` CSS variants — a hybrid device is exactly where a
   second spelling of it would drift. */
export const POINTER = '(hover: hover) and (pointer: fine)'

/*
 * The half of a leaving page a transition is allowed to move.
 *
 * Pinning a page takes it out of flow and, under a wipe, also transforms and
 * clips it. All three break `position: fixed` CHILDREN: a fixed or
 * transformed ancestor becomes their containing block, so a fixed bar starts
 * measuring against a page many screens tall and drops out of sight
 * mid-transition — and a clip cuts it outright.
 *
 * So a page wraps its scrolling content in `[data-pin]` and leaves its fixed
 * chrome outside, as a sibling. Transitions move the wrapper; the chrome stays
 * anchored to the viewport. A page without the wrapper falls back to itself.
 */
export const pinTarget = (el: HTMLElement) => qs<HTMLElement>('[data-pin]', el) ?? el

export const clamp = (min: number, max: number, value: number) =>
	Math.min(Math.max(value, min), max)

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const rand = (min: number, max: number) =>
	Math.floor(Math.random() * (max - min + 1) + min)

export const map = (value: number, low1: number, high1: number, low2: number, high2: number) =>
	low2 + ((high2 - low2) * (value - low1)) / (high1 - low1)

/* Glue the last two words with an nbsp so a paragraph can never end on a
   single-word line — the belt to text-wrap:pretty's suspenders, which treats
   a short last line only as a suggestion.

   Anchored on the last run containing a VISIBLE word character, not on \S+$:
   a CMS's visual-editing metadata (Sanity stega, Dato content-link) trails
   the string as zero-width characters, and some of those count as whitespace
   to a regex — a plain \s+(\S+)$ ties the knot inside the invisible run and
   the widow survives. */
export const noWidow = (s?: string | null) =>
	s ? s.replace(/([ \t]+)(\S*[\p{L}\p{N}][^ \t]*)$/u, ' $2') : s

/* Resolves once the video can render a frame — or immediately if it already
   can. The error listener is deliberate: a failed source must not hang a
   caller awaiting first paint. */
export const preload = (el: HTMLVideoElement) =>
	new Promise<void>((resolve) => {
		if (el.readyState >= 2) return resolve()
		el.addEventListener('canplay', () => resolve(), { once: true })
		el.addEventListener('error', () => resolve(), { once: true })
	})

/* Wait one painted frame — not Vue's nextTick, which flushes the render queue
   without yielding to the compositor. Named apart from it deliberately: Nuxt
   auto-imports both, and shadowing the built-in breaks reactivity elsewhere. */
export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
