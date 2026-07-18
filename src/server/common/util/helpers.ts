export const getValue = (e: any) => (e.target?.value || "") as string
export const isChecked = (e: any) => !!e.target?.checked

export function clone<T>(object: T): T {
    if (object === null || typeof object !== "object") return object

    try {
        return structuredClone(object)
    } catch {
        try {
            return JSON.parse(JSON.stringify(object))
        } catch {
            return object
        }
    }
}

export function sortByName(arr: any[]) {
    return arr.sort((a, b) => a.name?.localeCompare(b.name))
}

export function keysToID(object: { [key: string]: any }): any[] {
    if (!object) return []
    let newObjects: any[] = Object.entries(object).map(([id, a]) => ({ ...a, id }))
    return newObjects
}
