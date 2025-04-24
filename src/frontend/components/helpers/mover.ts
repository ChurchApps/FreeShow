export function getIndexes<T>(array: T): number[] {
    if (!Array.isArray(array)) return []
    return array.map((a) => a.index).sort((a, b) => b - a)
}

export function mover<T>(array: T, selected: number[], pos: number) {
    if (!Array.isArray(array)) return array

    const moved = [] as T;
        const newArray = [] as T;
        let newPos: number = pos || 0

    array.forEach((a, i) => {
        if (!Array.isArray(moved) || !Array.isArray(newArray)) return

        if (selected.includes(i)) {
            if (i < pos) newPos--
            moved.push(a)
        } else newArray.push(a)
    })

    return addToPos(newArray, moved, newPos)
}

export function addToPos<T>(array: T, newArrays: T, pos: number) {
    if (!Array.isArray(array) || !Array.isArray(newArrays)) return array
    return [...array.slice(0, pos), ...newArrays, ...array.slice(pos, array.length)] as T
}
