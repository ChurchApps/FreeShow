// ----- FreeShow -----

/// <reference types="svelte" />

// remove App.svelte error in main.ts
declare module "*.svelte" {
    import type { ComponentType } from "svelte"
    const component: ComponentType
    export default component
}

// declare properties TypeScript don't allow

type FontData = {
    family: string
    fullName: string
    postscriptName: string
    style: string
}

// window.
interface Window {
    api: {
        send: (channel: string, data?: any, id?: string) => void
        receive: (channel: string, func: any, id?: string) => void
        removeListener: (channel: string, id: string) => void
        getListeners: () => [string, number][]
        showFilePath: (file: File) => string
    }
    queryLocalFonts: () => Promise<FontData[]>
}

// event.target.
interface EventTarget {
    play?: any // VideoStream
    classList?: any
    closest?: any
}

declare module "*?worker&url" {
    const url: string
    export default url
}
