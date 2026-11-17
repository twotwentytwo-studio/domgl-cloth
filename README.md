# DomGL Cloth

An infinite carousel of cloth posters: each poster is a simulated sheet, drawn
on one WebGPU canvas, on a page with no native scroll. Made for Codrops.

**Demo:** https://domgl-cloth.jesperlandberg.com

[Article on Codrops](https://tympanus.net/codrops/?p=126285)

Nuxt 4 · Tailwind 4 · GSAP · [@alpacka/scroll](https://www.npmjs.com/package/@alpacka/scroll) · [domgl](https://domgl.jesperlandberg.com/) (WebGPU)

## Run it

```bash
npx npm@11 install
npm run dev
```

npm 11, not 10: npm 10.9 can write a lockfile that `npm ci` then rejects.
WebGPU is needed (current Chrome, Edge and Safari); without it the page
says so and shows nothing else.

`npm run generate` builds the static site into `.output/public`.

## How it works

The short version is on the site itself, under "How it works". The longer one:

- **Cloth.** `app/cloth/sim.ts` is an XPBD sheet: a 25 by 33 grid of
  particles and distance constraints, pinned near its middle to the poster's
  box in the DOM. Moving the carousel moves the pin; the drape follows.
- **Drawing.** `app/cloth/layer.ts` joins domgl's frame and draws each sheet
  as a B-spline surface over its particles, with a weave, a sheen and blurred
  shadows. At rest nothing is drawn.
- **Scroll.** `app/plugins/scroll.client.ts` runs @alpacka/scroll's
  `virtual()`. The strip (`app/components/Strip.vue`) is a `scroll.column()`
  with `loop` and `transforms: false`: it writes nothing to the DOM, and the
  cloth layer draws from the boxes the column works out. A drag is one more
  input through `scroll.push()`; the sheets' pages are clamped columns laid
  over it.
- **Type.** Every word on the page is GPU text drawn by domgl from the
  font's outlines. The titles behind the strip go through a lens
  (`app/shaders/lens.ts`).

## Layout

```
app/              the site: components, the cloth, shaders, styles
layers/base/      the starter's shared layer (motion, scale, grid, server)
vendor/domgl/     domgl, compiled
public/img, tx    the posters, baked (webp and KTX2)
public/glyphs     the fonts' outlines, baked for GPU text
```

The pictures and the glyphs are baked ahead of time and committed, so a clone
runs as it is. The posters are placeholders drawn by `node scripts/posters.mjs`.

## Credits

- Fonts: [Host Grotesk](https://github.com/Element-Type/HostGrotesk) and
  [Geist Mono](https://github.com/vercel/geist-font), both under the SIL Open
  Font License 1.1 (the licence texts are beside the files in
  `app/assets/fonts`).
- `vendor/domgl/assets/basis` redistributes the
  [Basis Universal](https://github.com/BinomialLLC/basis_universal) transcoder
  by Binomial LLC, unmodified, under the Apache License 2.0.

## License

- **domgl (`vendor/domgl`)** is proprietary and not open source. Copyright (c)
  2026 Jesper Landberg, all rights reserved. It's included in compiled form
  only so that this site can be built. No license to use, copy, modify or
  distribute it, in whole or in part, in this project or any other, is
  granted. See [vendor/domgl/LICENSE](vendor/domgl/LICENSE).
  `vendor/domgl/assets/basis/worker.js` is part of domgl and falls under the
  same terms.
- **The Basis Universal transcoder** (`basis_transcoder.js` and
  `basis_transcoder.wasm` in `vendor/domgl/assets/basis`) is under the Apache
  License 2.0. See the [LICENSE](vendor/domgl/assets/basis/LICENSE) and
  [NOTICE](vendor/domgl/assets/basis/NOTICE) beside it.
- **The fonts** are under the SIL Open Font License 1.1. See
  [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
