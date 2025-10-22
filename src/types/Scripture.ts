export interface BibleContent {
    id: string
    isApi: boolean
    version: string
    metadata: { [key: string]: string }
    book: string
    bookId: string
    chapter: number
    verses: { [key: string]: string }
    activeVerses: number[]
    attributionString: string
    attributionRequired: boolean
}