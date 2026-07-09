export interface BibleContent {
    id: string
    isApi: boolean
    version: string
    metadata: { [key: string]: string }
    book: string
    bookAbbr: string
    bookId: string
    chapters: number[]
    bookNames?: string[] // book name per chapter (multiple books can be selected at once)
    verses: { [key: string]: string }[]
    activeVerses: (number | string)[][]
    attributionString: string
    attributionRequired: boolean
}
