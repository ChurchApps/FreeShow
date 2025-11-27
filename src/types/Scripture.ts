export interface BibleContent {
    id: string
    isApi: boolean
    version: string
    metadata: { [key: string]: string }
    book: string
    bookId: string
    chapters: number[]
    verses: { [key: string]: string }[]
    activeVerses: (number | string)[][]
    attributionString: string
    attributionRequired: boolean
}
