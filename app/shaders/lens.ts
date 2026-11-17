const POWER = 0.42

export const lens = {
	unit: 'line' as const,
	code: `
		let t = expo(seq(g, g.lineAt, g.line * 0.5));
		let lh = g.lineBottom - g.lineTop;
		let hang = lh * 0.3;

		r.offset.y = (1.0 - t) * (lh + hang * 2.0);
		r.mask = vec2f(-1e5, mix(g.lineBottom + hang, 1e5, step(0.999, t)));
	`,
	corner: `
		let middle = vp.size * 0.5;
		let reach = vp.size.y * 0.5;

		let q = (at - middle) / reach;
		let far = length(q);

		let k = ${POWER} * step(far, 1.0);

		let fall = 1.0 - far * far;

		at = middle + q * reach * (1.0 + k * fall * fall);

		at.y = at.y - vp.bow;
	`,
}
