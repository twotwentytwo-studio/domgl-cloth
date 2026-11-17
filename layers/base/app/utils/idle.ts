/*
 * Run work when the main thread is free, so it cannot land inside an
 * animation frame and cost the transition a visible hitch. The timeout is
 * the promise that it still runs soon on a busy thread; Safari has no
 * requestIdleCallback, so it falls back to a macrotask — off the current
 * frame, which is most of the win.
 *
 * Returns a cancel function. Cancel it before scheduling a successor that
 * touches the same state, or guard the callback with a generation counter —
 * transitions do the latter, since flush() can release the same state
 * synchronously in between.
 */
export function idle(fn: () => void, timeout = 500): () => void {
	if (typeof requestIdleCallback === 'function') {
		const id = requestIdleCallback(() => fn(), { timeout })
		return () => cancelIdleCallback(id)
	}

	const id = window.setTimeout(fn, 1)
	return () => window.clearTimeout(id)
}
