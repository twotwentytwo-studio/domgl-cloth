/**
 * One form submission, guarded four ways and then stored.
 *
 * The guards are ordered by what they cost. A honeypot and a clock are free
 * and catch the overwhelming majority; the captcha is a network round trip
 * and only runs when one is configured; the rate limit is memory. Nothing
 * here calls the CMS until the submission has survived all four, so a flood
 * costs it nothing.
 *
 * Stored where the CMS layer stores submissions (cms.storeSubmission — the
 * Sanity layer writes a document; the Dato layer a record, when it has a
 * token for that) and emailed through Resend when that is configured.
 *
 * A flagged submission is STORED, marked, and not emailed. Deleting on
 * suspicion means never finding out the trap was wrong — and the trap will be
 * wrong, on the visitor with a password manager that fills hidden fields, and
 * on the one who took forty minutes over a long message.
 */

/* Under this and it was not typed by a person. Two seconds is well under any
   real fill and well over any script's. */
const MIN_FILL_MS = 2_000
/* Over this and the token is stale — a tab left open, or a replayed capture. */
const MAX_FILL_MS = 12 * 60 * 60 * 1000

const verifyTurnstile = async (token: string | undefined, ip: string) => {
	const secret = useRuntimeConfig().turnstileSecret as string
	if (!secret) return true

	if (!token) return false

	const result = await $fetch<{ success: boolean }>(
		'https://challenges.cloudflare.com/turnstile/v0/siteverify',
		{ method: 'POST', body: { secret, response: token, remoteip: ip } },
	).catch(() => null)

	return Boolean(result?.success)
}

const notify = async (options: {
	form: string
	fields: { label: string; value: string }[]
	source?: string
}) => {
	const { resendApiKey, mailFrom } = useRuntimeConfig()
	if (!resendApiKey || !mailFrom) return

	const to = (await cms.settings().catch(() => null))?.formRecipients ?? []
	if (!to.length) return

	const body = options.fields.map(({ label, value }) => `${label}\n${value}`).join('\n\n')

	/* Failing to send must not fail the submission — it is already stored,
	   and telling a visitor their message did not go through when it did is
	   the worse error. */
	await $fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: { Authorization: `Bearer ${resendApiKey}` },
		body: {
			from: mailFrom,
			to,
			subject: `${options.form} — new submission`,
			text: `${body}\n\n---\n${options.source ?? ''}`,
		},
	}).catch((error) => console.error('[kit] form notification failed', error))
}

export default defineEventHandler(async (event) => {
	const form = getRouterParam(event, 'form') ?? 'form'

	const limited = rateLimit(event, { key: `form:${form}`, limit: 10, windowMs: 60 * 60 * 1000 })
	if (!limited.ok) {
		setResponseHeader(event, 'Retry-After', limited.retryAfter)
		throw createError({ statusCode: 429, message: 'Too many submissions' })
	}

	const body = await readBody<Record<string, unknown>>(event)

	/* The honeypot: a field hidden in CSS, so a person never fills it and a
	   script that fills everything always does. */
	const trapped = Boolean(String(body._gotcha ?? '').trim())

	/* The clock: the form stamps `_t` when it renders. */
	const startedAt = Number(body._t ?? 0)
	const elapsed = startedAt ? Date.now() - startedAt : 0
	const mistimed = !startedAt || elapsed < MIN_FILL_MS || elapsed > MAX_FILL_MS

	const passedCaptcha = await verifyTurnstile(
		typeof body._turnstile === 'string' ? body._turnstile : undefined,
		clientIp(event),
	)

	if (!passedCaptcha) {
		throw createError({ statusCode: 400, message: 'Could not verify this submission' })
	}

	const spam = trapped || mistimed

	/* Everything that is not a control field is content. Kept as an array of
	   label/value pairs rather than as named fields: a form's shape is a
	   frontend decision that changes without a schema migration. */
	const fields = Object.entries(body)
		.filter(([key]) => !key.startsWith('_'))
		.map(([label, value]) => ({
			label,
			value: Array.isArray(value) ? value.join(', ') : String(value ?? ''),
		}))
		.filter(({ value }) => value.trim())

	if (!fields.length) {
		throw createError({ statusCode: 400, message: 'Nothing to submit' })
	}

	const source = typeof body._source === 'string' ? body._source : undefined

	/* Storage failing is the one failure the visitor should hear about — a
	   message that went nowhere must not be answered with "sent". */
	await cms.storeSubmission?.({
		form,
		fields,
		spam,
		source,
		submittedAt: new Date().toISOString(),
	})

	if (!spam) await notify({ form, fields, source })

	/* The same answer either way. Telling a script it was caught is telling it
	   what to change. */
	return { ok: true }
})
