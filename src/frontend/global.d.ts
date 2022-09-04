// ----- FreeShow -----

/// <reference types="svelte" />

// remove App.svelte error in main.ts
declare module "*.svelte" {
  import type { ComponentType } from "svelte"
  const component: ComponentType
  export default component
}

// declare properties TypeScript don't allow

// window.
interface Window {
  api?: any
}

// event.target.
interface EventTarget {
  play?: any // VideoStream
  classList?: any
  closest?: any
}
