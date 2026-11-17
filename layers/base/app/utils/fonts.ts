/*
 * Settled when the webfonts are, or after `cap` ms — whichever comes first.
 *
 * Anything that SPLITS type has to wait on this. SplitText measures line breaks
 * against the face that is actually loaded, so a split run against the fallback
 * breaks the copy on the wrong words and the reveal plays lines that do not
 * match the ones on screen. The faces the first screen uses are preloaded in
 * the document head (see app.vue), so on an ordinary load this is already
 * settled by hydration and costs nothing.
 *
 * The cap is the promise that it resolves at all. Every caller is holding a
 * reveal behind it, usually with the page under an opaque cover, and a face
 * that never arrives must not leave the site white for good.
 */
export const fontsReady = (cap = 1500) => Promise.race([
	document.fonts?.ready ?? Promise.resolve(),
	new Promise((r) => setTimeout(r, cap)),
])
