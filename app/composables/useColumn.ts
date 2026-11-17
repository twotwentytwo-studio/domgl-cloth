import { onBeforeUnmount, onMounted, shallowRef, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import type { Column, ColumnOptions } from '@alpacka/scroll'

type Live = {
	enabled?: MaybeRefOrGetter<boolean>
	loop?: MaybeRefOrGetter<boolean>
	listen?: MaybeRefOrGetter<boolean>
	lead?: MaybeRefOrGetter<HTMLElement | null>
}

export type UseColumnOptions = Omit<ColumnOptions, 'el' | 'box' | keyof Live> & Live

export const useColumn = (el: Ref<HTMLElement | null>, box: Ref<HTMLElement | null>, options: UseColumnOptions = {}) => {
	const { $scroll } = useNuxtApp()
	const column = shallowRef<Column | null>(null)
	const stops: (() => void)[] = []
	const { enabled = true, loop = true, listen = true, lead = null, ...fixed } = options

	const shape = () => ({ enabled: toValue(enabled), loop: toValue(loop), lead: toValue(lead) })

	onMounted(() => {
		if (!el.value) return

		column.value = $scroll.column({ ...fixed, el: el.value, box: box.value, ...shape(), listen: toValue(listen) })

		stops.push(
			watch(shape, (next) => column.value?.set(next), { flush: 'post' }),
			watch(() => toValue(listen), (on) => column.value?.set({ listen: on })),
		)
	})

	onBeforeUnmount(() => {
		stops.forEach((stop) => stop())
		column.value?.destroy({ keep: true })
		column.value = null
	})

	return column
}
