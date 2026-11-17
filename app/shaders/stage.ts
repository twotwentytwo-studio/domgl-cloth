import { RIG } from './rig'

const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n))

export const camera = `
	const FOCAL = ${f(RIG.focal)};
`

export const light = `
	const LIGHT = vec3f(-0.42, -0.6, 0.68);
	const FILL = 0.34;

	fn lit(rgb: vec3f, light: f32, gloss: f32) -> vec3f {
		let over = max(light - 1.0, 0.0);
		return rgb * min(light, 1.0) + (vec3f(1.0) - rgb) * over * gloss;
	}
`
