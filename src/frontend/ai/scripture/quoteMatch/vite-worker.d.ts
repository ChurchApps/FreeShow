// Vite's ?worker&inline import shape (no vite/client types are wired into this tsconfig)
declare module "*?worker&inline" {
    const workerFactory: new () => Worker
    export default workerFactory
}
