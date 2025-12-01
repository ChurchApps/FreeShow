import { translateText } from "../../utils/language"

// check if array has any data
export function arrayHasData<T>(array: T, data: any): boolean {
    if (!Array.isArray(array)) return false
    return array.find(a => JSON.stringify(a) === JSON.stringify(data)) !== undefined
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
        .filter(a => typeof a[key] === "string")
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
        if (a.default === true) textA = translateText(textA) || textA.slice(textA.indexOf("."))
        if (b.default === true) textB = translateText(textB) || textB.slice(textB.indexOf("."))

        if (typeof textA !== "string") textA = ""
        if (typeof textB !== "string") textB = ""

        return textA.localeCompare(textB)
    })
}

// sort objects in array numerically
export function sortObjectNumbers<T extends Record<string, any>>(object: T[], key: keyof T, reverse = false) {
    if (!Array.isArray(object)) return []
    return object.sort((a, b) => {
        return reverse ? b[key] - a[key] : a[key] - b[key]
    })
}

// sort quick access numbers with optional prefixes/suffixes; blanks always go last
export function sortByNameAndNumber<T extends Record<string, any>>(array: T[], direction: "asc" | "desc" = "asc") {
    if (!Array.isArray(array)) return []

    const dir = direction === "asc" ? 1 : -1

    const parseToken = (value: string | undefined) => {
        // keep a consistent tuple of prefix, numeric core, and suffix for reliable comparisons
        const trimmed = value?.trim() || ""
        if (!trimmed) return { empty: true, prefix: "", number: Number.POSITIVE_INFINITY, suffix: "" }

        const match = trimmed.match(/^([A-Za-z]*)(\d+)?([A-Za-z]*)$/)
        const prefix = (match?.[1] || "").toUpperCase()
        const suffix = (match?.[3] || "").toUpperCase()
        const hasDigits = !!match?.[2]
        const number = hasDigits ? parseInt(match![2]!, 10) : Number.POSITIVE_INFINITY

        return { empty: false, prefix, number, suffix, hasDigits }
    }

    return array.sort((a, b) => {
        const aToken = parseToken(a.quickAccess?.number?.toString())
        const bToken = parseToken(b.quickAccess?.number?.toString())

        if (aToken.empty !== bToken.empty) return aToken.empty ? 1 : -1

        if (aToken.prefix !== bToken.prefix) return aToken.prefix.localeCompare(bToken.prefix) * dir

        if (aToken.number !== bToken.number) return (aToken.number - bToken.number) * dir

        if (aToken.suffix !== bToken.suffix) return aToken.suffix.localeCompare(bToken.suffix) * dir

        return (a.name || "").localeCompare(b.name || "") * dir
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
    return object.filter(o => o[key] !== value)
}

// remove deleted values (used by cloud sync)
export function removeDeleted<T extends Record<string, any>>(object: T[]) {
    if (!Array.isArray(object)) return object
    return object.filter(o => !o.deleted)
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
// export function slowLoop(array, interval, returnFunc) {
//     loopFunction(0)

//     function loopFunction(index) {
//         returnFunc(array[index])

//         if (index < array.length - 1) {
//             setTimeout(() => {
//                 loopFunction(index + 1)
//             }, interval)
//         }
//     }
// }

// randomize array items
export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[array[i], array[j]] = [array[j], array[i]]
    }

    return array
}

// find the keys either added or changed in any object in an array
export function getChangedKeys(current: any[], previous: any[]) {
    const changedKeys: { key: string; index: number }[] = []

    current.forEach((item, index) => {
        const prevItem = previous[index] || {}
        const keys = new Set([...Object.keys(item), ...Object.keys(prevItem)])

        keys.forEach(key => {
            if (item[key] !== prevItem[key]) {
                changedKeys.push({ key, index })
            }
        })
    })

    return changedKeys
}

export function rangeSelect(e: any, currentlySelected: (number | string)[], newSelection: number | string): (number | string)[] {
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) return [newSelection]

    if (e.ctrlKey || e.metaKey) {
        if (currentlySelected.includes(newSelection)) {
            return currentlySelected.filter(id => id !== newSelection)
        } else {
            return [...currentlySelected, newSelection]
        }
    }

    if (e.shiftKey && !currentlySelected.includes(newSelection) && !isNaN(Number(newSelection))) {
        // add range between last selected and new selection
        const lastSelected = Number(currentlySelected[currentlySelected.length - 1])
        newSelection = Number(newSelection)
        let first: number = newSelection + 1
        let last: number = lastSelected
        if (newSelection < lastSelected) {
            first = lastSelected
            last = newSelection - 1
        }

        for (let i = last + 1; i < first; i++) {
            if (!currentlySelected.includes(i)) currentlySelected.push(i)
        }

        // remove duplicates
        currentlySelected = [...new Set(currentlySelected)]
        // sort by value (shift key last selected relies on unsorted order)
        // currentlySelected.sort((a, b) => a - b)
    }

    return currentlySelected
}

// compare two objects, check that they are identical, regardless of key order
export function areObjectsEqual(a: Record<string, any>, b: Record<string, any>): boolean {
    return JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())
}
