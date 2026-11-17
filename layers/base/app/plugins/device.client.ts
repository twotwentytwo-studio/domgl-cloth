import { DetectUA } from 'detect-ua'

/*
 * Static device/feature facts, read once. Anything that can change with the
 * viewport lives in $resize instead — this is for what the device IS.
 *
 *   const { $device } = useNuxtApp()
 *   $device.phone · $device.features.reducedMotion · $device.features.lowPowerMode
 */

/* A one-frame H.264 clip. iOS Low Power Mode refuses autoplay and there is no
   API that says so — a muted inline clip that stays paused once it could have
   played is the only tell. */
const PROBE = 'data:video/mp4;base64,AAAAIGZ0eXBtcDQyAAACAG1wNDJpc28yYXZjMW1wNDEAAANObW9vdgAAAGxtdmhkAAAAAOA5QnjgOUJ4AAAD6AAAAEMAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAmt0cmFrAAAAXHRraGQAAAAD4DlCeOA5QngAAAABAAAAAAAAAEMAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAACAAAAAgAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAABDAAAAAAABAAAAAAHjbWRpYQAAACBtZGhkAAAAAOA5QnjgOUJ4AAFfkAAAF3BVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABjm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAU5zdGJsAAAAznN0c2QAAAAAAAAAAQAAAL5hdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAACAAIABIAAAASAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAAMWF2Y0MBTUAo/+EAGWdNQCjspLYC1BgYGQAAAwABAAK/IA8YMZYBAAVo6uEyyAAAABNjb2xybmNseAAGAAYABgAAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAF1IAABdSAAAAAYc3R0cwAAAAAAAAABAAAAAgAAC7gAAAAUc3RzcwAAAAAAAAABAAAAAQAAABxzdHNjAAAAAAAAAAEAAAABAAAAAgAAAAEAAAAcc3RzegAAAAAAAAAAAAAAAgAAAxAAAAAMAAAAFHN0Y28AAAAAAAAAAQAAA34AAABvdWR0YQAAAGdtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAADppbHN0AAAAMql0b28AAAAqZGF0YQAAAAEAAAAASGFuZEJyYWtlIDEuNi4xIDIwMjMwMTIyMDAAAAAIZnJlZQAAAyRtZGF0AAAC9AYF///w3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NCByMzEwMCBlZDBmN2E2IC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyMiAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTIgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MToweDExMSBtZT1oZXggc3VibWU9NiBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MCBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTEga2V5aW50PTMwMCBrZXlpbnRfbWluPTMwIHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9MzAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMi4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCB2YnZfbWF4cmF0ZT0yMDAwMCB2YnZfYnVmc2l6ZT0yNTAwMCBjcmZfbWF4PTAuMCBuYWxfaHJkPW5vbmUgZmlsbGVyPTAgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAABRliIQAK//+9q78yyt0fpUs1YVPgQAAAAhBmiFsQn/+Vg=='

export default defineNuxtPlugin({
	name: 'device',
	setup(nuxtApp) {
		const ua = new DetectUA()

		const device = reactive({
			mobile: ua.isMobile,
			tablet: ua.isTablet,
			desktop: ua.isDesktop,
			phone: ua.isMobile && !ua.isTablet,
			features: {
				hasMouse: false,
				hasWheelEvent: false,
				hasTouch: false,
				hasKeyDown: false,
				lowPowerMode: false,
				reducedMotion: false,
			},
		})

		const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
		const onReducedMotionChange = (e: MediaQueryListEvent) => {
			device.features.reducedMotion = e.matches
		}

		/* The probe is made here rather than living in the layout, so no site
		   can forget it and leave the check silently never running. Hidden and
		   out of the tab order; a site's video sections read the flag and fall
		   back to their posters. Re-checked on focus and visibility because the
		   setting can be toggled while the tab sits in the background. */
		let probe: HTMLVideoElement | null = null

		const checkLowPowerMode = () => {
			if (!probe) {
				probe = document.createElement('video')
				probe.src = PROBE
				probe.muted = true
				probe.playsInline = true
				probe.loop = true
				probe.setAttribute('aria-hidden', 'true')
				probe.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none'
				document.body.appendChild(probe)
			}

			const video = probe
			const handle = () => {
				device.features.lowPowerMode = video.paused
			}

			video.addEventListener('canplaythrough', handle, { once: true })
			video.play().then(handle, handle)
		}

		const onVisibility = () => {
			if (document.visibilityState === 'visible') checkLowPowerMode()
		}

		device.features.hasMouse = window.matchMedia(POINTER).matches
		device.features.hasWheelEvent = 'onwheel' in document
		device.features.hasTouch = 'ontouchstart' in window
		device.features.hasKeyDown = 'onkeydown' in document
		device.features.reducedMotion = mql.matches

		/* Safari needs enough per-project workarounds that it is worth a hook in
		   CSS rather than a UA check at each site */
		if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
			document.documentElement.classList.add('is-safari')
		}

		/* iOS Safari only applies :active under an element with a touchstart
		   listener somewhere above it — without one, a press shows nothing on
		   touch, where it is the only feedback there is. Empty and passive, so
		   it never takes the scroll off the compositor. */
		const onTouchStart = () => {}

		mql.addEventListener('change', onReducedMotionChange)
		document.addEventListener('touchstart', onTouchStart, { passive: true })
		document.addEventListener('visibilitychange', onVisibility)
		window.addEventListener('focus', checkLowPowerMode)

		nuxtApp.hook('app:mounted', checkLowPowerMode)

		if (import.meta.hot) {
			import.meta.hot.dispose(() => {
				mql.removeEventListener('change', onReducedMotionChange)
				document.removeEventListener('touchstart', onTouchStart)
				document.removeEventListener('visibilitychange', onVisibility)
				window.removeEventListener('focus', checkLowPowerMode)
				probe?.remove()
			})
		}

		return {
			provide: {
				device: readonly(device),
			},
		}
	},
})
