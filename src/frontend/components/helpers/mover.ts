export function getIndexes(array: any[]): number[] {
    return array.map((a) => a.index).sort((a: any, b: any) => b - a)
}

export function mover(array: any[], selected: number[], pos: number): any[] {
    let moved: any[] = [],
        newArray: any[] = [],
        newPos: number = pos || 0

    array.forEach((a, i) => {
        if (selected.includes(i)) {
            if (i < pos) newPos--
            moved.push(a)
        } else newArray.push(a)
    })

    return addToPos(newArray, moved, newPos)
}

export function addToPos(array: any[], newArrays: any[], pos: number): any[] {
    return [...array.slice(0, pos), ...newArrays, ...array.slice(pos, array.length)]
}
