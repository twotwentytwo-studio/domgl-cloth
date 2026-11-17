/*
 * Resolves once the ref's element is IN the document; false if the component
 * died first (a discarded fast-navigation instance).
 *
 * Event-driven, no polling, no deadline. onMounted does not mean connected:
 * during a page transition the incoming page's components mount while their
 * subtree is still detached, and a mount-time read of layout or computed
 * style comes back empty — getBoundingClientRect() all zeros,
 * getComputedStyle() "" for every property. `await nextTick()` cannot bridge
 * it either: insertion is gated on the LEAVE animation's done(), a gsap
 * tween, not a Vue scheduler flush.
 *
 * The only moment a detached mount becomes connected is the transition
 * inserting the entering page — and every transition announces that with
 * 'page:inserted' from its enter hook. So this just listens: any number of
 * chained fast navigations resolve the moment THEIR insertion lands, however
 * long the queue ahead of them took. Hard loads and hydration mount
 * connected and never wait at all.
 */
export const awaitConnected = async (el: Ref<HTMLElement | null>) => {
	const { $event } = useNuxtApp()

	while (el.value && !el.value.isConnected) {
		await new Promise<void>((resolve) => {
			const once = () => {
				$event.off('page:inserted', once)
				resolve()
			}

			$event.on('page:inserted', once)
		})
	}

	return !!el.value
}
