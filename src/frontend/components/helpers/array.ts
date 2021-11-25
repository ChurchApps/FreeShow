// move data in array at given indexes to new pos
export function groupToPos(array: any[], group: number[], pos: number): any[] {
  let temp: any[] = []
  group.forEach((i) => {
    temp.push(array.splice(i, 1)[0])
  })
  return [...array.slice(0, pos), ...temp, ...array.slice(pos, array.length)]
}

// add data to array at new pos
export function dataToPos(array: any[], data: any[], pos: number): any[] {
  return [...array.slice(0, pos), ...data, ...array.slice(pos, array.length)]
}
