export interface Bible {
  name: string
  books: {
    number: number
    name: string
    chapters: {
      number: number
      verses: {
        number: number
        value: string
      }[]
    }[]
  }[]
}
