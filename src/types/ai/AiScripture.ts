export interface DetectedReference {
    id: string
    book: string // canonical English book name (LLM) / matched book name (local)
    bookNumber: number // position in the 66 book Protestant canon when known, otherwise the matched bible's own book number
    chapter: number
    verseStart: number
    verseEnd: number
    confidence: number // 1-100: confidence score for the detection
    type: "explicit" | "quoted"
    source: "regex" | "llm" | "local" // "local" = the renderer's quote matcher (no LLM involved)
    quote?: string // the transcript text that triggered the detection
    matchedBibleId?: string // set when quoted verse text matched a specific translation
    continuation?: boolean // a recitation flowing into the next verse of the live passage (follow-along)
    corrects?: { id: string; bookNumber: number; chapter: number; verseStart: number; verseEnd: number } // this detection supersedes an earlier similar-passage match (later words narrowed the search)
    timestamp: number
}

export interface AiScriptureBook {
    number: number // book number as stored in the bible the names came from
    canonNumber?: number // position in the 66 book Protestant canon - set by the renderer for 66 book bibles (equal to number), undefined otherwise
    names: string[] // name/customName/abbreviations across the selected bibles
}

// VOICE COMMANDS

// installed translations handed from the renderer at start, so spoken names ("NIV") can be resolved in the electron process
export interface AiScriptureTranslation {
    id: string
    names: string[]
}
