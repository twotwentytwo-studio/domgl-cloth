import type { DomGl, Post } from '@lama/domgl'
import { RIG, TURNED, facing, stand, toRoom } from '../shaders/rig'
import { camera, light } from '../shaders/stage'
import { Cloth, fit, gauge, rehearse, type Brush, type Column } from './sim'

const NX = 25
const NY = 33

const CELLS = (NX - 1) * (NY - 1)
const SUB = 3

const shader = `
	struct Globals {
		size: vec2f,
		canvas: vec2f,
		origin: vec2f,
		dpr: f32,
		pad: f32,
	}

	struct Sheet {
		map: vec4f,
		alpha: f32,
		page: f32,
		printed: f32,
		wash: f32,
		pin: vec4f,
		room: vec4f,
		m0: vec4f,
		m1: vec4f,
		m2: vec4f,
	}

	@group(0) @binding(0) var<uniform> g: Globals;
	@group(0) @binding(1) var samp: sampler;
	@group(1) @binding(0) var<uniform> sheet: Sheet;
	@group(1) @binding(1) var tex: texture_2d<f32>;
	@group(1) @binding(2) var<storage, read> particles: array<vec4f>;

	${camera}
	${light}

	fn turned(w: vec3f) -> vec3f {
		return vec3f(dot(sheet.m0.xyz, w), dot(sheet.m1.xyz, w), dot(sheet.m2.xyz, w));
	}

	fn placed(at: vec3f) -> vec3f {
		return sheet.room.xyz + turned(at - sheet.pin.xyz);
	}

	const NX = ${NX};
	const NY = ${NY};
	const SUB = ${SUB}u;

	fn control(i: i32, j: i32) -> vec3f {
		let ci = clamp(i, 0, NX - 1);
		let cj = clamp(j, 0, NY - 1);
		let at = particles[cj * NX + ci].xyz;

		if (ci == i && cj == j) { return at; }

		let mi = clamp(2 * ci - i, 0, NX - 1);
		let mj = clamp(2 * cj - j, 0, NY - 1);

		return 2.0 * at - particles[mj * NX + mi].xyz;
	}

	fn weights(t: f32) -> vec4f {
		let s = 1.0 - t;
		return vec4f(s * s * s, 3.0 * t * t * t - 6.0 * t * t + 4.0, -3.0 * t * t * t + 3.0 * t * t + 3.0 * t + 1.0, t * t * t) / 6.0;
	}

	fn slopes(t: f32) -> vec4f {
		let s = 1.0 - t;
		return vec4f(-s * s, 3.0 * t * t - 4.0 * t, -3.0 * t * t + 2.0 * t + 1.0, t * t) * 0.5;
	}

	struct VOut {
		@builtin(position) pos: vec4f,
		@location(0) uv: vec2f,
		@location(1) normal: vec3f,
		@location(2) room: vec3f,
		@location(3) runAcross: vec3f,
	}

	struct Spot {
		at: vec3f,
		across: vec3f,
		down: vec3f,
		uv: vec2f,
	}

	fn spot(index: u32, cell: u32) -> Spot {
		let quad = index / 6u;
		let k = index % 6u;

		var corner = vec2f(0.0);
		if (k == 1u || k == 4u) { corner = vec2f(1.0, 0.0); }
		else if (k == 2u || k == 3u) { corner = vec2f(0.0, 1.0); }
		else if (k == 5u) { corner = vec2f(1.0, 1.0); }

		let t = (vec2f(f32(quad % SUB), f32(quad / SUB)) + corner) / f32(SUB);

		let ci = i32(cell) % (NX - 1);
		let cj = i32(cell) / (NX - 1);

		let wu = weights(t.x);
		let wv = weights(t.y);
		let du = slopes(t.x);
		let dv = slopes(t.y);

		var sp: Spot;
		sp.at = vec3f(0.0);
		sp.across = vec3f(0.0);
		sp.down = vec3f(0.0);

		for (var b = 0; b < 4; b = b + 1) {
			var row = vec3f(0.0);
			var rowAcross = vec3f(0.0);

			for (var a = 0; a < 4; a = a + 1) {
				let c = control(ci + a - 1, cj + b - 1);

				row = row + c * wu[a];
				rowAcross = rowAcross + c * du[a];
			}

			sp.at = sp.at + row * wv[b];
			sp.across = sp.across + rowAcross * wv[b];
			sp.down = sp.down + row * dv[b];
		}

		sp.uv = (vec2f(f32(ci), f32(cj)) + t) / vec2f(f32(NX - 1), f32(NY - 1));
		return sp;
	}

	fn onScreen(px: vec2f) -> vec4f {
		return vec4f((px - g.origin) / g.canvas * vec2f(2.0, -2.0) + vec2f(-1.0, 1.0), 0.0, 1.0);
	}

	@vertex fn vs(@builtin(vertex_index) index: u32, @location(0) cell: u32) -> VOut {
		let sp = spot(index, cell);

		let room = placed(sp.at);
		let d = FOCAL * g.size.y;
		let px = g.size * 0.5 + room.xy * (d / (d - room.z));

		var o: VOut;
		o.pos = onScreen(px);

		o.pos.z = (sheet.m0.w + clamp((room.z + 4000.0) / 5400.0, 0.0, 0.999)) / 64.0;
		o.uv = sp.uv;
		o.normal = turned(cross(sp.across, sp.down));
		o.room = room;
		o.runAcross = turned(sp.across);
		return o;
	}

	const THROW = vec2f(0.022, 0.036);

	@vertex fn vsShade(@builtin(vertex_index) index: u32, @location(0) cell: u32) -> @builtin(position) vec4f {
		let room = placed(spot(index, cell).at);
		let d = FOCAL * g.size.y;
		let near = d / (d - room.z);

		return onScreen(g.size * 0.5 + room.xy * near + THROW * sheet.pin.w * near);
	}

	@fragment fn fsShade() -> @location(0) vec4f {
		return vec4f(sheet.alpha * (1.0 - sheet.wash));
	}

	const WRAP = 0.45;

	const THREAD = 2.4;
	const WEAVE = 0.16;
	const SHEEN = 0.3;

	const GROUND = vec3f(0.851);

	const STOCK = vec3f(0.965, 0.957, 0.937);

	fn clothLight(n: vec3f, rest: vec3f) -> f32 {
		let l = normalize(LIGHT);
		let facing = clamp((dot(n, l) + WRAP) / (1.0 + WRAP), 0.0, 1.0);
		let lying = (dot(rest, l) + WRAP) / (1.0 + WRAP);

		return FILL + (1.0 - FILL) * facing / lying;
	}

	@fragment fn fs(in: VOut) -> @location(0) vec4f {
		let w = max(fwidth(in.uv), vec2f(1e-6));
		let e = min(in.uv, 1.0 - in.uv) / w;
		let edge = clamp(min(e.x, e.y), 0.0, 1.0);

		let taken = textureSample(tex, samp, in.uv * sheet.map.xy + sheet.map.zw);

		let inked = STOCK * (1.0 - taken.a * sheet.printed) + taken.rgb * sheet.printed;
		let print = select(taken, vec4f(inked, 1.0), sheet.page > 0.5);

		let eye = vec3f(0.0, 0.0, FOCAL * g.size.y) - in.room;
		let n0 = normalize(in.normal);
		let back = dot(n0, eye) < 0.0;
		let n = n0 * select(1.0, -1.0, back);

		var rgb = mix(print.rgb, vec3f(dot(print.rgb, vec3f(0.333))), select(0.0, 0.45, back));

		let threads = in.uv * vec2f(sheet.pin.w, sheet.room.w) / THREAD;
		let fine = max(fwidth(threads).x, fwidth(threads).y);

		let grain = (1.0 - smoothstep(0.22, 0.5, fine)) * select(1.0, 0.0, sheet.page > 0.5);

		let across = normalize(in.runAcross - n0 * dot(in.runAcross, n0));
		let down = normalize(cross(n0, across));

		let wave = threads * 6.2831853;
		let tilt = vec2f(sin(wave.x) * (0.5 + 0.5 * cos(wave.y)), sin(wave.y) * (0.5 + 0.5 * cos(wave.x)));
		let woven = normalize(n + (across * tilt.x + down * tilt.y) * WEAVE * grain);

		let gap = (0.5 - 0.5 * cos(wave.x)) * (0.5 - 0.5 * cos(wave.y));
		rgb = rgb * (1.0 - 0.07 * grain * gap);

		let rest = turned(vec3f(0.0, 0.0, 1.0));
		rgb = lit(rgb, clothLight(woven, rest), 0.14);

		let toEye = normalize(eye);
		let glance = pow(1.0 - abs(dot(n, toEye)), 2.5) - pow(1.0 - abs(dot(rest, toEye)), 2.5);
		rgb = rgb + (vec3f(1.0) - rgb) * max(glance, 0.0) * SHEEN * select(1.0, 0.4, back);

		rgb = mix(rgb, GROUND, sheet.wash);

		let a = edge * sheet.alpha * print.a;
		return vec4f(rgb * a, a);
	}
`

const FRINGE = { from: 0.66, blur: 0.016, split: 0.022, taps: 20 }

const fringe = `
	@group(0) @binding(0) var samp: sampler;
	@group(0) @binding(1) var frame: texture_2d<f32>;

	const GROUND = vec3f(0.851);

	struct VOut {
		@builtin(position) pos: vec4f,
		@location(0) uv: vec2f,
	}

	@vertex fn vs(@builtin(vertex_index) i: u32) -> VOut {
		let uv = vec2f(f32((i << 1u) & 2u), f32(i & 2u));

		var o: VOut;
		o.pos = vec4f(uv * vec2f(2.0, -2.0) + vec2f(-1.0, 1.0), 0.0, 1.0);
		o.uv = uv;
		return o;
	}

	@fragment fn fs(in: VOut) -> @location(0) vec4f {
		let plain = textureSampleLevel(frame, samp, in.uv, 0.0);

		let q = in.uv - 0.5;
		let k = smoothstep(${FRINGE.from}, 1.0, abs(q.y) * 2.0);

		if (k <= 0.0) { return plain; }

		let size = vec2f(textureDimensions(frame));

		let out = normalize(q * size);
		let px = size.y / size;

		let split = out * (k * ${FRINGE.split}) * px;
		let blur = (k * ${FRINGE.blur}) * px;

		var colour = vec3f(0.0);
		var cover = vec3f(0.0);
		var weight = vec3f(0.0);

		for (var i = 0; i < ${FRINGE.taps}; i++) {
			let n = f32(i) + 0.5;

			let turn = n * 2.39996;
			let disc = vec2f(cos(turn), sin(turn)) * sqrt(n / ${FRINGE.taps}.0);
			let hue = fract(n * 0.61803) * 2.0 - 1.0;

			let tap = textureSampleLevel(frame, samp, in.uv + split * hue + disc * blur, 0.0);

			let w = max(vec3f(0.0), 1.0 - abs(vec3f(hue - 0.7, hue, hue + 0.7)) / 0.85);

			colour += tap.rgb * w;
			cover += tap.a * w;
			weight += w;
		}

		colour /= weight;
		cover /= weight;

		return vec4f(colour + GROUND * (1.0 - cover), 1.0);
	}
`

const flat = `
	@group(0) @binding(0) var samp: sampler;
	@group(0) @binding(1) var frame: texture_2d<f32>;

	struct VOut {
		@builtin(position) pos: vec4f,
		@location(0) uv: vec2f,
	}

	@vertex fn vs(@builtin(vertex_index) i: u32) -> VOut {
		let uv = vec2f(f32((i << 1u) & 2u), f32(i & 2u));

		var o: VOut;
		o.pos = vec4f(uv * vec2f(2.0, -2.0) + vec2f(-1.0, 1.0), 0.0, 1.0);
		o.uv = uv;
		return o;
	}

	@fragment fn fs(in: VOut) -> @location(0) vec4f {
		return textureSample(frame, samp, in.uv);
	}
`

const soft = `
	struct Soft {
		step: vec2f,
		depth: f32,
		pad: f32,
	}

	@group(0) @binding(0) var samp: sampler;
	@group(0) @binding(1) var shade: texture_2d<f32>;
	@group(0) @binding(2) var<uniform> soft: Soft;

	struct VOut {
		@builtin(position) pos: vec4f,
		@location(0) uv: vec2f,
	}

	@vertex fn vs(@builtin(vertex_index) i: u32) -> VOut {
		let uv = vec2f(f32((i << 1u) & 2u), f32(i & 2u));

		var o: VOut;
		o.pos = vec4f(uv * vec2f(2.0, -2.0) + vec2f(-1.0, 1.0), 0.0, 1.0);
		o.uv = uv;
		return o;
	}

	@fragment fn fsBlur(in: VOut) -> @location(0) vec4f {
		var sum = textureSample(shade, samp, in.uv) * 0.2270270;

		sum = sum + (textureSample(shade, samp, in.uv + soft.step * 1.3846154) + textureSample(shade, samp, in.uv - soft.step * 1.3846154)) * 0.3162162;
		sum = sum + (textureSample(shade, samp, in.uv + soft.step * 3.2307692) + textureSample(shade, samp, in.uv - soft.step * 3.2307692)) * 0.0702703;

		return sum;
	}

	@fragment fn fsLay(in: VOut) -> @location(0) vec4f {
		return vec4f(0.0, 0.0, 0.0, textureSample(shade, samp, in.uv).r * soft.depth);
	}
`

type Hung = {
	cloth: Cloth
	data: Float32Array<ArrayBuffer>
	points: GPUBuffer | null
	order: Uint32Array<ArrayBuffer>
	cells: GPUBuffer | null
	sorted: boolean
	told: Float32Array<ArrayBuffer>
	uniform: GPUBuffer | null
	group: GPUBindGroup | null
	shade: GPUBindGroup | null
	texture: number
	src: string
	canvas: HTMLCanvasElement | null
	own: { texture: GPUTexture; view: GPUTextureView } | null
	fresh: boolean
	shown: boolean
	along: number
	room: [number, number, number]
	face: number[]
	alpha: number
	rest: [number, number, number]
	wash: number
	born: number
}

const FILL = 0.84

const GAP = 20

const SHORT = 0.5

const SMALL = 0.6

const SWING = 0.7

export const PAPER = -1

const LEAF = { shape: 0.92, slim: 0.44, roll: 0.2, aside: 0.3, grip: 0.24, crown: 3.5, trail: 0.07 }

export const COVER = -2

const VEIL = { over: 1.08, roll: -0.3, off: 1.25, grip: 0.2, crown: 4, trail: 0.12 }

const REACH = 0.2
const SWIPE = 2600

const SHEET = '#f6f4ef'

function blank() {
	const canvas = document.createElement('canvas')
	canvas.width = canvas.height = 4

	const ctx = canvas.getContext('2d')!
	ctx.fillStyle = SHEET
	ctx.fillRect(0, 0, 4, 4)

	return canvas
}

const INTRO = { wait: 0.15, step: 0, fade: 0.8, roll: false }

const SHADOW = { scale: 4, spreads: [1, 2, 3.5], depth: 0.15 }

const DETAIL = -1

const DIM = 0.14

const HAUL = 0.6

const TUG = { share: 0.25, most: 5, reach: 0.5 }

const LOOSE = -1

const TRAIL = { by: 0.14, steps: 8 }

const HOME = { land: 0.025, from: 0.7, full: 0.35 }

const AWAY = { lead: 0.07, until: 0.3, after: 0.5 }

let STOOD = facing(TURNED, RIG.roll)

let rolled = RIG.roll

const HAND = { inset: 0.1 }

const NAIL = { least: 0.08, most: 0.16, turn: 2.39996 }

const nail = (key: number, w: number, h: number): [number, number] => {
	const roll = Math.sin(key * 78.233 + 1.7) * 43758.5453
	const far = NAIL.least + (NAIL.most - NAIL.least) * (roll - Math.floor(roll))
	const turn = key * NAIL.turn

	return [w * (0.5 + Math.cos(turn) * far), h * (0.5 + Math.sin(turn) * far)]
}

const ease = (from: number, to: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - from) / (to - from)))

	return t * t * (3 - 2 * t)
}

export class ClothLayer {
	private gl: DomGl
	private hung = new Map<number, Hung>()

	private pipeline: GPURenderPipeline | null = null

	private deep: GPURenderPipeline | null = null
	private depth: { size: [number, number]; texture: GPUTexture; view: GPUTextureView } | null = null
	private globals: GPUBuffer | null = null
	private globalsGroup: GPUBindGroup | null = null

	private level: GPUBuffer | null = null

	private depths = new Float32Array(CELLS)

	private changed = true
	private time = 0

	private began = 0
	private fitted = false

	opened: number | null = null
	lift = 0

	private lifted = 0
	private liftedBefore = 0

	private lifts: number[] = []

	private comes: number[] = []

	private parting = false

	come = 0
	private came = 0

	private hand: { x: number; y: number } | null = null
	private handWas: { x: number; y: number } | null = null

	private detail: Hung | null = null

	private drawn = 0

	clear = { top: 0, bottom: 0 }

	private post: Post
	private printing = false
	private busyUntil = 0

	private ahead = false

	private falling = false

	private pressed = false
	private taken: number | null = null

	private solo = false

	private at: { u: number; v: number } | null = null

	private inked = 1

	private kept: { texture: GPUTexture; view: GPUTextureView } | null = null
	private keeping: (() => void) | null = null

	get ink() {
		return this.inked
	}

	set ink(to: number) {
		this.inked = to
		this.changed = true
	}

	private flat: GPURenderPipeline | null = null
	private flatGroup: GPUBindGroup | null = null
	private flatView: GPUTextureView | null = null

	private glass: GPURenderPipeline | null = null
	private glassGroup: GPUBindGroup | null = null
	private rested: { size: [number, number]; texture: GPUTexture; view: GPUTextureView; group: GPUBindGroup } | null = null
	private down = false
	private again = 0
	private sampler: GPUSampler | null = null

	private shader: GPURenderPipeline | null = null
	private shadeSheet: GPUBindGroupLayout | null = null
	private blur: GPURenderPipeline | null = null
	private lay: GPURenderPipeline | null = null
	private dusk: { size: [number, number]; a: GPUTexture; b: GPUTexture; passes: { across: GPUBindGroup; down: GPUBindGroup }[]; laid: GPUBindGroup; steps: GPUBuffer[] } | null = null
	private shaded = false

	private frameView: GPUTextureView | null = null
	private frameCount = -2

	behind = false

	constructor(gl: DomGl) {
		this.gl = gl

		gl.core.add(this.under, { order: 9, dirty: () => this.changed, reset: () => this.reset() })
		gl.core.add(this.over, { order: 14, dirty: () => this.changed })

		this.post = { active: false, composite: this.composite, reset: () => this.reset() }
		gl.core.post = this.post

		gl.core.addPre(this.cast)
	}

	destroy() {
		this.gl.core.remove(this.under)
		this.gl.core.remove(this.over)
		if (this.gl.core.post === this.post) this.gl.core.post = null
		this.gl.core.removePre(this.cast)
		this.reset()
		this.hung.clear()
	}

	private reset() {
		for (const h of this.all()) this.drop(h)

		this.globals?.destroy()
		this.level?.destroy()

		this.unlit()

		this.depth?.texture.destroy()
		this.depth = null

		this.rested?.texture.destroy()
		this.rested = null

		this.pipeline = this.deep = this.flat = this.glass = this.shader = this.blur = this.lay = null
		this.shadeSheet = null
		this.globals = this.level = null
		this.globalsGroup = this.flatGroup = this.glassGroup = null
		this.flatView = this.frameView = null
		this.sampler = null
		this.kept = null
		this.changed = true
	}

	private all() {
		return this.detail ? [...this.hung.values(), this.detail] : [...this.hung.values()]
	}

	private drop(h: Hung) {
		h.points?.destroy()
		h.cells?.destroy()
		h.uniform?.destroy()
		h.own?.texture.destroy()
		h.points = h.cells = h.uniform = null
		h.own = null
		h.group = h.shade = null
		h.texture = -1
	}

	rehearse(ms: number) {
		if (!rehearse(ms, NX, NY)) return false

		if (!this.fitted) {
			this.fitted = true

			let count = 0
			for (const h of this.hung.values()) if (h.shown) count++

			fit(count)
		}

		return true
	}

	pictures() {
		return [...new Set([...this.hung.values()].map((h) => h.src).filter(Boolean))]
	}

	open(key: number) {
		this.opened = key

		this.solo = key >= 0 && this.gl.core.height > this.gl.core.width

		const cloth = this.hung.get(key)?.cloth

		if (!this.solo && key === this.taken && this.at) cloth?.hold(this.at.u, this.at.v)
		else cloth?.hold()

		this.lifts.length = 0
		this.comes.length = 0
		this.parting = false

		this.printing = false
		this.unkeep()

		if (this.detail) this.drop(this.detail)
		this.detail = null
		this.changed = true
	}

	shut() {
		this.opened = null
		this.solo = false
		this.behind = false
		this.ahead = false
		this.printing = false
		this.unkeep()

		if (this.detail) this.drop(this.detail)
		this.detail = null
		this.changed = true
	}

	reach(key: number) {
		const h = this.hung.get(key)
		if (!h || this.solo) return 0

		const to = this.slots(h.cloth.w, h.cloth.h, this.gl.core.width, this.gl.core.height).cloth

		return Math.hypot(to[0] - h.rest[0], to[1] - h.rest[1], to[2] - h.rest[2]) / h.cloth.w
	}

	box() {
		const ww = this.gl.core.width
		const wh = this.gl.core.height

		const laid = this.laid(ww, wh)
		if (!laid) return null

		const { w, h, sheet } = laid
		const grow = (RIG.focal * wh) / (RIG.focal * wh - sheet[2])

		return {
			left: ww / 2 + (sheet[0] - w / 2) * grow,
			top: wh / 2 + (sheet[1] - h / 2) * grow,
			width: w * grow,
			height: h * grow,
		}
	}

	scrolled(dy: number) {
		this.drawn += dy
	}

	private liftAt(time: number) {
		return this.past(this.lifts, time, this.lifted)
	}

	private past(l: number[], time: number, now: number) {
		for (let i = l.length - 2; i >= 0; i -= 2) {
			if (l[i]! > time) continue
			if (i + 2 >= l.length) return l[i + 1]!

			const t = (time - l[i]!) / (l[i + 2]! - l[i]! || 1)

			return l[i + 1]! + (l[i + 3]! - l[i + 1]!) * t
		}

		return l.length ? l[1]! : now
	}

	private pose(mine: number, home: [number, number, number], to: [number, number, number], offX: number, offY: number) {
		const face = facing(TURNED * (1 - mine), RIG.roll * (1 - mine))
		const room: [number, number, number] = [home[0], home[1], home[2]]

		if (mine) {
			for (let i = 0; i < 3; i++) {
				const stood = home[i]! + STOOD[i * 3]! * offX + STOOD[i * 3 + 1]! * offY
				const landed = to[i]! + (i === 0 ? offX : i === 1 ? offY : 0)

				room[i] = stood + (landed - stood) * mine - (face[i * 3]! * offX + face[i * 3 + 1]! * offY)
			}
		}

		return { room, face }
	}

	point(sx?: number, sy?: number) {
		this.hand = sx === undefined || sy === undefined ? null : { x: sx, y: sy }
	}

	private onto(h: Hung, sx: number, sy: number, ww: number, wh: number) {
		const d = RIG.focal * wh
		const dx = sx - ww / 2
		const dy = sy - wh / 2
		const m = h.face

		const across = m[2]! * dx + m[5]! * dy - m[8]! * d
		if (Math.abs(across) < 1e-6) return null

		const t = (m[2]! * h.room[0] + m[5]! * h.room[1] + m[8]! * (h.room[2] - d)) / across
		if (t <= 0) return null

		const hx = dx * t - h.room[0]
		const hy = dy * t - h.room[1]
		const hz = d - d * t - h.room[2]

		return { x: m[0]! * hx + m[3]! * hy + m[6]! * hz, y: m[1]! * hx + m[4]! * hy + m[7]! * hz }
	}

	private brush(h: Hung, front: boolean, dt: number, ww: number, wh: number): Brush | null {
		const now = this.hand
		const was = this.handWas

		if (!now || !was || (now.x === was.x && now.y === was.y)) return null
		const leaving = this.falling && this.opened !== COVER

		if (this.opened !== null && (front ? this.lift < 0.98 && !(leaving && this.lift < HOME.land) : !leaving)) return null

		const a = this.onto(h, was.x, was.y, ww, wh)
		const b = this.onto(h, now.x, now.y, ww, wh)
		if (!a || !b) return null

		const reach = REACH * h.cloth.w

		if (Math.abs(b.x) > h.cloth.w / 2 + reach || Math.abs(b.y) > h.cloth.h / 2 + reach) return null

		let vx = (b.x - a.x) / dt
		let vy = (b.y - a.y) / dt
		const fast = Math.hypot(vx, vy)

		if (fast > SWIPE) {
			vx *= SWIPE / fast
			vy *= SWIPE / fast
		}

		return { x: b.x + h.cloth.w / 2, y: b.y + h.cloth.h / 2, vx, vy, reach }
	}

	private quad(h: Hung, ww: number, wh: number, home = false) {
		const m = home ? STOOD : h.face
		const pin = home ? h.rest : h.room
		const eye = RIG.focal * wh

		const at: number[] = []
		let floor = Infinity

		for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
			const x = (u * h.cloth.w) / 2
			const y = (v * h.cloth.h) / 2

			const z = pin[2] + m[6]! * x + m[7]! * y
			const near = eye / (eye - z)

			at.push((pin[0] + m[0]! * x + m[1]! * y) * near, (pin[1] + m[3]! * x + m[4]! * y) * near)
			floor = Math.min(floor, z)
		}

		return { at, floor }
	}

	private column(landing: { at: number[]; floor: number }, h: Hung, room: [number, number, number], face: number[], strength: number, ww: number, wh: number): Column | null {
		if (strength <= 0) return null

		const q = landing.at
		const own = this.quad(h, ww, wh).at

		const spare = h.cloth.w * 0.25

		const box = (p: number[], i: number) => [Math.min(p[i]!, p[i + 2]!, p[i + 4]!, p[i + 6]!), Math.max(p[i]!, p[i + 2]!, p[i + 4]!, p[i + 6]!)] as const

		const [l0, r0] = box(q, 0)
		const [t0, b0] = box(q, 1)
		const [l1, r1] = box(own, 0)
		const [t1, b1] = box(own, 1)

		if (l1 > r0 + spare || r1 < l0 - spare || t1 > b0 + spare || b1 < t0 - spare) return null

		const midX = (q[0]! + q[2]! + q[4]! + q[6]!) / 4
		const midY = (q[1]! + q[3]! + q[5]! + q[7]!) / 4

		const sides: number[] = []

		for (let e = 0; e < 4; e++) {
			const ax = q[e * 2]!
			const ay = q[e * 2 + 1]!
			const bx = q[((e + 1) % 4) * 2]!
			const by = q[((e + 1) % 4) * 2 + 1]!

			let nx = by - ay
			let ny = ax - bx
			const len = Math.hypot(nx, ny) || 1

			nx /= len
			ny /= len

			if ((midX - ax) * nx + (midY - ay) * ny > 0) {
				nx = -nx
				ny = -ny
			}

			sides.push(ax, ay, nx, ny)
		}

		return { pin: room, face, eye: RIG.focal * wh, sides, floor: landing.floor, strength }
	}

	private laid(ww: number, wh: number) {
		if (this.opened === null) return null

		if (this.opened !== PAPER && this.opened !== COVER && !this.solo) {
			const beside = this.hung.get(this.opened)
			if (!beside) return null

			const { w, h } = beside.cloth
			const { sheet, from, sheetH } = this.slots(w, h, ww, wh)

			return { w, h: sheetH, sheet, from, alone: null }
		}

		const any = this.hung.values().next().value
		if (!any) return null

		const h = any.cloth.h

		if (this.opened === COVER) {
			const w = Math.round((h * ww) / wh)

			const grow = (VEIL.over * wh) / h
			const near = RIG.focal * wh * (1 - 1 / grow)

			const sheet: [number, number, number] = [0, 0, near]
			const from: [number, number, number] = [w * VEIL.off, -h * VEIL.off, near]

			return {
				w, h, sheet, from,
				alone: {
					roll: VEIL.roll,
					crown: VEIL.crown,
					trail: VEIL.trail,
					comes: null as [number, number] | null,
					goes: [w * (1 - VEIL.grip), h * VEIL.grip] as [number, number],
				},
			}
		}

		const { band, mid } = this.room(wh)

		const w = Math.round(h * Math.min(LEAF.shape, Math.max(LEAF.slim, (FILL * ww) / band)))

		const grow = Math.max(1, Math.min(band / h, (FILL * ww) / w))
		const near = RIG.focal * wh * (1 - 1 / grow)

		const sheet: [number, number, number] = [0, mid / grow, near]

		const from: [number, number, number] = [w * LEAF.aside, wh / grow / 2 + Math.hypot(w, h) * 0.55, near]

		return {
			w, h, sheet, from,
			alone: {
				roll: LEAF.roll,
				crown: LEAF.crown,
				trail: LEAF.trail,
				comes: [w * LEAF.grip, h * LEAF.grip] as [number, number] | null,
				goes: [w * (1 - LEAF.grip), h * (1 - LEAF.grip)] as [number, number],
			},
		}
	}

	private slots(w: number, h: number, ww: number, wh: number) {
		const tall = wh > ww

		const { band, mid } = this.room(wh)

		let grow: number
		let sheetH = h

		if (tall) {
			grow = Math.max(SMALL, Math.min((FILL * ww) / w, band / (h * (1 + SHORT) + GAP)))
			sheetH = Math.round(Math.min(h, Math.max(h * SHORT, band / grow - GAP - h)))
		} else {
			grow = Math.max(1, Math.min(band / h, (FILL * ww) / (w * 2 + GAP)))
		}

		const near = RIG.focal * wh * (1 - 1 / grow)

		const at = mid / grow

		const top = at - (h + GAP + sheetH) / 2
		const step = (w + GAP) / 2

		const cloth: [number, number, number] = tall ? [0, top + h / 2, near] : [-step, at, near]
		const sheet: [number, number, number] = tall ? [0, top + h + GAP + sheetH / 2, near] : [step, at, near]
		const from: [number, number, number] = [sheet[0] + (ww / grow) * 0.9, sheet[1], near]

		return { cloth, sheet, from, sheetH }
	}

	private room(wh: number) {
		const spare = ((1 - FILL) / 2) * wh

		const top = this.clear.top || spare
		const bottom = this.clear.bottom || spare

		const band = Math.max(1, wh - top - bottom)

		return { band, mid: top + band / 2 - wh / 2 }
	}

	frame(track: HTMLElement, ratio: number) {
		const ww = this.gl.core.width
		const wh = this.gl.core.height
		if (!ww || !wh) return

		stand(ww, wh)

		if (rolled !== RIG.roll) {
			rolled = RIG.roll
			STOOD = facing(TURNED, rolled)
		}

		const dt = Math.min(ratio, 3) / 60
		this.time += dt

		const lift = this.opened === null ? 0 : this.lift

		const come = this.opened === null ? 0 : this.come

		const flying = lift !== this.lifted || come !== this.came

		if (flying) this.changed = true
		this.lifted = lift
		this.came = come

		if (this.opened === null) this.lifts.length = 0
		else {
			this.lifts.push(this.time, lift)

			while (this.lifts.length > 4 && this.lifts[2]! < this.time - TRAIL.by) this.lifts.splice(0, 2)
		}

		if (lift < this.liftedBefore) this.falling = true
		else if (lift > this.liftedBefore) this.falling = false

		this.liftedBefore = lift

		if (this.behind && this.falling) this.behind = false

		const moving = lift > 0 && lift < (this.falling ? HOME.from : AWAY.until) ? this.lifting() : null
		const room4 = moving ? this.quad(moving, ww, wh, this.falling) : null

		const clearing = this.falling
			? lift < HOME.land ? lift / HOME.land : ease(HOME.from, HOME.full, lift)
			: lift < AWAY.lead ? 1 : AWAY.after * (1 - ease(AWAY.lead, AWAY.until, lift))

		let carried = false

		const flown = this.solo ? null : this.opened

		const from = performance.now()

		for (const plane of this.gl.planes.under(track)) {
			const slide = (plane.el as HTMLElement).closest<HTMLElement & { _vrect?: DOMRect | null }>('[data-slide]')
			if (!slide || !('src' in plane)) continue

			const key = Number(slide.dataset.slide)
			const r = slide._vrect ?? slide.getBoundingClientRect()
			if (!r.width) continue

			const cx = r.left + r.width / 2 - ww / 2
			const cy = r.top + r.height / 2 - wh / 2

			let h = this.hung.get(key)

			if (!h || Math.abs(h.cloth.w - r.width) > 0.5) {
				const first = !h

				h = this.hang(r.width, r.height, plane.src, h)
				h.cloth.nail(...nail(key, r.width, r.height))
				h.along = cx
				h.room = toRoom(cx, cy, 0)
				this.hung.set(key, h)

				const now = performance.now()
				this.began ||= now

				if (first && now - this.began < 400 && this.inSight(cx, cy, r.width, ww, wh)) {
					h.born = this.began + (INTRO.wait + (Math.abs(cx) / r.width) * INTRO.step) * 1000
					if (INTRO.roll) h.cloth.bunch(key)
				}
			}

			h.src = plane.src

			const cloth = h.cloth
			const jump = Math.abs(cx - h.along)

			h.along = cx

			const mine = key === flown ? lift : 0
			const home = toRoom(cx, cy, 0)
			const to = this.slots(r.width, r.height, ww, wh).cloth

			const offX = cloth.heldX
			const offY = cloth.heldY

			const { room, face } = this.pose(mine, home, to, offX, offY)

			if (key === flown) {
				const rooms: number[][] = [room]
				const faces: number[][] = [face]

				let apart = false

				for (let b = 1; b <= TRAIL.steps; b++) {
					const then = this.liftAt(this.time - (TRAIL.by * b) / TRAIL.steps)
					const was = this.pose(then, home, to, offX, offY)

					if (then !== mine) apart = true

					rooms.push(was.room)
					faces.push(was.face)
				}

				if (apart) cloth.trail(rooms, faces)
				else cloth.lag = null
			} else if (cloth.lag) cloth.lag = null

			if (key === flown) this.ahead = mine > (this.falling ? HOME.land : AWAY.lead)

			const age = h.born ? (performance.now() - h.born) / 1000 : Infinity
			const arriving = age < INTRO.fade
			const shownIn = age <= 0 ? 0 : arriving ? 1 - Math.pow(1 - age / INTRO.fade, 2) : 1

			const alpha = shownIn
			const wash = this.opened === null || key === flown ? 0 : (1 - DIM) * lift

			if (arriving) this.changed = true

			const was = h.face

			const mx = room[0] - h.room[0] + (face[0]! - was[0]!) * offX + (face[1]! - was[1]!) * offY
			const my = room[1] - h.room[1] + (face[3]! - was[3]!) * offX + (face[4]! - was[4]!) * offY
			const mz = room[2] - h.room[2] + (face[6]! - was[6]!) * offX + (face[7]! - was[7]!) * offY

			const feel = key === flown ? HAUL : 1

			const sx = (face[0]! * mx + face[3]! * my + face[6]! * mz) * feel
			const sy = (face[1]! * mx + face[4]! * my + face[7]! * mz) * feel
			const sz = (face[2]! * mx + face[5]! * my + face[8]! * mz) * feel

			if (mx || my || mz || alpha !== h.alpha || wash !== h.wash) this.changed = true
			if (mx || my || mz) carried = true

			h.rest = home
			h.room = room
			h.face = face
			h.alpha = alpha
			h.wash = wash

			if (age <= 0) {
				h.shown = true
				continue
			}

			if (h.born && !cloth.awake && age < INTRO.fade) cloth.wake()

			const shown = mine > 0 || this.inSight(cx, cy, r.width, ww, wh)

			if (shown !== h.shown) this.changed = true
			h.shown = shown

			if (!cloth.nailed && !cloth.awake && key !== flown && !(this.pressed && key === this.taken)) cloth.hold()

			const brush = this.brush(h, key === flown, dt, ww, wh)

			const column = moving && room4 && moving !== h && shown && home[2] > moving.rest[2]
				? this.column(room4, h, room, face, clearing, ww, wh)
				: null

			if (!shown || jump > ww || (!cloth.awake && !sx && !sy && !sz && !brush && !column && !cloth.lag)) {
				if (cloth.awake || cloth.x !== -cloth.w / 2 || cloth.z) {
					cloth.place(-cloth.w / 2, -cloth.h / 2, 0)
					h.fresh = true
					if (shown) this.changed = true
				}

				continue
			}

			if (cloth.step(dt, cloth.x + sx, cloth.y + sy, cloth.z + sz, this.time, brush, column)) {
				h.fresh = true
				this.changed = true
			}
		}

		this.sheet(dt, come, ww, wh)

		gauge(performance.now() - from)

		this.handWas = this.hand && { ...this.hand }

		let stirring = false

		for (const h of this.hung.values()) {
			if (h.shown && h.cloth.awake) {
				stirring = true
				break
			}
		}

		const afresh = this.again > 0

		if (afresh) this.again--

		const live = stirring || carried || afresh || (this.opened !== null && (
			flying
			|| !!this.detail?.cloth.awake
			|| performance.now() < this.busyUntil
			|| !!this.kept
			|| !!this.keeping
		))

		if (live !== this.post.active) {
			if (!live) this.down = true

			this.post.active = live
			this.changed = true
		}

		for (const h of this.hung.values()) {
			if (h.shown && h.texture !== (this.gl.textures.peek(h.src)?.id ?? -1)) this.changed = true
		}
	}

	private pull(h: Hung, tug: number, dt: number, ww: number, wh: number): Brush | null {
		if (!tug) return null

		const { w, h: tall } = h.cloth

		const at = this.hand && this.onto(h, this.hand.x, this.hand.y, ww, wh)
		const on = !!at && Math.abs(at.x) <= w / 2 && Math.abs(at.y) <= tall / 2

		return { x: on ? at!.x + w / 2 : w / 2, y: on ? at!.y + tall / 2 : tall / 2, vx: 0, vy: tug / dt, reach: w * TUG.reach }
	}

	private sheet(dt: number, come: number, ww: number, wh: number) {
		const laid = this.laid(ww, wh)

		if (!laid) return

		const { w, h: tall, sheet, from } = laid

		let h = this.detail
		let fresh = false

		if (!h || h.cloth.w !== w || h.cloth.h !== tall) {
			if (h) this.drop(h)

			h = this.detail = this.hang(w, tall, '', undefined)
			h.canvas = blank()

			if (laid.alone?.comes) h.cloth.hold(laid.alone.comes[0], laid.alone.comes[1], laid.alone.crown)

			fresh = true
		}

		const lone = laid.alone

		if (this.falling && come < 1 && !this.parting) {
			this.parting = true

			if (lone) h.cloth.hold(lone.goes[0], lone.goes[1], lone.crown)
			else h.cloth.hold()
		}

		const offX = lone ? h.cloth.heldX : 0
		const offY = lone ? h.cloth.heldY : 0

		const start = facing(0, lone?.roll ?? 0)

		const posed = (c: number) => {
			const face = lone ? facing(0, lone.roll * (1 - c)) : facing(-SWING * (1 - c), 0)
			const room: [number, number, number] = [0, 0, 0]

			for (let i = 0; i < 3; i++) {
				const stood = from[i]! + start[i * 3]! * offX + start[i * 3 + 1]! * offY
				const landed = sheet[i]! + (i === 0 ? offX : i === 1 ? offY : 0)

				room[i] = stood + (landed - stood) * c - (face[i * 3]! * offX + face[i * 3 + 1]! * offY)
			}

			return { room, face }
		}

		const { room, face } = posed(come)

		if (fresh) {
			h.room = [...room]
			h.face = face
		}

		this.comes.push(this.time, come)

		while (this.comes.length > 4 && this.comes[2]! < this.time - TRAIL.by) this.comes.splice(0, 2)

		if (lone && (offX || offY)) {
			const rooms: number[][] = [room]
			const faces: number[][] = [face]

			let apart = false

			for (let b = 1; b <= TRAIL.steps; b++) {
				const then = this.past(this.comes, this.time - (lone.trail * b) / TRAIL.steps, come)
				const was = posed(then)

				if (then !== come) apart = true

				rooms.push(was.room)
				faces.push(was.face)
			}

			if (apart) h.cloth.trail(rooms, faces)
			else h.cloth.lag = null
		} else if (h.cloth.lag) h.cloth.lag = null

		const was = h.face

		const mx = room[0] - h.room[0] + (face[0]! - was[0]!) * offX + (face[1]! - was[1]!) * offY
		const my = room[1] - h.room[1] + (face[3]! - was[3]!) * offX + (face[4]! - was[4]!) * offY
		const mz = room[2] - h.room[2] + (face[6]! - was[6]!) * offX + (face[7]! - was[7]!) * offY

		const sx = (face[0]! * mx + face[3]! * my + face[6]! * mz) * HAUL
		const sy = (face[1]! * mx + face[4]! * my + face[7]! * mz) * HAUL
		const sz = (face[2]! * mx + face[5]! * my + face[8]! * mz) * HAUL

		const eye = RIG.focal * wh
		const tug = come === 1 ? Math.min(TUG.most, Math.max(-TUG.most, (-this.drawn * TUG.share * (eye - sheet[2])) / eye)) : 0

		this.drawn = 0

		if (mx || my || mz) this.changed = true

		h.room = room
		h.face = face
		h.alpha = 1

		const shown = come > 0

		if (shown !== h.shown) this.changed = true
		h.shown = shown

		const cloth = h.cloth

		if (come === 1 && !cloth.loose) cloth.hold(w / 2, tall / 2, LOOSE)

		const brush = this.opened === COVER ? null : this.brush(h, true, dt, ww, wh) ?? this.pull(h, tug, dt, ww, wh)

		if (!shown || (!cloth.awake && !sx && !sy && !sz && !brush && !cloth.lag)) {
			if (cloth.awake || cloth.x !== -cloth.w / 2 || cloth.z) {
				cloth.place(-cloth.w / 2, -cloth.h / 2, 0)
				h.fresh = true
				if (shown) this.changed = true
			}

			return
		}

		if (cloth.step(dt, cloth.x + sx, cloth.y + sy, cloth.z + sz, this.time, brush)) {
			h.fresh = true
			this.changed = true
		}
	}

	private hang(w: number, h: number, src: string, old?: Hung): Hung {
		if (old) this.drop(old)

		const cloth = new Cloth(w, h, NX, NY)
		cloth.place(-w / 2, -h / 2, 0)

		return {
			cloth,
			data: new Float32Array(NX * NY * 4),
			points: null,
			order: new Uint32Array(CELLS),
			cells: null,
			sorted: false,
			told: new Float32Array(28),
			uniform: null,
			group: null,
			shade: null,
			texture: -1,
			src,
			canvas: null,
			own: null,
			fresh: true,
			shown: false,
			along: 0,
			room: [0, 0, 0],
			face: facing(TURNED, RIG.roll),
			alpha: 1,
			rest: [0, 0, 0],
			wash: 0,
			born: 0,
		}
	}

	private inSight(cx: number, cy: number, w: number, ww: number, wh: number) {
		const [rx, ry, rz] = toRoom(cx, cy, 0)
		const d = RIG.focal * wh
		if (rz > d * 0.8) return false

		const k = d / (d - rz)
		const reach = w * 1.2 * k

		return Math.abs(rx * k) < ww / 2 + reach && Math.abs(ry * k) < wh / 2 + reach
	}

	pick(sx: number, sy: number) {
		return this.hit(sx, sy)?.key ?? null
	}

	grab(sx: number, sy: number) {
		this.pressed = true
		this.taken = null

		if (this.opened !== null) return

		const hit = this.hit(sx, sy)
		if (!hit) return

		const { w, h } = hit.cloth

		this.taken = hit.key

		this.at = {
			u: Math.min(w * (1 - HAND.inset), Math.max(w * HAND.inset, hit.u)),
			v: Math.min(h * (1 - HAND.inset), Math.max(h * HAND.inset, hit.v)),
		}

		hit.cloth.hold(this.at.u, this.at.v)
	}

	release() {
		this.pressed = false
	}

	private hit(sx: number, sy: number) {
		const ww = this.gl.core.width
		const wh = this.gl.core.height
		const d = RIG.focal * wh

		const dx = sx - ww / 2
		const dy = sy - wh / 2
		const dz = -d

		let found: { key: number; cloth: Cloth; u: number; v: number } | null = null
		let nearest = Infinity

		for (const [key, h] of this.hung) {
			if (!h.shown) continue

			const m = h.face
			const nx = m[2]!
			const ny = m[5]!
			const nz = m[8]!

			const facingRay = nx * dx + ny * dy + nz * dz
			if (Math.abs(facingRay) < 1e-6) continue

			const t = (nx * h.room[0] + ny * h.room[1] + nz * (h.room[2] - d)) / facingRay
			if (t <= 0 || t >= nearest) continue

			const hx = dx * t - h.room[0]
			const hy = dy * t - h.room[1]
			const hz = d + dz * t - h.room[2]

			const lx = m[0]! * hx + m[3]! * hy + m[6]! * hz
			const ly = m[1]! * hx + m[4]! * hy + m[7]! * hz

			if (Math.abs(lx) > h.cloth.w / 2 || Math.abs(ly) > h.cloth.h / 2) continue

			nearest = t
			found = { key, cloth: h.cloth, u: lx + h.cloth.w / 2, v: ly + h.cloth.h / 2 }
		}

		return found
	}

	private build(device: GPUDevice) {
		const module = device.createShaderModule({ label: 'cloth', code: shader })

		const globals = device.createBindGroupLayout({
			label: 'cloth globals',
			entries: [
				{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
				{ binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
			],
		})

		const sheet = device.createBindGroupLayout({
			label: 'cloth sheet',
			entries: [
				{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
				{ binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
				{ binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
			],
		})

		this.pipeline = device.createRenderPipeline({
			label: 'cloth',
			layout: device.createPipelineLayout({ bindGroupLayouts: [globals, sheet] }),
			vertex: {
				module,
				entryPoint: 'vs',
				buffers: [{ arrayStride: 4, stepMode: 'instance', attributes: [{ shaderLocation: 0, offset: 0, format: 'uint32' }] }],
			},
			fragment: {
				module,
				entryPoint: 'fs',
				targets: [{
					format: this.gl.core.format,
					blend: {
						color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
						alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
					},
				}],
			},
			primitive: { topology: 'triangle-list', cullMode: 'none' },
		})

		this.deep = device.createRenderPipeline({
			label: 'cloth, depth tested',
			layout: device.createPipelineLayout({ bindGroupLayouts: [globals, sheet] }),
			vertex: {
				module,
				entryPoint: 'vs',
				buffers: [{ arrayStride: 4, stepMode: 'instance', attributes: [{ shaderLocation: 0, offset: 0, format: 'uint32' }] }],
			},
			fragment: {
				module,
				entryPoint: 'fs',
				targets: [{
					format: this.gl.core.format,
					blend: {
						color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
						alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
					},
				}],
			},
			primitive: { topology: 'triangle-list', cullMode: 'none' },
			depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'greater' },
		})

		this.globals = device.createBuffer({ label: 'cloth globals', size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })

		this.sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', maxAnisotropy: 8 })

		this.globalsGroup = device.createBindGroup({
			layout: globals,
			entries: [
				{ binding: 0, resource: { buffer: this.globals } },
				{ binding: 1, resource: this.sampler },
			],
		})

		this.shadeSheet = device.createBindGroupLayout({
			label: 'cloth shade',
			entries: [
				{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
				{ binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
			],
		})

		this.shader = device.createRenderPipeline({
			label: 'cloth shade',
			layout: device.createPipelineLayout({ bindGroupLayouts: [globals, this.shadeSheet] }),
			vertex: {
				module,
				entryPoint: 'vsShade',
				buffers: [{ arrayStride: 4, stepMode: 'instance', attributes: [{ shaderLocation: 0, offset: 0, format: 'uint32' }] }],
			},
			fragment: {
				module,
				entryPoint: 'fsShade',
				targets: [{
					format: 'rgba8unorm',
					blend: {
						color: { operation: 'max', srcFactor: 'one', dstFactor: 'one' },
						alpha: { operation: 'max', srcFactor: 'one', dstFactor: 'one' },
					},
				}],
			},
			primitive: { topology: 'triangle-list', cullMode: 'none' },
		})

		const softened = device.createShaderModule({ label: 'cloth shadow', code: soft })

		this.blur = device.createRenderPipeline({
			label: 'cloth shadow blur',
			layout: 'auto',
			vertex: { module: softened, entryPoint: 'vs' },
			fragment: { module: softened, entryPoint: 'fsBlur', targets: [{ format: 'rgba8unorm' }] },
			primitive: { topology: 'triangle-list' },
		})

		this.lay = device.createRenderPipeline({
			label: 'cloth shadow lay',
			layout: 'auto',
			vertex: { module: softened, entryPoint: 'vs' },
			fragment: {
				module: softened,
				entryPoint: 'fsLay',
				targets: [{
					format: this.gl.core.format,
					blend: {
						color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
						alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
					},
				}],
			},
			primitive: { topology: 'triangle-list' },
		})

		const through = device.createShaderModule({ label: 'cloth frame', code: flat })

		this.flat = device.createRenderPipeline({
			label: 'cloth frame',
			layout: 'auto',
			vertex: { module: through, entryPoint: 'vs' },
			fragment: { module: through, entryPoint: 'fs', targets: [{ format: this.gl.core.format }] },
			primitive: { topology: 'triangle-list' },
		})

		const lensed = device.createShaderModule({ label: 'cloth frame, fringed', code: fringe })

		this.glass = device.createRenderPipeline({
			label: 'cloth frame, fringed',
			layout: 'auto',
			vertex: { module: lensed, entryPoint: 'vs' },
			fragment: { module: lensed, entryPoint: 'fs', targets: [{ format: this.gl.core.format }] },
			primitive: { topology: 'triangle-list' },
		})

		const level = Uint32Array.from({ length: CELLS }, (_, i) => i)

		this.level = device.createBuffer({ label: 'cloth cells', size: level.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST })
		device.queue.writeBuffer(this.level, 0, level)
	}

	private unlit() {
		if (!this.dusk) return

		this.dusk.a.destroy()
		this.dusk.b.destroy()
		for (const step of this.dusk.steps) step.destroy()

		this.dusk = null
		this.shaded = false
	}

	private dim(device: GPUDevice) {
		const core = this.gl.core
		const w = Math.max(1, Math.ceil(core.canvas.width / core.dpr / SHADOW.scale))
		const h = Math.max(1, Math.ceil(core.canvas.height / core.dpr / SHADOW.scale))

		if (this.dusk && this.dusk.size[0] === w && this.dusk.size[1] === h) return this.dusk

		this.unlit()

		const target = (label: string) => device.createTexture({
			label,
			size: [w, h],
			format: 'rgba8unorm',
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
		})

		const a = target('cloth shadow a')
		const b = target('cloth shadow b')

		const steps: GPUBuffer[] = []

		const step = (x: number, y: number, depth: number) => {
			const buffer = device.createBuffer({ label: 'cloth shadow step', size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
			device.queue.writeBuffer(buffer, 0, new Float32Array([x, y, depth, 0]))
			steps.push(buffer)
			return buffer
		}

		const reads = (pipeline: GPURenderPipeline, from: GPUTexture, by: GPUBuffer) => device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: this.sampler! },
				{ binding: 1, resource: from.createView() },
				{ binding: 2, resource: { buffer: by } },
			],
		})

		this.dusk = {
			size: [w, h],
			a,
			b,
			passes: SHADOW.spreads.map((spread) => ({
				across: reads(this.blur!, a, step(spread / w, 0, 0)),
				down: reads(this.blur!, b, step(0, spread / h, 0)),
			})),
			laid: reads(this.lay!, a, step(0, 0, SHADOW.depth)),
			steps,
		}

		return this.dusk
	}

	private cast = (encoder: GPUCommandEncoder) => {
		const device = this.gl.core.device
		if (!device) return

		if (!this.pipeline) this.build(device)

		const throwing = this.all().filter((h) => h.shown && h.alpha > 0 && h.points && h.uniform)

		this.shaded = throwing.length > 0
		if (!this.shaded) return

		const dusk = this.dim(device)

		const onto = (texture: GPUTexture, label: string) => encoder.beginRenderPass({
			label,
			colorAttachments: [{ view: texture.createView(), loadOp: 'clear', clearValue: { r: 0, g: 0, b: 0, a: 0 }, storeOp: 'store' }],
		})

		const thrown = onto(dusk.a, 'cloth shadow throw')

		thrown.setPipeline(this.shader!)
		thrown.setBindGroup(0, this.globalsGroup!)

		for (const h of throwing) {
			h.shade ??= device.createBindGroup({
				layout: this.shadeSheet!,
				entries: [
					{ binding: 0, resource: { buffer: h.uniform! } },
					{ binding: 2, resource: { buffer: h.points! } },
				],
			})

			thrown.setBindGroup(1, h.shade)
			thrown.setVertexBuffer(0, h.sorted && h.cells ? h.cells : this.level!)
			thrown.draw(SUB * SUB * 6, CELLS)
		}

		thrown.end()

		for (const { across, down } of dusk.passes) {
			const first = onto(dusk.b, 'cloth shadow across')
			first.setPipeline(this.blur!)
			first.setBindGroup(0, across)
			first.draw(3)
			first.end()

			const second = onto(dusk.a, 'cloth shadow down')
			second.setPipeline(this.blur!)
			second.setBindGroup(0, down)
			second.draw(3)
			second.end()
		}
	}

	private shadow(pass: GPURenderPassEncoder) {
		if (!this.shaded || !this.dusk) return

		pass.setPipeline(this.lay!)
		pass.setBindGroup(0, this.dusk.laid)
		pass.draw(3)
	}

	private frameId(view: GPUTextureView) {
		if (view !== this.frameView) {
			this.frameView = view
			this.frameCount--
		}

		return this.frameCount
	}

	private composite = (encoder: GPUCommandEncoder, src: GPUTextureView, dst: GPUTextureView) => {
		const device = this.gl.core.device
		if (!device) return

		if (!this.pipeline) this.build(device)

		if (this.flatView !== src) {
			this.flatView = src
			this.flatGroup = device.createBindGroup({
				layout: this.flat!.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: this.sampler! },
					{ binding: 1, resource: src },
				],
			})

			this.glassGroup = device.createBindGroup({
				layout: this.glass!.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: this.sampler! },
					{ binding: 1, resource: src },
				],
			})
		}

		const asked = this.printing ? this.keeping : null

		if (asked) {
			this.keeping = null
			this.copy(device, encoder)
		}

		const worn = this.kept && !asked ? this.kept.view : this.printing ? src : null
		const whole = !this.printing || (!!this.kept && !asked)

		const { canvas } = this.gl.core

		if (!this.depth || this.depth.size[0] !== canvas.width || this.depth.size[1] !== canvas.height) {
			this.depth?.texture.destroy()

			const texture = device.createTexture({ label: 'cloth depth', size: [canvas.width, canvas.height], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT })

			this.depth = { size: [canvas.width, canvas.height], texture, view: texture.createView() }
		}

		const plain = (first: boolean) => encoder.beginRenderPass({
			label: 'cloth frame',
			colorAttachments: [{ view: dst, loadOp: first ? 'clear' : 'load', clearValue: { r: 0, g: 0, b: 0, a: 0 }, storeOp: 'store' }],
		})

		const cloths = (lot: Hung[], print: GPUTextureView | null) => {
			const pass = encoder.beginRenderPass({
				label: 'cloths',
				colorAttachments: [{ view: dst, loadOp: 'load', storeOp: 'store' }],
				depthStencilAttachment: { view: this.depth!.view, depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'discard' },
			})

			this.paint({ pass, draws: 0 }, lot, print, true)
			pass.end()
		}

		const keeping = this.opened === null

		if (keeping && (!this.rested || this.rested.size[0] !== canvas.width || this.rested.size[1] !== canvas.height)) {
			this.rested?.texture.destroy()

			const texture = device.createTexture({
				label: 'cloth frame at rest',
				size: [canvas.width, canvas.height],
				format: this.gl.core.format,
				usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			})

			const view = texture.createView()

			this.rested = {
				size: [canvas.width, canvas.height],
				texture,
				view,
				group: device.createBindGroup({
					layout: this.flat!.getBindGroupLayout(0),
					entries: [
						{ binding: 0, resource: this.sampler! },
						{ binding: 1, resource: view },
					],
				}),
			}
		}

		const under = keeping
			? encoder.beginRenderPass({
				label: 'cloth frame, kept',
				colorAttachments: [{ view: this.rested!.view, loadOp: 'clear', clearValue: { r: 0, g: 0, b: 0, a: 0 }, storeOp: 'store' }],
			})
			: plain(true)

		if (whole) {
			under.setPipeline(this.glass!)
			under.setBindGroup(0, this.glassGroup!)
			under.draw(3)
		}

		if (!this.behind) this.shadow(under)

		under.end()

		if (keeping) {
			const onto = plain(true)

			onto.setPipeline(this.flat!)
			onto.setBindGroup(0, this.rested!.group)
			onto.draw(3)
			onto.end()
		}

		if (this.behind) {
			cloths(this.strip(), null)

			const shade = plain(false)

			this.shadow(shade)
			shade.end()
		}

		cloths(this.behind ? this.fore() : this.all(), worn)

		this.changed = false

		if (asked) queueMicrotask(asked)
	}

	keep(done: () => void) {
		if (!this.printing || this.kept) return done()

		this.keeping = done
		this.changed = true
	}

	blot() {
		this.unkeep()
		this.printing = false
		this.changed = true
	}

	private unkeep() {
		this.kept?.texture.destroy()
		this.kept = null

		const waiting = this.keeping
		this.keeping = null
		waiting?.()
	}

	private copy(device: GPUDevice, encoder: GPUCommandEncoder) {
		const { canvas, format } = this.gl.core

		const texture = device.createTexture({
			label: 'cloth page kept',
			size: [canvas.width, canvas.height],
			format,
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
		})

		const view = texture.createView()

		const pass = encoder.beginRenderPass({
			label: 'cloth page keep',
			colorAttachments: [{ view, loadOp: 'clear', clearValue: { r: 0, g: 0, b: 0, a: 0 }, storeOp: 'store' }],
		})

		pass.setPipeline(this.flat!)
		pass.setBindGroup(0, this.flatGroup!)
		pass.draw(3)
		pass.end()

		this.kept = { texture, view }
	}

	print(seconds: number) {
		this.printing = true
		this.inked = 1
		this.busyUntil = performance.now() + seconds * 1000
		this.changed = true
	}

	private printed(h: Hung, device: GPUDevice) {
		const canvas = h.canvas!

		if (!h.own) {
			const texture = device.createTexture({
				label: 'cloth print',
				size: [canvas.width, canvas.height],
				format: 'rgba8unorm',
				usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
			})

			device.queue.copyExternalImageToTexture({ source: canvas }, { texture }, [canvas.width, canvas.height])

			h.own = { texture, view: texture.createView() }
		}

		return { id: DETAIL, view: h.own.view, width: canvas.width, height: canvas.height }
	}

	private sort(h: Hung) {
		const { pos } = h.cloth
		const { depths } = this

		const zx = h.face[6]!
		const zy = h.face[7]!
		const zz = h.face[8]!
		const z = (i: number) => pos[i * 3]! * zx + pos[i * 3 + 1]! * zy + pos[i * 3 + 2]! * zz

		for (let c = 0; c < CELLS; c++) {
			const i = (c % (NX - 1)) + Math.floor(c / (NX - 1)) * NX

			depths[c] = z(i) + z(i + 1) + z(i + NX) + z(i + NX + 1)
			h.order[c] = c
		}

		h.order.sort((p, q) => depths[p]! - depths[q]!)
	}

	private under = (frame: { pass: GPURenderPassEncoder; draws: number }) => {
		if (this.post.active) return

		if (this.behind) this.paint(frame, this.strip())

		this.shadow(frame.pass)

		if (this.detail) this.paint(frame, [this.detail])
	}

	private over = (frame: { pass: GPURenderPassEncoder; draws: number }) => {
		if (this.post.active) return

		if (this.opened === null) {
			const { canvas } = this.gl.core
			const kept = this.rested

			if (this.down) this.down = false
			else this.again = 2

			if (kept && this.flat && kept.size[0] === canvas.width && kept.size[1] === canvas.height) {
				frame.pass.setPipeline(this.flat)
				frame.pass.setBindGroup(0, kept.group)
				frame.pass.draw(3)
				frame.draws++
			} else this.again = 2
		}

		const sheet = this.detail

		this.paint(frame, (this.behind ? this.fore() : this.all()).filter((h) => h !== sheet))

		this.changed = false
	}

	private strip() {
		const open = this.ahead ? this.lifting() : null

		return [...this.hung.values()].filter((h) => h !== open)
	}

	private fore() {
		const open = this.ahead ? this.lifting() : null

		return this.all().filter((h) => h === open || h === this.detail)
	}

	private lifting() {
		return this.opened === null || this.solo ? null : this.hung.get(this.opened) ?? null
	}

	private paint(frame: { pass: GPURenderPassEncoder; draws: number }, cloths: Hung[], print: GPUTextureView | null = null, deep = false) {
		const { pass } = frame
		const core = this.gl.core
		const device = core.device
		if (!device) return

		if (!this.pipeline) this.build(device)

		const u = new Float32Array(8)
		u[0] = core.width
		u[1] = core.height
		u[2] = core.canvasWidth || core.width
		u[3] = core.canvas.height / core.dpr
		u[4] = core.originX
		u[5] = core.originY
		u[6] = core.dpr
		device.queue.writeBuffer(this.globals!, 0, u)

		const open = this.lifting()
		const sheet = this.detail

		const depth = (h: Hung) => (h === sheet ? Infinity : h !== open ? h.room[2] : this.ahead ? Number.MAX_VALUE : h.rest[2])

		const shown = cloths.filter((h) => h.shown).sort((a, b) => {
			const za = depth(a)
			const zb = depth(b)

			return za === zb ? 0 : za - zb
		})

		let bound = false
		let turn = 0

		for (const h of shown) {
			const tex = h.canvas
				? (print ? { id: this.frameId(print), view: print, width: 1, height: 1 } : this.printed(h, device))
				: this.gl.textures.peek(h.src)

			if (!tex) {
				h.texture = -1
				continue
			}

			const cloth = h.cloth

			h.points ??= device.createBuffer({ label: 'cloth particles', size: h.data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST })
			h.uniform ??= device.createBuffer({ label: 'cloth sheet', size: h.told.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })

			if (h.fresh) {
				const { pos } = cloth

				for (let i = 0; i < cloth.count; i++) {
					h.data[i * 4] = pos[i * 3]!
					h.data[i * 4 + 1] = pos[i * 3 + 1]!
					h.data[i * 4 + 2] = pos[i * 3 + 2]!
				}

				device.queue.writeBuffer(h.points, 0, h.data)

				h.sorted = cloth.awake

				if (h.sorted) {
					this.sort(h)

					h.cells ??= device.createBuffer({ label: 'cloth order', size: h.order.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST })
					device.queue.writeBuffer(h.cells, 0, h.order)
				}

				h.fresh = false
			}

			const t = h.told

			if (h === this.detail) {
				const box = print ? this.box() : null

				t[0] = box ? box.width / u[2]! : 1
				t[1] = box ? box.height / u[3]! : 1
				t[2] = box ? (box.left - u[4]!) / u[2]! : 0
				t[3] = box ? (box.top - u[5]!) / u[3]! : 0
				t[5] = 1
				t[6] = box ? this.inked : 0
			} else {
				const box = cloth.w / cloth.h
				const pic = tex.width / tex.height

				t[0] = Math.min(1, box / pic)
				t[1] = Math.min(1, pic / box)
				t[2] = (1 - t[0]!) / 2
				t[3] = (1 - t[1]!) / 2
				t[5] = 0
				t[6] = 0
			}

			t[4] = h.alpha
			t[7] = h.wash

			t[8] = cloth.x + cloth.w / 2
			t[9] = cloth.y + cloth.h / 2
			t[10] = cloth.z
			t[11] = cloth.w

			t[12] = h.room[0]
			t[13] = h.room[1]
			t[14] = h.room[2]
			t[15] = cloth.h

			t[19] = turn++

			for (let row = 0; row < 3; row++) {
				t[16 + row * 4] = h.face[row * 3]!
				t[17 + row * 4] = h.face[row * 3 + 1]!
				t[18 + row * 4] = h.face[row * 3 + 2]!
			}

			device.queue.writeBuffer(h.uniform, 0, t)

			if (h.texture !== tex.id || !h.group) {
				h.group = device.createBindGroup({
					layout: this.pipeline!.getBindGroupLayout(1),
					entries: [
						{ binding: 0, resource: { buffer: h.uniform } },
						{ binding: 1, resource: tex.view },
						{ binding: 2, resource: { buffer: h.points } },
					],
				})

				h.texture = tex.id
			}

			if (!bound) {
				pass.setPipeline(deep ? this.deep! : this.pipeline!)
				pass.setBindGroup(0, this.globalsGroup!)
				bound = true
			}

			pass.setBindGroup(1, h.group)
			pass.setVertexBuffer(0, h.sorted && h.cells ? h.cells : this.level!)
			pass.draw(SUB * SUB * 6, CELLS)

			frame.draws++
		}
	}
}
