#!/usr/bin/env node

import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'media-src')
mkdirSync(out, { recursive: true })

const W = 1200
const H = 1600
const FONT = `font-family="Helvetica Neue, Helvetica, Arial, sans-serif"`

const sheet = (bg, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`

const range = (n) => [...Array(n).keys()]

const posters = [
	sheet('#ff3b14', `
		<circle cx="600" cy="700" r="380" fill="#fff"/>
		<circle cx="600" cy="700" r="170" fill="#ff3b14"/>`),

	sheet('#0c0c0c', `
		${range(5).map((i) => `<text x="600" y="${330 + i * 250}" ${FONT} font-size="300" font-weight="900" letter-spacing="-12" text-anchor="middle" fill="#fff">FOLD</text>`).join('')}`),

	sheet('#b9a4f0', `
		${range(7).flatMap((y) => range(5).map((x) => `<circle cx="${200 + x * 200}" cy="${190 + y * 190}" r="${28 + ((x + y) % 3) * 22}" fill="#2a1466"/>`)).join('')}`),

	sheet('#a6f25c', `
		<path d="M180 1180 A520 520 0 0 1 1020 560" fill="none" stroke="#0c0c0c" stroke-width="210" stroke-linecap="butt"/>
		<circle cx="840" cy="1120" r="130" fill="#0c0c0c"/>`),

	sheet('#f6f4ef', `
		${range(7).map((i) => `<circle cx="600" cy="720" r="${470 - i * 66}" fill="none" stroke="#0c0c0c" stroke-width="30"/>`).join('')}`),

	sheet('#ffc400', `
		<g transform="rotate(-32 600 800)">
			${range(12).map((i) => `<rect x="-600" y="${-500 + i * 240}" width="2400" height="110" fill="#0c0c0c"/>`).join('')}
		</g>
`),

	sheet('#0e4b3a', `
		${range(3).map((i) => `<path d="M${200} ${330 + i * 400} a200 200 0 0 1 400 0 z" fill="#ffb8d9"/><path d="M${600} ${330 + i * 400} a200 200 0 0 0 400 0 z" fill="#ffb8d9"/>`).join('')}`),

	sheet('#1e3bff', `
		${range(4).flatMap((y) => range(3).map((x) => {
			const cx = 220 + x * 380
			const cy = 240 + y * 340
			return `<rect x="${cx - 110}" y="${cy - 34}" width="220" height="68" fill="#fff"/><rect x="${cx - 34}" y="${cy - 110}" width="68" height="220" fill="#fff"/>`
		})).join('')}`),

	sheet('#f2ebdd', `
		${range(6).flatMap((y) => range(5).map((x) => ((x + y) % 2 ? '' : `<rect x="${100 + x * 200}" y="${120 + y * 200}" width="200" height="200" fill="#e0301e"/>`))).join('')}`),

	sheet('#12123a', `
		${range(6).map((i) => `<path d="M-50 ${260 + i * 200} q 162 -150 325 0 t 325 0 t 325 0 t 325 0" fill="none" stroke="#3fe0d0" stroke-width="64"/>`).join('')}`),
]

const inks = [
	['#ff3b14', '#fff'], ['#0c0c0c', '#fff'], ['#b9a4f0', '#2a1466'], ['#a6f25c', '#0c0c0c'], ['#f6f4ef', '#0c0c0c'],
	['#ffc400', '#0c0c0c'], ['#0e4b3a', '#ffb8d9'], ['#1e3bff', '#fff'], ['#f2ebdd', '#e0301e'], ['#12123a', '#3fe0d0'],
]

const swapped = (svg, [ground, ink]) => svg.replaceAll(ground, '#TMP').replaceAll(ink, ground).replaceAll('#TMP', ink)

const detail = (svg, x, y, scale, turn = 0) => svg
	.replace(/(<rect width="\d+" height="\d+" fill="[^"]+"\/>)/, `$1<g transform="translate(${W * x} ${H * y}) scale(${scale}) rotate(${turn}) translate(${-W * x} ${-H * y})">`)
	.replace('</svg>', '</g></svg>')

const series = (svg, pair) => [
	detail(svg, 0.4, 0.42, 1.9),
	swapped(svg, pair),
	detail(swapped(svg, pair), 0.56, 0.52, 1.45, -18),
]

for (const [i, svg] of posters.entries()) {
	const number = String(i + 1).padStart(2, '0')

	await sharp(Buffer.from(svg)).webp({ quality: 92 }).toFile(join(out, `${number}.webp`))
	console.log(`  ${number}.webp`)

	for (const [j, sheet] of series(svg, inks[i]).entries()) {
		const name = `${number}-${j + 1}.webp`

		await sharp(Buffer.from(sheet)).resize(900).webp({ quality: 90 }).toFile(join(out, name))
		console.log(`  ${name}`)
	}
}
