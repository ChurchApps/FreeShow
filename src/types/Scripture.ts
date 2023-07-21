export interface Bible {
    api?: boolean
    version: null | string
    copyright?: string
    id?: string
    book: null | string
    bookId?: string
    chapter: null | string
    verses: any
    activeVerses: string[]
}

export interface Version {
    id: string
    dblId: string
    relatedDbl: null
    name: string
    nameLocal: string
    abbreviation: string
    abbreviationLocal: string
    description: null | string
    descriptionLocal: null | string
    language: {
        id: string
        name: string
        nameLocal: string
        script: string
        scriptDirection: string
    }
    countries: {
        id: string
        name: string
        nameLocal: string
    }[]
    type: "text"
    updatedAt: string // date
    audioBibles: {
        id: string
        name: string
        nameLocal: string
        dblId: string
    }[]
}

export interface Book {
    abbreviation: string // "Gen"
    bibleId: string // "de4e12af7f28f599-01"
    id: string // "GEN"
    name: string // "Genesis"
    nameLong: string // "The First Book of Moses, called Genesis"
}

export interface Chapter {
    bibleId: string // "de4e12af7f28f599-01"
    bookId: string // "GEN"
    id: string // "GEN.intro"
    number: string // "intro"
    reference: string // "Genesis"
}

export interface Verse {
    bibleId: string //"de4e12af7f28f599-01"
    bookId: string // "GEN"
    chapterId: string // "GEN.1"
    id: string // "GEN.1.1"
    orgId: string // "GEN.1.1"
    reference: string // "Genesis 1:1"
}

export interface VerseText {
    bibleId: string // "de4e12af7f28f599-01"
    bookId: string // "GEN"
    chapterId: string // "GEN.1"
    content: string | string[][] // "<p class=\"p\"><span data-number=\"1\" data-sid=\"GEN 1:1\" class=\"v\">1</span>In the beginning God created the heaven and the earth. </p>"
    copyright: string // "\n          \n            PUBLIC DOMAIN except in the United Kingdom, where a Crown Copyright applies to printing the KJV. See http://www.cambridge.org/about-us/who-we-are/queens-printers-patent\n        "
    id: string // "GEN.1.1"
    next: {
        id: string
        number: string
    } // {id: "GEN.1.2", number: "2"}
    orgId: string // "GEN.1.1"
    previous: {
        id: string
        number: string
    } // {id: "GEN.intro.0", number: "0"}
    reference: string // "Genesis 1:1"
    verseCount: number // 1
}
