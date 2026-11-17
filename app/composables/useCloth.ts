import type { Column } from '@alpacka/scroll'
import { useDomGl } from '@lama/domgl'
import { gsap } from 'gsap'
import { ClothLayer, COVER, PAPER } from '~/cloth/layer'
import type { Poster } from '~/utils/posters'

type Box = NonNullable<ReturnType<ClothLayer['box']>>

export const useCloth = () => {
	const { $scroll, $event } = useNuxtApp()
	const gl = useDomGl()

	const open = ref(true)

	const veil = ref(true)

	const covered = ref(true)
	const cover = ref(false)
	const unveiled = ref(false)
	const unsupported = ref(false)

	const sourced = ref(false)

	const READ = 2.1
	const STALL = 5
	const WARM = 1.5
	const PULL = { duration: 1.6, ease: 'power3.inOut' }
	const LATE = 4
	const DRILL = 6

	let began = false
	let covering = false
	let settled = 0
	let late: gsap.core.Tween | null = null

	const page = shallowRef<{ poster: Poster; index: number; box: Box } | null>(null)

	const article = shallowRef<{ box: Box } | null>(null)

	const LANDED = 0.42

	const REVEALS = 2.2

	const FADE = 0.35

	const LINGER = 1.25

	let beats: gsap.core.Tween[] = []

	const cut = () => {
		for (const beat of beats) beat.kill()
		beats = []
	}

	let layer: ClothLayer | null = null

	const move = (_column: Column, strip: HTMLElement, ratio: number) => {
		if (!gl.value) return

		if (!layer) {
			layer = new ClothLayer(gl.value.gl)
			unsupported.value = false

			begin()
		}

		layer.frame(strip, ratio)

		if (!warmed) warmed = warm()

		if (!drilled && layer.rehearse(DRILL)) {
			drilled = true
			off()
		}

		if (covering && covered.value && layer.box() && ++settled > 4) {
			covered.value = false
			cover.value = true

			layer.print(READ)

			beats = [
				gsap.delayedCall(READ, () => {
					read = true
					off()
				}),
				gsap.delayedCall(READ + STALL, unveil),
			]
		}

		if (covering && !sourced.value && (compressed() !== false || performance.now() - begun > WARM * 1000)) sourced.value = true

		if (covering && sourced.value && !asked) {
			const srcs = layer.pictures()

			if (srcs.length) {
				asked = true

				const { textures } = gl.value.gl

				textures.pin(srcs)

				void textures.preload(srcs).then(() => {
					loaded = true
					off()
				})
			}
		}
	}

	let read = false
	let loaded = false
	let asked = false
	let drilled = false
	let begun = 0

	const off = () => read && loaded && drilled && unveil()

	const transcoder = () => (gl.value?.gl.core as unknown as { ktx2?: { ready: boolean; warm(): void; picked?: unknown } | null } | undefined)?.ktx2 ?? null

	const compressed = () => {
		const k = transcoder()
		if (!k) return null

		if (!gl.value?.gl.core.device) return false

		k.warm()

		return k.picked ? k.ready : null
	}

	const WARMED = { materials: ['media', 'solid'], faces: ['display-400', 'geist-mono-400'] }

	let warmed = false

	const warm = () => {
		const g = gl.value?.gl as unknown as { core: { device: unknown; materials: { get(name: string): unknown } }; planes: { layer(face: string): Promise<unknown> } } | undefined
		if (!g?.core.device) return false

		for (const name of WARMED.materials) g.core.materials.get(name)
		for (const face of WARMED.faces) g.planes.layer(face).catch(() => {})

		return true
	}

	const begin = () => {
		if (began) return

		const l = layer
		if (!l) return

		began = true
		covering = true
		begun = performance.now()

		transcoder()?.warm()

		l.open(COVER)
		l.lift = 1
		l.come = 1
		l.behind = true
	}

	const unveil = () => {
		const l = layer
		if (!l || !covering) return

		covering = false

		cut()

		covered.value = false
		open.value = false
		unveiled.value = true

		let flights = 2

		const off = () => {
			if (--flights) return

			l.shut()
			cover.value = false
			veil.value = false
		}

		gsap.to(l, { lift: 0, ...PULL, overwrite: true, onComplete: off })
		gsap.to(l, { come: 0, ...PULL, onComplete: off })

		l.keep(() => {
			cover.value = false
			veil.value = false
		})
	}

	const clock = () => ({ ...MOTION.surface, duration: MOTION.surface.duration * pace })

	const PACE = { near: 1.5, far: 4.5, more: 0.35 }

	let pace = 1

	const paced = (reach: number) => {
		const t = Math.min(1, Math.max(0, (reach - PACE.near) / (PACE.far - PACE.near)))

		return 1 + PACE.more * t * t * (3 - 2 * t)
	}

	const lift = (key: number) => {
		const slide = SLIDES[key]
		if (!slide) return

		raise(key, (box) => {
			page.value = { poster: slide, index: key % POSTERS.length, box }
		})
	}

	const reads = () => {
		if (covering || !unveiled.value) return
		if (open.value) return lower()

		raise(PAPER, (box) => {
			article.value = { box }
		})
	}

	const AIR = 20

	const fit = () => {
		const top = document.querySelector('[data-corner="top"]')
		const foot = document.querySelector('[data-corner="bottom"]')

		if (!layer || !top || !foot) return

		layer.clear = {
			top: top.getBoundingClientRect().bottom + AIR,
			bottom: innerHeight - foot.getBoundingClientRect().top + AIR,
		}
	}

	const raise = (key: number, put: (box: Box) => void) => {
		const l = layer
		if (!l) return

		cut()
		fit()

		page.value = null
		article.value = null

		l.open(key)

		pace = paced(l.reach(key))

		open.value = true
		veil.value = true

		gsap.to(l, { lift: 1, ...clock(), overwrite: true })

		gsap.to(l, { come: 1, ...clock() })

		beats = [
			gsap.delayedCall(FADE, () => {
				l.behind = true
			}),
			gsap.delayedCall(LANDED * pace, () => {
				const box = l.box()
				if (!box) return

				put(box)

				l.print(REVEALS)
			}),
		]
	}

	const lower = () => {
		const l = layer
		if (!l || !open.value || covering) return

		cut()

		open.value = false

		let flights = 2

		const home = () => {
			if (--flights) return

			l.shut()
			page.value = null
			article.value = null
			veil.value = false
		}

		gsap.to(l, { lift: 0, ...clock(), overwrite: true, onComplete: home })
		const out = clock()

		gsap.to(l, { come: 0, ...out, duration: out.duration * LINGER, onComplete: home })

		l.keep(() => {
			page.value = null
			article.value = null
			veil.value = false
		})

		gsap.to(l, {
			ink: 0,
			...MOTION.fade,
			onComplete: () => l.blot(),
		})
	}

	const resized = () => {
		fit()

		const box = layer?.box()
		if (page.value && box) page.value = { ...page.value, box }
		if (article.value && box) article.value = { box }
	}

	const click = (e: MouseEvent) => {
		if (e.button !== 0 || e.metaKey || e.ctrlKey) return

		if (covering) return unveil()

		if (open.value) {
			lower()
			return
		}

		const key = layer?.pick(e.clientX, e.clientY)
		if (key !== null && key !== undefined) lift(key)
	}

	const point = (e: PointerEvent) => layer?.point(e.clientX, e.clientY)
	const gone = () => layer?.point()

	const press = (e: PointerEvent) => {
		if (e.pointerType === 'mouse' && e.button !== 0) return
		if (!open.value) layer?.grab(e.clientX, e.clientY)
	}

	const letGo = () => layer?.release()

	const scrolled = (dy: number) => layer?.scrolled(dy)

	const key = (e: KeyboardEvent) => {
		if (covering) return unveil()

		if (e.key === 'Escape') lower()
	}

	onMounted(() => {
		if (!('gpu' in navigator)) unsupported.value = true
		else late = gsap.delayedCall(LATE, () => {
			if (!layer) unsupported.value = true
		})

		window.addEventListener('click', click)
		window.addEventListener('keydown', key)
		window.addEventListener('pointermove', point, { passive: true })
		window.addEventListener('pointerdown', press, { passive: true })
		window.addEventListener('pointerup', letGo, { passive: true })
		window.addEventListener('pointercancel', letGo, { passive: true })
		document.addEventListener('pointerleave', gone)
		$event.on('resize', resized)
	})

	onBeforeUnmount(() => {
		window.removeEventListener('click', click)
		window.removeEventListener('keydown', key)
		window.removeEventListener('pointermove', point)
		window.removeEventListener('pointerdown', press)
		window.removeEventListener('pointerup', letGo)
		window.removeEventListener('pointercancel', letGo)
		document.removeEventListener('pointerleave', gone)
		$event.off('resize', resized)

		cut()
		late?.kill()

		if (layer) gsap.killTweensOf(layer)

		layer?.destroy()
		layer = null
	})

	return { move, open, veil, page, article, read: reads, scrolled, covered, cover, unveiled, sourced, unsupported }
}
