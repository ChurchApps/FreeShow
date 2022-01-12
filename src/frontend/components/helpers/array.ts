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
  return array.find((a) => JSON.stringify(a) === JSON.stringify(data)) !== undefined
}

// OBJETS

// sort objects in array alphabeticly
export function sortObject(object: {}[], key: string, casesensitive: boolean = false): {}[] {
  return object.sort((a: any, b: any) => {
    let textA: string = a[key]
    let textB: string = b[key]
    if (!casesensitive) {
      textA = textA.toUpperCase()
      textB = textB.toUpperCase()
    }
    return textA < textB ? -1 : textA > textB ? 1 : 0
  })
}

// sort objects in array numerically
export function sortObjectNumbers(object: {}[], key: string, reverse: boolean = false): {}[] {
  return object.sort((a: any, b: any) => {
    return reverse ? b[key] - a[key] : a[key] - b[key]
  })
}

// move keys to IDs in object
export function keysToID(object: { [key: string]: {} }): any {
  let newObjects: {}[] = []
  Object.entries(object).forEach((obj) => newObjects.push({ id: obj[0], ...obj[1] }))
  return newObjects
}

// remove values in array object where key is value
export function removeValues(object: {}[], key: string, value: any): {}[] {
  return object.filter((o: any) => o[key] !== value)
}
