/**
 * The client half of a spam-guarded form.
 *
 *   const { fields, state, error, submit, trap } = useForm('contact')
 *
 *   <form @submit.prevent="submit">
 *     <input v-model="fields.email" name="email">
 *     <input v-bind="trap" v-model="fields._gotcha">
 *   </form>
 *
 * Two of the three guards are set up here and neither asks anything of the
 * visitor: the honeypot is a field a person never sees and a script always
 * fills, and the clock is a timestamp taken when the form renders. The third,
 * the captcha, is optional and only runs when a Turnstile key is configured.
 *
 * `trap` carries the attributes that hide the honeypot from people and from
 * assistive tech while leaving it visible to a script — `display: none` alone
 * is not enough, because the better bots skip hidden fields. Off-screen with
 * `tabindex="-1"` and `aria-hidden` reads as absent to a screen reader and as
 * present to a parser.
 */
export const useForm = <T extends Record<string, string>>(
	form: string,
	initial: T = {} as T,
) => {
	const fields = reactive({ ...initial, _gotcha: '' })
	const state = ref<'idle' | 'sending' | 'sent' | 'error'>('idle')
	const error = ref('')

	/* Stamped on mount rather than at module scope: a page restored from the
	   back-forward cache would otherwise carry a timestamp from the first
	   visit and trip the max-age half of the trap. */
	const startedAt = ref(0)
	onMounted(() => {
		startedAt.value = Date.now()
	})

	const trap = {
		type: 'text',
		name: '_gotcha',
		tabindex: -1,
		autocomplete: 'off',
		'aria-hidden': 'true',
		style: 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none',
	} as const // literal types, or `v-bind="trap"` fails: autocomplete and aria-hidden take unions, not string

	const submit = async (turnstileToken?: string) => {
		if (state.value === 'sending') return

		state.value = 'sending'
		error.value = ''

		try {
			await $fetch(`/api/form/${form}`, {
				method: 'POST',
				body: {
					...fields,
					_t: startedAt.value,
					_turnstile: turnstileToken,
					_source: useRoute().fullPath,
				},
			})

			state.value = 'sent'
		}
		catch (caught) {
			state.value = 'error'
			error.value =
				(caught as { data?: { message?: string } })?.data?.message
				|| 'Something went wrong. Try again.'
		}
	}

	return { fields, state, error, submit, trap }
}
