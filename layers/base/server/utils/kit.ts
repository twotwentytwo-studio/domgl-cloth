/** The kit's slice of runtime config, typed once so no handler re-casts it. */
export const kitConfig = () => {
	const kit = useRuntimeConfig().public.kit as {
		routes: Record<string, string>
		indexed: string[]
		cacheMaxAge: number
		agents: boolean
		draftCookie: string
	}

	/* Empty `indexed` means every routable type that carries a slug — the
	   common case, and one less thing to keep in step. */
	const indexed = kit.indexed?.length
		? kit.indexed
		: Object.entries(kit.routes ?? {})
				.filter(([, pattern]) => pattern.includes(':slug'))
				.map(([type]) => type)

	return { ...kit, indexed }
}
