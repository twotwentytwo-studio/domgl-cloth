export const cms = defineCmsAdapter({
	isDraft: () => false,
	routable: async () => [],
	document: async () => null,
	settings: async () => null,
	redirects: async () => [],
})
