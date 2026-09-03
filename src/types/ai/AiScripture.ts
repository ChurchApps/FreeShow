import type { LlmSelection } from "./AiModels"

export interface DetectedReference {
    id: string
    book: string // canonical English book name (LLM) / matched book name (local)
    bookNumber: number // position in the 66 book Protestant canon when known, otherwise the matched bible's own book number
    chapter: number
    verseStart: number
    verseEnd: number
    confidence: "high" | "medium" | "low"
    type: "explicit" | "quoted"
    source: "regex" | "llm" | "local" // "local" = the renderer's quote matcher (no LLM involved)
    quote?: string // the transcript text that triggered the detection
    matchedBibleId?: string // set when quoted verse text matched a specific translation
    continuation?: boolean // a recitation flowing into the next verse of the live passage (follow-along)
    corrects?: { bookNumber: number; chapter: number; verseStart: number; verseEnd: number } // this detection supersedes an earlier similar-passage match (later words narrowed the search)
    timestamp: number
}

// book table handed from the renderer at start (merged from all selected translations)
export interface AiScriptureBook {
    number: number // book number as stored in the bible the names came from
    canonNumber?: number // position in the 66 book Protestant canon - set by the renderer for 66 book bibles (equal to number), undefined otherwise
    names: string[] // name/customName/abbreviations across the selected bibles
}

// scripture detection config handed from the renderer at start - engine/model/mic settings
// live in the generic STT layer (AiSettings.stt), so only detection concerns travel here
export interface AiScriptureDetectionConfig {
    books: AiScriptureBook[]
    llm: LlmSelection | null
    voiceCommands?: boolean
    translations?: AiScriptureTranslation[] // selected translations, for spoken translation switching
    language?: string // spoken language code, for voice command matching
    interpretationMode?: boolean // live interpretation: transcribe everything, only detect from listenLanguage
    listenLanguage?: string // language code scripture detection listens to when interpretationMode is on
}

export type AiScriptureState = "starting" | "listening" | "stopped" | "error" | "llm_paused"

// VOICE COMMANDS

// installed translations handed from the renderer at start, so spoken names ("NIV") can be resolved in the electron process
export interface AiScriptureTranslation {
    id: string
    names: string[]
}

export type AiScriptureCommand =
    | { type: "verse_next" }
    | { type: "verse_previous" }
    | { type: "chapter_next" }
    | { type: "chapter_previous" }
    | { type: "verse_jump"; verse: number; verseEnd?: number } // verseEnd: spoken range ("verses 1 to 5")
    | { type: "verse_add"; verse?: number } // extend the live selection ("add the next verse" / "add verse 6"); no verse = the next one
    | { type: "chapter_jump"; chapter: number; verse?: number; verseEnd?: number }
    | { type: "translation"; bibleId: string }
    | { type: "translation_cycle" }
    | { type: "translation_main" } // "give me the main translation" - back to the preferred one
    | { type: "restore" } // put back what was on the output before the AI projected
    | { type: "back"; book?: number } // previously shown passage; book = "go back to ephesians"
    | { type: "accept" } // "yes, show it" - project the newest suggestion (confirm mode by voice)

export type AiScriptureCommandEvent = AiScriptureCommand & { phrase: string }
