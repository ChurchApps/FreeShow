import { translate } from "../../utils/language"

// move data in array at given indexes to new pos
export function groupToPos(array: any[], group: number[], pos: number): any[] {
    let temp: any[] = []
    group.forEach((i) => {
        temp.push(array.splice(i, 1)[0])
    })
    return [...array.slice(0, pos), ...temp, ...array.slice(pos, array.length)]
}

// add data to array at new pos
// export function dataToPos(array: any[], data: any[], pos: number): any[] {
//   return [...array.slice(0, pos), ...data, ...array.slice(pos, array.length)]
// }

// remove the given value from array
export function removeData(array: any[], data: any): any[] {
    let temp: any[] = []
    array.forEach((a) => {
        if (a !== data) temp.push(a)
    })
    return temp
}

// check if array has any data
export function arrayHasData(array: any[], data: any): boolean {
    if (!Array.isArray(array)) return false
    return array.find((a) => JSON.stringify(a) === JSON.stringify(data)) !== undefined
}

// filter out all empty values in array
export function removeEmpty(array: any[]): any[] {
    return array.filter((a: any): number => a.length)
}

// remove duplicates from array (only lowest level)
export function removeDuplicates(array: any[]): any[] {
    return [...new Set(array)]
}

// sort array (or event object) by time in ascending order
export function sortByTime(a, b) {
    if (a.from) a = a.from
    if (b.from) b = b.from
    return new Date(a).getTime() - new Date(b).getTime()
}

// OBJETS

// sort objects in array by name
export function sortByName(arr: any[], key: string = "name") {
    return arr.filter((a) => typeof a[key] === "string").sort((a, b) => a[key].localeCompare(b[key]))
}

// sort objects in array alphabeticly
export function sortObject(object: any[], key: string): any[] {
    return object.sort((a: any, b: any) => {
        let textA: string = a[key] || ""
        let textB: string = b[key] || ""
        if (a.default === true) textA = translate(textA) || textA.slice(textA.indexOf("."))
        if (b.default === true) textB = translate(textB) || textB.slice(textB.indexOf("."))

        return textA.localeCompare(textB)
    })
}

// sort objects in array numerically
export function sortObjectNumbers(object: {}[], key: string, reverse: boolean = false): {}[] {
    return object.sort((a: any, b: any) => {
        return reverse ? b[key] - a[key] : a[key] - b[key]
    })
}

// sort any object.name by numbers in the front of the string
export function sortByNameAndNumber(array: any[]) {
    return array.sort((a, b) => {
        let aName = a.name || ""
        let bName = b.name || ""

        // get numbers in front of name
        const matchA = aName.match(/^\d+/)
        const matchB = bName.match(/^\d+/)
        const numA = matchA ? parseInt(matchA[0], 10) : Infinity
        const numB = matchB ? parseInt(matchB[0], 10) : Infinity

        if (numA !== numB) return numA - numB

        return aName.localeCompare(bName)
    })
}

// sort object by name and numbers any location (file names)
export function sortFilenames(filenames) {
    return filenames.sort(({ name: a }, { name: b }) => {
        // extract name, number, and extension
        const regex = /^(.*?)(?:_(\d+))?(\.\w+)?$/

        // extract parts
        const [_, nameA, numA, extA] = a.match(regex) || [a, a, null, null]
        const [__, nameB, numB, extB] = b.match(regex) || [b, b, null, null]

        // compare difference in the names
        const nameComparison = nameA.localeCompare(nameB)
        if (nameComparison !== 0) return nameComparison

        // compare any numbers
        const numComparison = (parseInt(numA) || 0) - (parseInt(numB) || 0)
        if (numComparison !== 0) return numComparison

        // compare extensions at last
        const extAValue = extA || ""
        const extBValue = extB || ""
        return extAValue.localeCompare(extBValue)
    })
}

// move keys to IDs in object and return array
export function keysToID(object: { [key: string]: any }): any[] {
    if (!object) return []
    let newObjects: any[] = Object.entries(object).map(([id, a]) => ({ ...a, id }))
    return newObjects
}

// remove values in array object where key is value
export function removeValues(object: any[], key: string, value: any): any[] {
    return object.filter((o: any) => o[key] !== value)
}

// remove deleted values (used by cloud sync)
export function removeDeleted<T>(object: T): T {
    if (!Array.isArray(object)) return object
    return (object as any).filter((o) => !o.deleted)
}

// change values from one object to another
export function changeValues(object: any, values: { [key: string]: any }) {
    Object.entries(values).forEach(([key, value]: any) => {
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
