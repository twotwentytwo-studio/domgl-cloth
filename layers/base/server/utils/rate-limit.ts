import type { H3Event } from 'h3'

/**
 * A per-IP fixed-window counter, held in the instance's memory.
 *
 * Honest about what it is: serverless memory is per-instance, so a request
 * spread across four warm instances gets four windows. That makes this a
 * speed bump rather than a wall — which, against form spam, is what it needs
 * to be. The honeypot and the timing trap do most of the work; this stops the
 * one script that has beaten both from sending ten thousand.
 *
 * A real limiter means shared state — Netlify Blobs, Upstash — and a network
 * round trip on every submission. Reach for one when there is something worth
 * protecting behind the form, not to make a contact form tidier.
 */

type Window = { count: number; resetAt: number }

const windows = new Map<string, Window>()

/* Bound the map: an instance that has seen a million IPs must not hold a
   million entries. Swept on write rather than on a timer, because a timer
   keeps a serverless instance alive. */
const MAX_KEYS = 5000

const sweep = (now: number) => {
	for (const [key, window] of windows) {
		if (window.resetAt <= now) windows.delete(key)
	}

	if (windows.size <= MAX_KEYS) return

	/* still over after expiry — drop oldest-first until under */
	const sorted = [...windows.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt)
	for (const [key] of sorted.slice(0, windows.size - MAX_KEYS)) windows.delete(key)
}

export const clientIp = (event: H3Event) =>
	getRequestHeader(event, 'x-nf-client-connection-ip')
	|| getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
	|| getRequestIP(event, { xForwardedFor: true })
	|| 'unknown'

export const rateLimit = (
	event: H3Event,
	options: { key: string; limit?: number; windowMs?: number },
) => {
	const limit = options.limit ?? 10
	const windowMs = options.windowMs ?? 60 * 60 * 1000
	const now = Date.now()

	sweep(now)

	const key = `${options.key}:${clientIp(event)}`
	const window = windows.get(key)

	if (!window || window.resetAt <= now) {
		windows.set(key, { count: 1, resetAt: now + windowMs })
		return { ok: true as const, remaining: limit - 1 }
	}

	window.count += 1

	if (window.count > limit) {
		return { ok: false as const, retryAfter: Math.ceil((window.resetAt - now) / 1000) }
	}

	return { ok: true as const, remaining: limit - window.count }
}
