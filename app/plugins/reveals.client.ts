import { useDomGl } from '@lama/domgl'
import { lens } from '~/shaders/lens'

export default defineNuxtPlugin({
	name: 'reveals',
	setup() {
		const ctx = useDomGl()
		let defined: unknown = null

		watch(ctx, (c) => {
			if (!c || c.gl === defined) return

			c.gl.defineReveal('lens', lens)
			defined = c.gl
		}, { immediate: true })
	},
})
