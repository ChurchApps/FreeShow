export interface Bible {
    id?: string
    name: string
    metadata?: { [key: string]: string }
    copyright?: string // displayed in the drawer
    books: {
        number: number
        customName?: string // many XML book names are not correct
        name: string
        abbreviation?: string
        chapters: {
            number: number
            verses: {
                number: number
                value?: string
                text: string
            }[]
        }[]
    }[]
}
