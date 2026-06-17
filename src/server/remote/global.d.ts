/// <reference types="svelte" />

// Vite resolves asset imports (small files inline as a data URI) to a URL string.
declare module "*.webp" {
    const url: string
    export default url
}
