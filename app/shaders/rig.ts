export const RIG: { roll: number; readonly yaw: number; readonly focal: number; readonly turn: number } = {
	roll: 0.56,
	yaw: 0.5,
	focal: 1.5,
	turn: 1.15,
}

const { cos, sin } = Math

export const toRoom = (x: number, y: number, z: number): [number, number, number] => {
	const ax = x * cos(RIG.yaw) + z * sin(RIG.yaw)
	const az = -x * sin(RIG.yaw) + z * cos(RIG.yaw)

	return [ax * cos(RIG.roll) + y * sin(RIG.roll), -ax * sin(RIG.roll) + y * cos(RIG.roll), az]
}

export const facing = (about: number, roll: number): number[] => [
	cos(about) * cos(roll), sin(roll), -sin(about) * cos(roll),
	-cos(about) * sin(roll), cos(roll), sin(about) * sin(roll),
	sin(about), 0, cos(about),
]

export const TURNED = RIG.turn - RIG.yaw

export const clears = (w: number, h: number, vw: number, vh: number, slack = 0.6) => {
	stand(vw, vh)

	const m = facing(TURNED, RIG.roll)
	const eye = RIG.focal * vh

	const off = (cx: number) => {
		const pin = toRoom(cx, 0, 0)

		for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
			const x = (u * w) / 2
			const y = (v * h) / 2

			const z = pin[2] + m[6]! * x + m[7]! * y
			if (z >= eye * 0.95) continue

			const near = eye / (eye - z)

			const sx = (pin[0] + m[0]! * x + m[1]! * y) * near
			const sy = (pin[1] + m[3]! * x + m[4]! * y) * near

			if (sx > -vw / 2 && sy < vh / 2) return false
		}

		return true
	}

	const gone = -(vw + w) / 2

	let past = 0

	while (past < vw * 4 && !off(gone - past)) past += 8

	return past + w * slack
}

export const AXIS: [number, number] = [cos(RIG.roll), -sin(RIG.roll)]

export const ROLL = { wide: 0.56, tall: 0.34 }

export const stand = (vw: number, vh: number) => {
	const roll = vh > vw ? ROLL.tall : ROLL.wide

	if (roll === RIG.roll) return

	RIG.roll = roll

	AXIS[0] = cos(roll)
	AXIS[1] = -sin(roll)
}

export const SQUASH = cos(RIG.yaw)
