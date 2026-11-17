export const ghost = {
	video: false,
	raw: true,
	frag: `
		fn shade(s: Surface) -> vec4f {
			return vec4f(0.0);
		}
	`,
}
