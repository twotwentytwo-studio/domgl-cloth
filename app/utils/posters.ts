export type Poster = {
	src: string
	title: string
	lede: string
	body: string
	facts: [string, string][]
	series: string[]
}

const COPY: Omit<Poster, 'src' | 'series'>[] = [
	{ title: 'Sun', lede: 'A ring, and the hole it leaves.', body: 'One circle cut from another, set a little above the middle so the sheet has a horizon. Printed in a single pass of red; the white is the paper showing through.', facts: [['Year', '2026'], ['Sheets', '4 at 60 × 80 cm'], ['Inks', 'Warm red, white']] },
	{ title: 'Fold', lede: 'The word, five times, until it is a pattern.', body: 'Set tight and stacked so the counters line up down the sheet. Read once it is an instruction; read five times it is a texture, which is what cloth does to anything printed on it.', facts: [['Year', '2026'], ['Sheets', '4 at 60 × 80 cm'], ['Inks', 'Black, white']] },
	{ title: 'Grid', lede: 'Thirty-five dots that refuse to match.', body: 'A five by seven lattice with three sizes of dot dealt across it in order. The eye wants the rows to settle and they never quite do, more so once the sheet starts to move.', facts: [['Year', '2025'], ['Sheets', '4 at 60 × 80 cm'], ['Inks', 'Violet, lilac']] },
	{ title: 'Arc', lede: 'Most of a circle, and a full stop.', body: 'A quarter turn of heavy line that leaves the sheet before it closes, answered by a dot where the curve would have landed. Drawn with one compass setting.', facts: [['Year', '2025'], ['Sheets', '4 at 60 × 80 cm'], ['Inks', 'Black, lime']] },
	{ title: 'Rings', lede: 'Seven circles, one centre.', body: 'Concentric rings of even weight on an off-white ground. Flat, it is a target. Folded, every ring breaks at the crease and the centre is the only thing that holds still.', facts: [['Year', '2024'], ['Sheets', '4 at 60 × 80 cm'], ['Inks', 'Black, off-white']] },
	{ title: 'Stripe', lede: 'A warning, at thirty-two degrees.', body: 'Hazard bands run corner to corner, wider than the gaps between them. Diagonals are the unkindest thing to drape: they show every fold as a step.', facts: [['Year', '2024'], ['Sheets', '4 at 60 × 80 cm'], ['Inks', 'Black, signal yellow']] },
	{ title: 'Moon', lede: 'Six halves, facing both ways.', body: 'Half discs paired off across a centre line, one waxing, one waning, three times down the sheet. Pink on a green deep enough to pass for night.', facts: [['Year', '2026'], ['Sheets', '4 at 60 × 80 cm'], ['Inks', 'Pink, forest']] },
	{ title: 'Plus', lede: 'Twelve crosses, standing in rows.', body: 'A grid of plus signs in white on cobalt, spaced so the gaps read as loudly as the marks. Addition as wallpaper.', facts: [['Year', '2025'], ['Sheets', '4 at 60 × 80 cm'], ['Inks', 'White, cobalt']] },
	{ title: 'Check', lede: 'A board with no game on it.', body: 'Fifteen red squares on cream, alternate cells of a five by six board. The plainest pattern there is, and the one that shows a fold most honestly.', facts: [['Year', '2024'], ['Sheets', '4 at 60 × 80 cm'], ['Inks', 'Red, cream']] },
	{ title: 'Wave', lede: 'Six lines that never level out.', body: 'One sine, repeated down the sheet in turquoise on navy. It already looks like cloth lying flat, so moving it is a wave on a wave.', facts: [['Year', '2026'], ['Sheets', '4 at 60 × 80 cm'], ['Inks', 'Turquoise, navy']] },
]

const SERIES = 3

export const POSTERS: Poster[] = COPY.map((copy, i) => {
	const number = String(i + 1).padStart(2, '0')

	return {
		...copy,
		src: number,
		series: Array.from({ length: SERIES }, (_, j) => `${number}-${j + 1}`),
	}
})

export const SLIDES = [...POSTERS, ...POSTERS]
