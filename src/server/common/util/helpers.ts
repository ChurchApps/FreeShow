export const getValue = (e: any) => (e.target?.value || "") as string
export const isChecked = (e: any) => !!e.target?.checked

export function clone<T>(object: T): T {
    if (typeof object !== "object") return object
    return JSON.parse(JSON.stringify(object))
}
