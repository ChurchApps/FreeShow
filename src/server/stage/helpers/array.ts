export function sortByName(arr: any[]) {
    return arr.sort((a, b) => a.name?.localeCompare(b.name))
}

export function keysToID(object: { [key: string]: any }): any[] {
    if (!object) return []
    let newObjects: any[] = Object.entries(object).map(([id, a]) => ({ ...a, id }))
    return newObjects
}
