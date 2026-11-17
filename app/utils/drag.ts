export const drag = { scroll: false }

export const SLOP = 10

export const swallower = () => {
	let armed = false

	const swallow = (e: Event) => {
		if (!armed) return

		armed = false
		e.preventDefault()
		e.stopPropagation()
	}

	swallow.arm = () => {
		armed = true
	}

	swallow.reset = () => {
		armed = false
	}

	return swallow
}

export const grabbing = (on: boolean) => {
	document.documentElement.toggleAttribute('data-grabbing', on)
}

let hands = 0

export const grabbable = (on: boolean) => {
	hands = Math.max(0, hands + (on ? 1 : -1))
	document.documentElement.toggleAttribute('data-grabbable', hands > 0)
}
