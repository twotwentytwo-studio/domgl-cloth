/*
 * The motion defaults, named once. A duration or an ease is never picked per
 * element: a tween spreads one of these, and a project that wants different
 * values changes them HERE (and says so in its design-system.md) rather than
 * writing a one-off .4s into a component.
 *
 *   gsap.to(el, { autoAlpha: 1, ...MOTION.fade })
 *   gsap.to(panel, { yPercent: 0, ...MOTION.surface })
 *
 * fade      — any plain opacity in or out, a cross-fade, a hover tint.
 *             CSS twin: `transition` (theme.css makes it the default).
 * surface   — anything that moves a whole surface: page wipes, menus,
 *             modals, drawers. CSS twin: `duration-1000 ease-(--ease-snappy)`.
 * text      — reveals of BIG text: display, headings, ledes. A big line has
 *             further to travel and reads as heavy, so it gets expo's long tail.
 * textSmall — reveals of small text: body, labels, captions, nav items. On
 *             expo it would look like it was lagging; it moves like a fade,
 *             only a little firmer.
 *
 * Scroll-linked distances (a parallax, a lag) are fractions of the VIEWPORT,
 * never pixel counts — see the `parallax` effect in plugins/gsap.
 */
export const MOTION = {
	fade: { duration: 0.35, ease: 'power1.out' },
	surface: { duration: 1, ease: 'snappy' },
	text: { duration: 1.25, ease: 'expo.out' },
	textSmall: { duration: 0.5, ease: 'power2.out' },
} as const
