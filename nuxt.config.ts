export default defineNuxtConfig({
	compatibilityDate: '2026-08-07',

	css: ['~/assets/css/globals.css'],

	modules: ['@lama/domgl/nuxt'],
	domgl: { gate: 'all' },

	hooks: {
		'app:resolve'(app) {
			app.plugins = app.plugins.filter((plugin) =>
				!plugin.src.endsWith('/layers/base/app/plugins/scroll.client.ts'))
		},
	},

	runtimeConfig: {
		public: {
			kit: {
				routes: {},
			},
		},
	},
})
