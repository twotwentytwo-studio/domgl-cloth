/*
 * Reactive wrapper over $inview, for the common "has this entered yet" case.
 *
 *   const { el, inView } = useInview()
 *   const { el, inView } = useInview({ once: false })   // track both ways
 *
 * For per-frame work don't use this — read $inview.check(el) inside the tick
 * handler instead, so visibility costs nothing and triggers no re-render.
 */

export function useInview<T extends HTMLElement = HTMLElement>({ once = true } = {}) {
	const el = ref<T | null>(null)
	const inView = ref(false)

	onMounted(() => {
		if (!el.value) return

		const { $inview } = useNuxtApp()

		$inview.observe(el.value, (visible) => {
			if (once && !visible) return
			inView.value = visible
			if (once && el.value) $inview.unobserve(el.value)
		})
	})

	onUnmounted(() => {
		if (el.value) useNuxtApp().$inview.unobserve(el.value)
	})

	return { el, inView }
}
