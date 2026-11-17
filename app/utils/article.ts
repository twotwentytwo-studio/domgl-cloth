export type Article = {
	title: string
	lede: string
	sections: { label: string; body: string[] }[]
}

export const ARTICLE: Article = {
	title: 'How it works',
	lede: 'Infinite carousel of cloth posters, simulated on the CPU and drawn on one WebGPU canvas.',
	sections: [
		{
			label: 'Cloth',
			body: [
				'Each poster is a 25 by 33 grid of particles joined by distance constraints and solved with XPBD. The middle of the grid is pinned to the poster\'s DOM box. When the carousel moves, the pin moves and the rest of the sheet follows.',
				'There is no gravity. Air drag acts along the surface normal, and a weak spring pulls each particle back to flat. A sheet at rest stops simulating. The speed and acceleration a sheet feels from its pin are capped, so a fast drag cannot fold it through itself.',
			],
		},
		{
			label: 'Drawing',
			body: [
				'`DomGL` mirrors DOM elements as GPU planes on one canvas. A custom layer draws each sheet as a B-spline surface over its particles, evaluated in the vertex shader, with a weave texture, a sheen and blurred shadows.',
				'Frames are only drawn when something changes. At rest the page makes zero draw calls.',
			],
		},
		{
			label: 'Scroll',
			body: [
				'`virtual()` from `@alpacka/scroll` fixes the document and turns wheel, touch and keys into deltas. The carousel is a `scroll.column()` with `loop`. Each child wraps on its own, so no content is cloned.',
				'Mouse drag is passed in with `scroll.push()` and gets the same easing and momentum as the wheel.',
				'The detail sheets scroll in a second `scroll.column()`, clamped with `whole`. While a sheet is open, the carousel column has `listen` off.',
			],
		},
		{
			label: 'Open, close',
			body: [
				'Clicking a poster lifts it by the point that was clicked. That point moves first and the rest of the sheet trails behind it.',
				'The sheet next to it shows GPU text. While it moves, the frame is drawn to a render target and the sheet uses that as its texture, so the text folds with the cloth. Scrolling the sheet pulls it along.',
			],
		},
		{
			label: 'Type',
			body: [
				'The titles in the background are GPU text, drawn by `DomGL` from the font outlines. They follow the carousel and bend with its speed.',
				'A lens warp is applied at every glyph corner. Each glyph quad is split into a 6 by 6 grid, so the letters curve. A post pass blurs the frame and splits its colours near the top and bottom of the screen.',
			],
		},
		{
			label: 'Built with',
			body: ['`Nuxt 4`, `Tailwind 4`, `GSAP`, `@alpacka/scroll` and `DomGL`.'],
		},
	],
}

export const bits = (text: string) => text.split('`')
