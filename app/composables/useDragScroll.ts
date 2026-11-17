import { toValue, type MaybeRefOrGetter } from 'vue'
import { drag, grabbable, grabbing, swallower, SLOP } from '~/utils/drag'

const GEAR = 1.5

const LEVEL: [number, number] = [1, 0]

const FLING = 12

const STALE = 100

type Options = {
	axis?: MaybeRefOrGetter<[number, number]>
	gear?: MaybeRefOrGetter<number>
	finger?: MaybeRefOrGetter<[number, number] | null>
}

export const useDragScroll = ({ axis: way = LEVEL, gear: geared = GEAR, finger: fingered = null }: Options = {}) => {
	const { $scroll } = useNuxtApp()

	let axis = toValue(way)
	let gear = toValue(geared)

	const along = (e: PointerEvent) => e.clientX * axis[0] + e.clientY * axis[1]

	let x0 = 0
	let y0 = 0
	let last = 0
	let v = 0
	let vAt = 0
	let tracking = false
	let claimed = false

	let thumb = false

	const click = swallower()

	const push = (d: number, e: PointerEvent | null) => (Math.abs(axis[1]) > Math.abs(axis[0]) ? $scroll.push(d, 0, e) : $scroll.push(0, d, e))

	const stop = (e: PointerEvent | null, thrown: boolean) => {
		tracking = false

		if (claimed) {
			claimed = false
			drag.scroll = false
			grabbing(false)

			if (thrown && e && v && e.timeStamp - vAt < STALE) push(v * FLING, e)
		}

		v = 0

		window.removeEventListener('pointermove', move)
		window.removeEventListener('pointerup', up)
		window.removeEventListener('pointercancel', cancel)
	}

	const move = (e: PointerEvent) => {
		if (!e.buttons) {
			stop(e, false)
			return
		}

		if (!claimed) {
			const dx = e.clientX - x0
			const dy = e.clientY - y0

			const da = Math.abs(dx * axis[0] + dy * axis[1])
			const dc = Math.abs(dx * axis[1] - dy * axis[0])

			if (thumb ? Math.hypot(dx, dy) <= SLOP : da <= SLOP || da <= dc) return

			claimed = true
			drag.scroll = true
			grabbing(true)

			last = along(e)
		}

		e.preventDefault()
		click.arm()

		v = (last - along(e)) * gear
		vAt = e.timeStamp
		last = along(e)

		if (v) push(v, e)
	}

	const up = (e: PointerEvent) => stop(e, true)
	const cancel = (e: PointerEvent) => stop(e, false)

	const down = (e: PointerEvent) => {
		if (tracking || e.button !== 0 || e.ctrlKey) return

		const by = e.pointerType === 'touch' ? toValue(fingered) : null

		if (e.pointerType !== 'mouse' && !by) return

		thumb = !!by
		axis = by ?? toValue(way)
		gear = toValue(geared)

		x0 = e.clientX
		y0 = e.clientY
		tracking = true
		click.reset()
		v = 0

		window.addEventListener('pointermove', move, { passive: false })
		window.addEventListener('pointerup', up)
		window.addEventListener('pointercancel', cancel)
	}

	const noNative = (e: Event) => e.preventDefault()

	onMounted(() => {
		grabbable(true)
		window.addEventListener('pointerdown', down)
		window.addEventListener('dragstart', noNative)
		window.addEventListener('click', click, true)
	})

	onBeforeUnmount(() => {
		stop(null, false)

		grabbable(false)
		window.removeEventListener('pointerdown', down)
		window.removeEventListener('dragstart', noNative)
		window.removeEventListener('click', click, true)
	})
}
