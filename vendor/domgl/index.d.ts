import type { DefineComponent, Ref, ShallowRef } from 'vue'

export type MaterialDef = {
	frag: string
	uniforms?: Record<string, unknown>
	raw?: boolean
	animated?: boolean
	video?: boolean
	vert?: string
	tess?: number
}

export type DomGl = any
export type DomGlContext = { gl: DomGl; media: unknown }
export type Post = any

export declare function useDomGl(): ShallowRef<DomGlContext | null>
export declare function awaitConnected(el: Ref<HTMLElement | null>): Promise<boolean>
export declare function fontsReady(cap?: number): Promise<unknown>
export declare const DomGl: DefineComponent<any>
export declare const GlMedia: DefineComponent<any>
export declare const GlSolid: DefineComponent<any>
export declare const GlText: DefineComponent<any>
