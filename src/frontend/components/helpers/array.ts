import type { Option } from "../../../types/Main"
import { translate } from "../../utils/language"

// check if array has any data
export function arrayHasData<T>(array: T, data: any): boolean {
    if (!Array.isArray(array)) return false
    return array.find((a) => JSON.stringify(a) === JSON.stringify(data)) !== undefined
}

// remove duplicates from array (only lowest level)
export function removeDuplicates<T>(array: T) {
    if (!Array.isArray(array)) return array
    return [...new Set(array)] as T
}

// sort array (or event object) by time in ascending order
export function sortByTime(a, b) {
    if (a.from) a = a.from
    if (b.from) b = b.from
    return new Date(a).getTime() - new Date(b).getTime()
}

export function sortByTimeNew<T>(array: T, key = "time") {
    if (!Array.isArray(array)) return array
    return array.sort((a, b) => new Date(a[key]).getTime() - new Date(b[key]).getTime())
}

export function moveToPos<T>(array: T, oldPos: number, newPos: number) {
    if (!Array.isArray(array) || newPos < 0) return array

    if (newPos >= array.length) {
        let k = newPos - array.length + 1
        while (k--) array.push(undefined)
    }

    array.splice(newPos, 0, array.splice(oldPos, 1)[0])
    return array
}

// OBJETS

// sort objects in array by name
export function sortByName<T extends Record<string, any>>(arr: T[], key: keyof T = "name", numberSort = true) {
    if (!Array.isArray(arr)) return []
    return arr
        .filter((a) => typeof a[key] === "string")
        .sort((a, b) => {
            if (!numberSort) return a[key].localeCompare(b[key])

            const regex = /(\d+|\D+)/g

            const segmentsA = a[key].match(regex) || []
            const segmentsB = b[key].match(regex) || []

            const len = Math.min(segmentsA.length, segmentsB.length)

            for (let i = 0; i < len; i++) {
                const partA = segmentsA[i]
                const partB = segmentsB[i]

                const numA = parseInt(partA, 10)
                const numB = parseInt(partB, 10)

                if (!isNaN(numA) && !isNaN(numB)) {
                    if (numA !== numB) return numA - numB
                } else {
                    const cmp = partA.localeCompare(partB)
                    if (cmp !== 0) return cmp
                }
            }

            return segmentsA.length - segmentsB.length
        })
}

// sort objects in array alphabeticly
export function sortObject<T extends Record<string, any>>(object: T[], key: keyof T) {
    return object.sort((a, b) => {
        let textA: string = a[key] || ""
        let textB: string = b[key] || ""
        if (a.default === true) textA = translate(textA) || textA.slice(textA.indexOf("."))
        if (b.default === true) textB = translate(textB) || textB.slice(textB.indexOf("."))

        return textA.localeCompare(textB)
    })
}

// sort objects in array numerically
export function sortObjectNumbers<T extends Record<string, any>>(object: T[], key: keyof T, reverse = false) {
    return object.sort((a, b) => {
        return reverse ? b[key] - a[key] : a[key] - b[key]
    })
}

// sort any object.name by numbers in the front of the string
export function sortByNameAndNumber<T extends Record<string, any>>(array: T[]) {
    return array.sort((a, b) => {
        const aNumberStr = a.quickAccess?.number || ""
        const bNumberStr = b.quickAccess?.number || ""

        // Split into prefix letters + numeric part
        const extractParts = (str: string) => {
            const match = str.match(/^([A-Za-z]*)(\d+)?$/)
            return { prefix: match?.[1] || "", number: match?.[2] ? parseInt(match[2], 10) : Infinity }
        }

        const aParts = extractParts(aNumberStr)
        const bParts = extractParts(bNumberStr)

        // Compare by prefix first
        if (aParts.prefix !== bParts.prefix) return aParts.prefix.localeCompare(bParts.prefix)

        // Then by numeric part
        if (aParts.number !== bParts.number) return aParts.number - bParts.number

        // Fall back to name
        return (a.name || "").localeCompare(b.name || "")
    })
}


// sort object by name and numbers any location (file names)
export function sortFilenames<T extends Record<string, any>>(filenames: T[]) {
    return filenames.sort(({ name: a }, { name: b }) => {
        // extract name, number, and extension
        const regex = /^(.*?)(\d+)?(\.\w+)?$/

        // extract parts
        const [_, nameA, numA, extA] = a.match(regex) || [a, a, null, null]
        const [__, nameB, numB, extB] = b.match(regex) || [b, b, null, null]

        // compare difference in the names
        const nameComparison = nameA.localeCompare(nameB)
        if (nameComparison !== 0) return nameComparison

        // compare any numbers
        const numComparison = (parseInt(numA, 10) || 0) - (parseInt(numB, 10) || 0)
        if (numComparison !== 0) return numComparison

        // compare extensions at last
        const extAValue = extA || ""
        const extBValue = extB || ""
        return extAValue.localeCompare(extBValue)
    })
}

// move keys to IDs in object and return array
export function keysToID<T extends Record<string, any>>(object: T): (T[keyof T] & { id: string })[] {
    if (!object) return []
    return Object.entries(object).map(([id, a]) => ({ ...a, id }))
}

// remove values in array object where key is value
export function removeValues<T extends Record<string, any>>(object: T[], key: keyof T, value: any) {
    return object.filter((o) => o[key] !== value)
}

// remove deleted values (used by cloud sync)
export function removeDeleted<T extends Record<string, any>>(object: T[]) {
    if (!Array.isArray(object)) return object
    return object.filter((o) => !o.deleted)
}

// remove every duplicated values in object
export function removeDuplicateValues<T>(obj: T): T {
    if (typeof obj !== "object") return obj

    const uniqueObj: T = {} as T
    const valueSet = new Set()

    for (const [key, value] of Object.entries(obj!)) {
        const valueStr = JSON.stringify(value)
        if (!valueSet.has(valueStr)) {
            valueSet.add(valueStr)
            uniqueObj[key] = value
        }
    }

    return uniqueObj
}

// change values from one object to another
export function changeValues<T>(object: T, values: { [key: string]: any }) {
    Object.entries(values).forEach(([key, value]) => {
        object[key] = value
        if (value === undefined) delete object[key]
    })
    return object
}

// clone objects
export function clone<T>(object: T): T {
    if (typeof object !== "object") return object
    return JSON.parse(JSON.stringify(object))
}

// not currently in use, but could be handy
export function slowLoop(array, interval, returnFunc) {
    loopFunction(0)

    function loopFunction(index) {
        returnFunc(array[index])

        if (index < array.length - 1) {
            setTimeout(() => {
                loopFunction(index + 1)
            }, interval)
        }
    }
}

// randomize array items
export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
            ;[array[i], array[j]] = [array[j], array[i]]
    }

    return array
}

// convert object to dropdown options
export function convertToOptions(object) {
    const options: Option[] = Object.keys(object).map((id) => ({ id, name: object[id].name }))
    return sortByName(options)
}

// find the keys either added or changed in any object in an array
export function getChangedKeys(current: any[], previous: any[]) {
    const changedKeys: { key: string; index: number }[] = []

    current.forEach((item, index) => {
        const prevItem = previous[index] || {}
        const keys = new Set([...Object.keys(item), ...Object.keys(prevItem)])

        keys.forEach((key) => {
            if (item[key] !== prevItem[key]) {
                changedKeys.push({ key, index })
            }
        })
    })

    return changedKeys
}
