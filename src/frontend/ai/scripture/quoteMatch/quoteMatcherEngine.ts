import { get } from "svelte/store"
import type { DetectedReference } from "../../../../types/ai/AiScripture"
import { aiQuoteMatchActive, scriptures, scripturesCache } from "../../../stores"

// Inline text utility fallbacks
export function stripMarkdown(text: string): string {
    return text
        .replace(/(\*\*|__)(.*?)\1/g, "$2")
        .replace(/(\*|_)(.*?)\1/g, "$2")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .trim()
}

export function stripText(text: string): string {
    return text
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim()
}

// --- CONSTANTS & CONFIGURATION ---

export const PREFIX_LEN = 4
export const NUMBER_PLACEHOLDER = "#num"
export const PHONETIC_MIN_LEN = 6

export const TUNING = {
    WINDOW_TOKENS: 48,
    WINDOW_MAX_AGE_MS: 25000,
    GAP_RESET_MS: 15000,
    SEGMENT_TOKEN_CAP: 60,
    SPILL_TOKENS: 24,

    TOP_K: 8,
    TOP_TIE_BAND: 0.05,
    MIN_VOTE_KEYS: 2,
    MIN_VOTE_WEIGHT: 6,
    PHONETIC_VOTE_DISCOUNT: 0.7,

    DENSITY_REF: 0.7,
    DENSITY_FLOOR: 0.6,
    MIN_INFORMATIVE: 5,
    MIN_WEIGHT: 14,
    MIN_QUERY_SPAN: 6,
    FUZZY_MAX_FRACTION: 0.34,

    EMIT_MEDIUM: 0.52,
    EMIT_HIGH: 0.66,
    HIGH_MIN_INFORMATIVE: 6,
    HIGH_MIN_WEIGHT: 22,

    SINGLE_SHOT_INFORMATIVE: 8,
    SINGLE_SHOT_WEIGHT: 24,
    SUSTAIN_SEGMENTS: 2,
    CUE_WINDOW_MS: 12000,

    PHRASE_MIN_RUN: 3,
    PHRASE_SHOT_MIN_RUN: 5,
    PHRASE_SHOT_MIN_PEAKS: 2,
    PHRASE_GROWTH_MIN: 2,
    PHRASE_ADJACENCY_IDF: 2.2,
    PHRASE_MIN_WEIGHT: 16,
    PHRASE_HIGH_WEIGHT: 22,
    PHRASE_MIN_PEAK_IDF: 4,
    PHRASE_EDGE_MIN_IDF: 1.5,
    PHRASE_RIVAL_MARGIN: 4,

    CONT_MIN_INFORMATIVE: 4,
    CONT_MIN_WEIGHT: 10,
    CONT_DENSITY: 0.6,
    CONT_COVERAGE: 0.5,
    CONT_VERBATIM_DENSITY: 0.75,
    CONT_VERBATIM_COVERAGE: 0.8,
    CONT_VERBATIM_MATCHED: 6,

    ANCHOR_BONUS_Z0: 0.1,
    ANCHOR_BONUS_Z1: 0.05,
    ANCHOR_BONUS_Z2: 0.02,
    CROSS_BOOK_MARGIN: 0.12,
    CROSS_BOOK_MIN_INFORMATIVE: 7,
    TRACKER_ESCAPE_MARGIN: 0.25,
    CORRECTION_WEIGHT_RATIO: 1.6,
    TRACKER_TTL_MS: 20000,

    CONSENSUS_BONUS: 0.04,

    PASSAGE_MEMORY_MS: 240000,
    PASSAGE_MEMORY_MAX: 5,

    BIGRAM_VOTE_IDF: 3.5
}

export type Tuning = typeof TUNING

const NUMBER_UNITS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
const NUMBER_TEENS = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
const NUMBER_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

// --- TOKEN NORMALIZATION & PHONETICS ---

function baseTokens(text: string): string[] {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/[^\p{L}\p{N}\s']/gu, " ")
        .replace(/'/g, "")
        .split(/\s+/)
        .filter((token) => token.length > 1 || /^\d$/.test(token))
}

export function tokenizeVerseText(cleanText: string): string[] {
    return baseTokens(cleanText)
}

export interface SpannedToken {
    token: string
    from: number
    to: number
}

export function tokenizeTranscriptWithSpans(text: string): SpannedToken[] {
    const out: SpannedToken[] = []
    const push = (token: string, from: number, to: number) => out.push({ token, from, to })

    for (const match of text.matchAll(/[\p{L}\p{M}\p{N}']+/gu)) {
        const from = match.index ?? 0
        const to = from + match[0].length
        const token = match[0]
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .replace(/'/g, "")
        if (token.length < 1 || (token.length === 1 && !/^\d$/.test(token))) continue

        if (!/^\d+$/.test(token)) {
            push(token, from, to)
            continue
        }

        const value = parseInt(token, 10)
        if (value < 1 || value > 99) {
            push(NUMBER_PLACEHOLDER, from, to)
            continue
        }
        if (value < 10) push(NUMBER_UNITS[value], from, to)
        else if (value < 20) push(NUMBER_TEENS[value - 10], from, to)
        else {
            push(NUMBER_TENS[Math.floor(value / 10)], from, to)
            if (value % 10) push(NUMBER_UNITS[value % 10], from, to)
        }
    }
    return out
}

export function canonKey(token: string): string {
    return token.length > PREFIX_LEN ? token.slice(0, PREFIX_LEN) : token
}

const SOUNDEX_CLASS: Record<string, string> = {
    b: "1",
    f: "1",
    p: "1",
    v: "1",
    c: "2",
    g: "2",
    j: "2",
    k: "2",
    q: "2",
    s: "2",
    x: "2",
    z: "2",
    d: "3",
    t: "3",
    l: "4",
    m: "5",
    n: "5",
    r: "6"
}

export function phoneticKey(token: string): string | null {
    if (token.length < PHONETIC_MIN_LEN || token === NUMBER_PLACEHOLDER) return null

    const base = token.endsWith("s") ? token.slice(0, -1) : token
    let key = /^[aeiou]/.test(base) ? "a" : ""
    let previous = ""
    for (const char of base) {
        const cls = SOUNDEX_CLASS[char] || ""
        if (cls && cls !== previous) key += cls
        previous = cls
    }

    return key.length >= (key.startsWith("a") ? 4 : 3) ? key.slice(0, 8) : null
}

const PHONETIC_CACHE_MAX = 20000
const phoneticCache = new Map<string, string | null>()

export function cachedPhoneticKey(token: string): string | null {
    let key = phoneticCache.get(token)
    if (key === undefined) {
        if (phoneticCache.size >= PHONETIC_CACHE_MAX) phoneticCache.clear()
        phoneticCache.set(token, (key = phoneticKey(token)))
    }
    return key
}

const STEM_TAILS = new Set(["e", "s", "t", "st", "th", "es", "ed", "ee"])

const ASR_CONFUSABLE_SETS: string[][] = [
    ["season", "seasons", "ceasing"],
    ["altar", "alter"],
    ["prophet", "prophets", "profit", "profits"],
    ["morning", "mourning"],
    ["immortality", "immorality"],
    ["praise", "praises", "prays", "preys"],
    ["soul", "souls", "sole"],
    ["whole", "hole", "wholly", "holy"],
    ["weak", "week"],
    ["peace", "piece"],
    ["meet", "meat", "mete"],
    ["heir", "heirs", "air"],
    ["vain", "vein", "vane"],
    ["waist", "waste"],
    ["wait", "weight"],
    ["tale", "tail"],
    ["rite", "right", "write"],
    ["role", "roll"],
    ["seas", "sees", "seize"],
    ["made", "maid"],
    ["bread", "bred"],
    ["flour", "flower"],
    ["sword", "soared"],
    ["reign", "rain", "rein"],
    ["throne", "thrown"],
    ["heal", "heel"],
    ["idle", "idol", "idols"],
    ["fast", "vast"],
    ["bury", "berry"],
    ["psalm", "psalms", "palm", "palms"],
    ["manna", "manner", "manor"],
    ["leaven", "eleven"],
    ["pilate", "pilot"],
    ["hart", "harts", "heart"],
    ["fowl", "fowls", "foul"],
    ["strait", "straight"],
    ["vale", "veil", "vail"],
    ["plumb", "plum"],
    ["loins", "lions"],
    ["leper", "lepers", "leaper"],
    ["tithes", "tides"],
    ["gait", "gate", "gates"],
    ["hallowed", "hollowed"],
    ["cain", "cane"],
    ["spake", "spoke", "speak"],
    ["saith", "sayeth"],
    ["zeal", "seal", "seals"],
    ["alms", "arms"],
    ["pray", "prey"],
    ["knead", "need"],
    ["counsel", "council"],
    ["principal", "principle"],
    ["presence", "presents"],
    ["bear", "bare"],
    ["dear", "deer"],
    ["fair", "fare"],
    ["gilt", "guilt"],
    ["groan", "grown"],
    ["heard", "herd"],
    ["hoard", "horde"],
    ["days", "daze"],
    ["lessen", "lesson"],
    ["mail", "male"],
    ["main", "mane"],
    ["pain", "pane"],
    ["pair", "pear", "pare"],
    ["pour", "pore", "poor"],
    ["wrap", "rap"],
    ["wretch", "retch"],
    ["ring", "wring"],
    ["road", "rode", "rowed"],
    ["sail", "sale"],
    ["stake", "steak"],
    ["steal", "steel"],
    ["tears", "tiers"],
    ["wail", "whale"],
    ["wares", "wears"],
    ["weary", "wary"],
    ["wine", "whine"],
    ["dies", "dyes"],
    ["feat", "feet"],
    ["flee", "flea"],
    ["hail", "hale"],
    ["knight", "night"],
    ["earn", "urn"],
    ["sight", "site", "cite"],
    ["scent", "sent", "cent"],
    ["vice", "vise"],
    ["muscle", "mussel"],
    ["naval", "navel"],
    ["petal", "pedal"],
    ["plain", "plane"],
    ["root", "route"],
    ["anointing", "annoying"],
    ["manger", "major"],
    ["epistle", "pistol"],
    ["publican", "publicans", "republican"],
    ["gentile", "gentiles", "gentle"],
    ["martyr", "mortar"],
    ["faith", "fate"],
    ["esther", "ester"],
    ["dissent", "descent"],
    ["ascent", "ascend"]
]

const CONFUSABLE_CANON = new Map<string, string>()
const CONFUSABLE_GROUPS = new Map<string, string[]>()
for (const set of ASR_CONFUSABLE_SETS) {
    const touched = new Set<string>()
    for (const token of set) {
        const existing = CONFUSABLE_CANON.get(token)
        if (existing !== undefined) touched.add(existing)
    }
    const canon = touched.size ? [...touched][0] : set[0]
    const members = new Set<string>(CONFUSABLE_GROUPS.get(canon) ?? [])
    for (const other of touched) {
        if (other === canon) continue
        for (const member of CONFUSABLE_GROUPS.get(other) ?? []) members.add(member)
        CONFUSABLE_GROUPS.delete(other)
    }
    for (const token of set) members.add(token)
    const list = [...members]
    CONFUSABLE_GROUPS.set(canon, list)
    for (const member of list) CONFUSABLE_CANON.set(member, canon)
}

export function confusableAlternates(token: string): string[] {
    const canon = CONFUSABLE_CANON.get(token)
    if (canon === undefined) return []
    return (CONFUSABLE_GROUPS.get(canon) ?? []).filter((member) => member !== token)
}

function commonPrefixLength(a: string, b: string): number {
    const max = Math.min(a.length, b.length)
    let i = 0
    while (i < max && a[i] === b[i]) i++
    return i
}

export function tokenGrade(a: string, b: string, allowPhonetic = false): number {
    if (a === NUMBER_PLACEHOLDER || b === NUMBER_PLACEHOLDER) return 0
    if (a === b) return 1

    const cpl = commonPrefixLength(a, b)
    if (cpl >= PREFIX_LEN) {
        if (cpl === a.length || cpl === b.length) return 0.9
        if (a.length - cpl <= 4 && b.length - cpl <= 4) return 0.75
    }

    if (cpl === 3 && (cpl === a.length || cpl === b.length) && Math.max(a.length, b.length) - cpl <= 2) {
        const tail = (a.length > b.length ? a : b).slice(cpl)
        if (STEM_TAILS.has(tail)) return 0.8
    }

    if (allowPhonetic) {
        const canonA = CONFUSABLE_CANON.get(a)
        if (canonA !== undefined && canonA === CONFUSABLE_CANON.get(b)) return 0.85
    }

    if (allowPhonetic && a.length >= PHONETIC_MIN_LEN && b.length >= PHONETIC_MIN_LEN && Math.abs(a.length - b.length) <= 3) {
        const keyA = cachedPhoneticKey(a)
        if (keyA && keyA === cachedPhoneticKey(b)) return 0.7
    }
    return 0
}

// --- INDEX STRUCTURES & PAYLOADS ---

export interface IndexableVerse {
    book: number
    chapter: number
    verseStart: number
    verseEnd: number
    cleanText: string
}

export class PrefixPool {
    keys: string[] = []
    private idByKey = new Map<string, number>()

    intern(key: string): number {
        let id = this.idByKey.get(key)
        if (id === undefined) {
            id = this.keys.length
            this.keys.push(key)
            this.idByKey.set(key, id)
        }
        return id
    }

    lookup(key: string): number {
        const id = this.idByKey.get(key)
        return id === undefined ? -1 : id
    }

    get size(): number {
        return this.keys.length
    }

    get sizeBytes(): number {
        let bytes = 0
        for (const key of this.keys) bytes += key.length * 2 + 16
        return bytes + this.keys.length * 64
    }
}

export interface TranslationIndex {
    translationId: string
    pool: PrefixPool
    verseCount: number
    book: Uint8Array
    chapter: Uint8Array
    verseStart: Uint8Array
    verseEnd: Uint8Array
    chapterBreak: Uint8Array
    vocab: string[]
    idfByVocabId: Float32Array
    informativeIdf: number
    tokenData: Uint16Array | Uint32Array
    tokenOffsets: Uint32Array
    prefixDf: Uint32Array
    postingStarts: Uint32Array
    postingData: Uint32Array
    bigramPool?: PrefixPool
    bigramIds?: Uint32Array
    bigramStarts?: Uint32Array
    bigramData?: Uint32Array
    sizeBytes: number
}

export const IDF_CAP = 6
export const DF_VOTE_MAX_FRACTION = 1 / 16
const INFORMATIVE_IDF_ABSOLUTE = 3.0
const INFORMATIVE_IDF_FRACTION = 0.5
export const BIGRAM_VOTE_IDF = 5
export const bigramKey = (a: string, b: string) => a + "|" + b

export interface IndexBuildOptions {
    bigrams?: boolean
    bigramPool?: PrefixPool
}

export function buildTranslationIndex(translationId: string, verses: IndexableVerse[], pool: PrefixPool = new PrefixPool(), options: IndexBuildOptions = {}): TranslationIndex {
    const verseCount = verses.length
    const book = new Uint8Array(verseCount)
    const chapter = new Uint8Array(verseCount)
    const verseStart = new Uint8Array(verseCount)
    const verseEnd = new Uint8Array(verseCount)
    const chapterBreak = new Uint8Array(verseCount)

    const vocab: string[] = []
    const vocabIdByToken = new Map<string, number>()
    const dfByVocabId: number[] = []

    const tokenOffsets = new Uint32Array(verseCount + 1)
    const tokenIdsFlat: number[] = []

    const ordinalsByPrefixId = new Map<number, number[]>()

    for (let ordinal = 0; ordinal < verseCount; ordinal++) {
        const verse = verses[ordinal]
        book[ordinal] = verse.book
        chapter[ordinal] = verse.chapter
        verseStart[ordinal] = verse.verseStart
        verseEnd[ordinal] = Math.max(verse.verseStart, verse.verseEnd)
        chapterBreak[ordinal] = ordinal === 0 || verses[ordinal - 1].book !== verse.book || verses[ordinal - 1].chapter !== verse.chapter ? 1 : 0

        const tokens = tokenizeVerseText(verse.cleanText)
        const seenTokenIds = new Set<number>()
        const seenPrefixIds = new Set<number>()

        for (let i = 0; i < tokens.length; i++) {
            let id = vocabIdByToken.get(tokens[i])
            if (id === undefined) {
                id = vocab.length
                vocab.push(tokens[i])
                vocabIdByToken.set(tokens[i], id)
                dfByVocabId.push(0)
            }
            tokenIdsFlat.push(id)

            if (!seenTokenIds.has(id)) {
                seenTokenIds.add(id)
                dfByVocabId[id]++
            }

            const prefixId = pool.intern(canonKey(tokens[i]))
            if (!seenPrefixIds.has(prefixId)) {
                seenPrefixIds.add(prefixId)
                let list = ordinalsByPrefixId.get(prefixId)
                if (!list) ordinalsByPrefixId.set(prefixId, (list = []))
                list.push(ordinal)
            }
        }
        tokenOffsets[ordinal + 1] = tokenIdsFlat.length
    }

    const tokenData = vocab.length > 0xffff ? Uint32Array.from(tokenIdsFlat) : Uint16Array.from(tokenIdsFlat)

    const idfByVocabId = new Float32Array(vocab.length)
    let maxIdf = 0
    for (let id = 0; id < vocab.length; id++) {
        idfByVocabId[id] = Math.min(IDF_CAP, Math.log(1 + verseCount / dfByVocabId[id]))
        if (idfByVocabId[id] > maxIdf) maxIdf = idfByVocabId[id]
    }
    const informativeIdf = Math.min(INFORMATIVE_IDF_ABSOLUTE, INFORMATIVE_IDF_FRACTION * maxIdf)

    const phoneticIdByVocabId = new Int32Array(vocab.length).fill(-1)
    for (let id = 0; id < vocab.length; id++) {
        if (idfByVocabId[id] < informativeIdf) continue
        const key = phoneticKey(vocab[id])
        if (key) phoneticIdByVocabId[id] = pool.intern("~" + key)
    }
    for (let ordinal = 0; ordinal < verseCount; ordinal++) {
        let seenPhonetic: Set<number> | null = null
        for (let i = tokenOffsets[ordinal]; i < tokenOffsets[ordinal + 1]; i++) {
            const phoneticId = phoneticIdByVocabId[tokenIdsFlat[i]]
            if (phoneticId < 0 || seenPhonetic?.has(phoneticId)) continue
            ;(seenPhonetic ||= new Set()).add(phoneticId)
            let list = ordinalsByPrefixId.get(phoneticId)
            if (!list) ordinalsByPrefixId.set(phoneticId, (list = []))
            list.push(ordinal)
        }
    }

    const dfCap = Math.max(2, verseCount * DF_VOTE_MAX_FRACTION)
    const poolSize = pool.size
    const prefixDf = new Uint32Array(poolSize)
    const postingStarts = new Uint32Array(poolSize + 1)

    let postingTotal = 0
    ordinalsByPrefixId.forEach((ordinals, prefixId) => {
        prefixDf[prefixId] = ordinals.length
        if (ordinals.length <= dfCap) postingTotal += ordinals.length
    })

    const postingData = new Uint32Array(postingTotal)
    let cursor = 0
    for (let prefixId = 0; prefixId < poolSize; prefixId++) {
        postingStarts[prefixId] = cursor
        const ordinals = ordinalsByPrefixId.get(prefixId)
        if (ordinals && ordinals.length <= dfCap) {
            for (const ordinal of ordinals) postingData[cursor++] = ordinal
        }
    }
    postingStarts[poolSize] = cursor

    const index: TranslationIndex = {
        translationId,
        pool,
        verseCount,
        book,
        chapter,
        verseStart,
        verseEnd,
        chapterBreak,
        vocab,
        idfByVocabId,
        informativeIdf,
        tokenData,
        tokenOffsets,
        prefixDf,
        postingStarts,
        postingData,
        sizeBytes: 0
    }

    if (options.bigrams) {
        const droppedPrefix = (prefixId: number) => (ordinalsByPrefixId.get(prefixId)?.length || 0) > dfCap
        buildBigramRoute(index, options.bigramPool || new PrefixPool(), dfCap, droppedPrefix)
    }

    let sizeBytes = book.byteLength + chapter.byteLength + verseStart.byteLength + verseEnd.byteLength + chapterBreak.byteLength
    sizeBytes += tokenData.byteLength + tokenOffsets.byteLength + idfByVocabId.byteLength
    sizeBytes += prefixDf.byteLength + postingStarts.byteLength + postingData.byteLength
    sizeBytes += (index.bigramIds?.byteLength || 0) + (index.bigramStarts?.byteLength || 0) + (index.bigramData?.byteLength || 0)
    for (const token of vocab) sizeBytes += token.length * 2 + 16
    index.sizeBytes = sizeBytes

    return index
}

function buildBigramRoute(index: TranslationIndex, bigramPool: PrefixPool, dfCap: number, droppedPrefix: (prefixId: number) => boolean): void {
    const { pool, vocab, tokenData, tokenOffsets, verseCount } = index

    const canonByVocabId = vocab.map((token) => canonKey(token))
    const droppedByVocabId = canonByVocabId.map((key) => droppedPrefix(pool.lookup(key)))

    const ordinalsByBigramId = new Map<number, number[]>()
    for (let ordinal = 0; ordinal < verseCount; ordinal++) {
        let seen: Set<number> | null = null
        for (let i = tokenOffsets[ordinal] + 1; i < tokenOffsets[ordinal + 1]; i++) {
            const left = tokenData[i - 1]
            const right = tokenData[i]
            if (!droppedByVocabId[left] && !droppedByVocabId[right]) continue

            const bigramId = bigramPool.intern(bigramKey(canonByVocabId[left], canonByVocabId[right]))
            if (seen?.has(bigramId)) continue
            ;(seen ||= new Set()).add(bigramId)
            let list = ordinalsByBigramId.get(bigramId)
            if (!list) ordinalsByBigramId.set(bigramId, (list = []))
            list.push(ordinal)
        }
    }

    const keptIds: number[] = []
    let postingTotal = 0
    ordinalsByBigramId.forEach((ordinals, bigramId) => {
        if (ordinals.length > dfCap) return
        keptIds.push(bigramId)
        postingTotal += ordinals.length
    })
    keptIds.sort((a, b) => a - b)

    const bigramIds = Uint32Array.from(keptIds)
    const bigramStarts = new Uint32Array(keptIds.length + 1)
    const bigramData = new Uint32Array(postingTotal)
    let cursor = 0
    for (let i = 0; i < keptIds.length; i++) {
        bigramStarts[i] = cursor
        for (const ordinal of ordinalsByBigramId.get(keptIds[i])!) bigramData[cursor++] = ordinal
    }
    bigramStarts[keptIds.length] = cursor

    index.bigramPool = bigramPool
    index.bigramIds = bigramIds
    index.bigramStarts = bigramStarts
    index.bigramData = bigramData
}

export function bigramPostings(index: TranslationIndex, bigramId: number): Uint32Array | null {
    const ids = index.bigramIds
    if (!ids || bigramId < 0) return null

    let low = 0
    let high = ids.length - 1
    while (low <= high) {
        const mid = (low + high) >> 1
        if (ids[mid] === bigramId) return index.bigramData!.subarray(index.bigramStarts![mid], index.bigramStarts![mid + 1])
        if (ids[mid] < bigramId) low = mid + 1
        else high = mid - 1
    }
    return null
}

export function verseTokensAt(index: TranslationIndex, ordinal: number): Uint16Array | Uint32Array {
    return index.tokenData.subarray(index.tokenOffsets[ordinal], index.tokenOffsets[ordinal + 1])
}

export function postingsForKey(index: TranslationIndex, prefixId: number): Uint32Array | null {
    if (prefixId < 0 || prefixId >= index.postingStarts.length - 1) return null
    const start = index.postingStarts[prefixId]
    const end = index.postingStarts[prefixId + 1]
    return end > start ? index.postingData.subarray(start, end) : null
}

export function prefixIdf(index: TranslationIndex, prefixId: number): number {
    const df = prefixId >= 0 && prefixId < index.prefixDf.length ? index.prefixDf[prefixId] : 0
    if (!df) return 0
    return Math.min(IDF_CAP, Math.log(1 + index.verseCount / df))
}

export interface TranslationPayload {
    translationId: string
    book: Uint8Array
    chapter: Uint8Array
    verseStart: Uint8Array
    verseEnd: Uint8Array
    textBlob: string
    textOffsets: Uint32Array
}

export const INDEX_MEMORY_BUDGET_BYTES = 256 * 1024 * 1024

interface PayloadBible {
    books?: { number: number; chapters?: { number: number; verses?: { number: number; endNumber?: number; text?: string }[] }[] }[]
}

export function buildTranslationPayload(translationId: string, bible: PayloadBible): TranslationPayload | null {
    const book: number[] = []
    const chapter: number[] = []
    const verseStart: number[] = []
    const verseEnd: number[] = []
    const textParts: string[] = []
    const textOffsets: number[] = [0]
    let textLength = 0

    for (const bibleBook of bible.books || []) {
        for (const bibleChapter of bibleBook.chapters || []) {
            for (const verse of bibleChapter.verses || []) {
                book.push(bibleBook.number)
                chapter.push(bibleChapter.number)
                verseStart.push(verse.number)
                verseEnd.push(verse.endNumber ?? verse.number)

                const text = verse.text || ""
                textParts.push(text)
                textLength += text.length
                textOffsets.push(textLength)
            }
        }
    }

    if (!book.length) return null
    return {
        translationId,
        book: Uint8Array.from(book),
        chapter: Uint8Array.from(chapter),
        verseStart: Uint8Array.from(verseStart),
        verseEnd: Uint8Array.from(verseEnd),
        textBlob: textParts.join(""),
        textOffsets: Uint32Array.from(textOffsets)
    }
}

export function payloadTransferables(payloads: TranslationPayload[]): ArrayBuffer[] {
    const buffers: ArrayBuffer[] = []
    for (const payload of payloads) {
        buffers.push(payload.book.buffer as ArrayBuffer, payload.chapter.buffer as ArrayBuffer, payload.verseStart.buffer as ArrayBuffer, payload.verseEnd.buffer as ArrayBuffer, payload.textOffsets.buffer as ArrayBuffer)
    }
    return buffers
}

export interface IndexBuildContext {
    pool: PrefixPool
    bigramPool: PrefixPool
    usedBytes: number
    count: number
}

export function createIndexBuildContext(): IndexBuildContext {
    return { pool: new PrefixPool(), bigramPool: new PrefixPool(), usedBytes: 0, count: 0 }
}

export async function buildIndexesFromPayloads(payloads: TranslationPayload[], context: IndexBuildContext = createIndexBuildContext()): Promise<{ indexes: TranslationIndex[]; totalBytes: number }> {
    const indexes: TranslationIndex[] = []
    let budgetBytes = INDEX_MEMORY_BUDGET_BYTES - context.usedBytes

    for (const payload of payloads) {
        if (budgetBytes <= 0 && context.count) break

        const verses: IndexableVerse[] = []
        const verseCount = payload.textOffsets.length - 1
        for (let ordinal = 0; ordinal < verseCount; ordinal++) {
            verses.push({
                book: payload.book[ordinal],
                chapter: payload.chapter[ordinal],
                verseStart: payload.verseStart[ordinal],
                verseEnd: payload.verseEnd[ordinal],
                cleanText: stripMarkdown(stripText(payload.textBlob.slice(payload.textOffsets[ordinal], payload.textOffsets[ordinal + 1])))
            })
        }
        if (!verses.length) continue

        const index = buildTranslationIndex(payload.translationId, verses, context.pool, context.count === 0 ? { bigrams: true, bigramPool: context.bigramPool } : {})
        indexes.push(index)
        context.count++
        context.usedBytes += index.sizeBytes
        budgetBytes -= index.sizeBytes

        await new Promise((resolve) => setTimeout(resolve))
    }

    const totalBytes = context.usedBytes + (context.count ? context.pool.sizeBytes + context.bigramPool.sizeBytes : 0)
    return { indexes, totalBytes }
}

// --- ALIGNMENT SCORING ---

export interface QueryToken {
    token: string
    endMs: number
}

export interface AlignResult {
    score: number
    coverage: number
    density: number
    matched: number
    matchedInformative: number
    matchedWeight: number
    matchedFuzzy: number
    queryFrom: number
    queryTo: number
    verseFrom: number
    verseTo: number
    spillInformative: number
    verseLength: number
    bestRunLength: number
    bestRunWeight: number
    bestRunPeakIdf: number
    bestRunPeaks: number
    bestRunQueryFrom: number
    bestRunQueryTo: number
}

export function alignQuoteWindow(query: QueryToken[], index: TranslationIndex, ordinal: number, tuning: Tuning = TUNING): AlignResult | null {
    if (ordinal < 0 || ordinal >= index.verseCount || !query.length) return null
    const verseIds = verseTokensAt(index, ordinal)

    const verseLength = verseIds.length
    const next = ordinal + 1
    const spillIds = next < index.verseCount && index.book[next] === index.book[ordinal] ? verseTokensAt(index, next).subarray(0, tuning.SPILL_TOKENS) : new Uint16Array(0)

    const m = query.length
    const n = verseLength + spillIds.length
    const verseTokenAt = (j: number) => index.vocab[j < verseLength ? verseIds[j] : spillIds[j - verseLength]]
    const verseIdfAt = (j: number) => index.idfByVocabId[j < verseLength ? verseIds[j] : spillIds[j - verseLength]]

    const informativeIdf = index.informativeIdf

    const width = n + 1
    const dp = new Float32Array((m + 1) * width)
    for (let i = 1; i <= m; i++) {
        const q = query[i - 1].token
        for (let j = 1; j <= n; j++) {
            const skip = Math.max(dp[(i - 1) * width + j], dp[i * width + j - 1])
            const idf = verseIdfAt(j - 1)
            const grade = tokenGrade(q, verseTokenAt(j - 1), idf >= informativeIdf)
            const take = grade > 0 ? dp[(i - 1) * width + j - 1] + grade * idf : 0
            dp[i * width + j] = take > skip ? take : skip
        }
    }
    if (dp[m * width + n] <= 0) return null

    const matchedQ: number[] = []
    const matchedV: number[] = []
    let matchedWeight = 0
    let matchedInformative = 0
    let matchedFuzzy = 0
    let spillInformative = 0
    let i = m
    let j = n
    while (i > 0 && j > 0) {
        const idf = verseIdfAt(j - 1)
        const grade = tokenGrade(query[i - 1].token, verseTokenAt(j - 1), idf >= informativeIdf)
        if (grade > 0 && Math.abs(dp[i * width + j] - (dp[(i - 1) * width + j - 1] + grade * idf)) < 1e-6) {
            matchedQ.push(i - 1)
            matchedV.push(j - 1)
            matchedWeight += grade * idf
            if (grade < 0.9) matchedFuzzy++
            if (idf >= index.informativeIdf) {
                matchedInformative++
                if (j - 1 >= verseLength) spillInformative++
            }
            i--
            j--
        } else if (dp[(i - 1) * width + j] >= dp[i * width + j - 1]) i--
        else j--
    }
    if (!matchedQ.length) return null

    matchedQ.reverse()
    matchedV.reverse()

    const queryFrom = matchedQ[0]
    const queryTo = matchedQ[matchedQ.length - 1]
    const verseFrom = matchedV[0]
    const verseTo = matchedV[matchedV.length - 1]

    let bestRunLength = 0
    let bestRunWeight = 0
    let bestRunPeakIdf = 0
    let bestRunPeaks = 0
    let bestRunQueryFrom = -1
    let bestRunQueryTo = -1
    let runLength = 0
    let runWeight = 0
    let runPeakIdf = 0
    let runPeaks = 0
    let runQueryFrom = -1
    for (let k = 0; k < matchedQ.length; k++) {
        if (matchedV[k] >= verseLength) {
            runLength = 0
            runWeight = 0
            runPeakIdf = 0
            runPeaks = 0
            runQueryFrom = -1
            continue
        }
        const idf = verseIdfAt(matchedV[k])
        const grade = tokenGrade(query[matchedQ[k]].token, verseTokenAt(matchedV[k]), idf >= informativeIdf)
        const weight = grade * idf
        const peak = grade >= 0.9 ? idf : 0
        if (runLength > 0 && matchedQ[k] === matchedQ[k - 1] + 1 && matchedV[k] === matchedV[k - 1] + 1) {
            runLength++
            runWeight += weight + tuning.PHRASE_ADJACENCY_IDF
            if (peak > runPeakIdf) runPeakIdf = peak
            if (peak >= tuning.PHRASE_MIN_PEAK_IDF) runPeaks++
        } else {
            runLength = 1
            runWeight = weight
            runPeakIdf = peak
            runPeaks = peak >= tuning.PHRASE_MIN_PEAK_IDF ? 1 : 0
            runQueryFrom = matchedQ[k]
        }
        if (idf >= tuning.PHRASE_EDGE_MIN_IDF && runWeight > bestRunWeight) {
            bestRunLength = runLength
            bestRunWeight = runWeight
            bestRunPeakIdf = runPeakIdf
            bestRunPeaks = runPeaks
            bestRunQueryFrom = runQueryFrom
            bestRunQueryTo = matchedQ[k]
        }
    }

    let spanWeight = 0
    for (let v = verseFrom; v <= verseTo; v++) spanWeight += verseIdfAt(v)
    const coverage = spanWeight > 0 ? matchedWeight / spanWeight : 0

    const querySpan = queryTo - queryFrom + 1
    const density = matchedQ.length / querySpan
    const score = coverage * Math.min(1, density / tuning.DENSITY_REF)

    return {
        score,
        coverage,
        density,
        matched: matchedQ.length,
        matchedInformative,
        matchedWeight,
        matchedFuzzy,
        queryFrom,
        queryTo,
        verseFrom,
        verseTo,
        spillInformative,
        verseLength,
        bestRunLength,
        bestRunWeight,
        bestRunPeakIdf,
        bestRunPeaks,
        bestRunQueryFrom,
        bestRunQueryTo
    }
}

export function phraseEvidence(a: AlignResult, tuning: Tuning = TUNING): boolean {
    return a.bestRunLength >= tuning.PHRASE_MIN_RUN && a.bestRunWeight >= tuning.PHRASE_MIN_WEIGHT && a.bestRunPeakIdf >= tuning.PHRASE_MIN_PEAK_IDF
}

export function meetsFloors(a: AlignResult, tuning: Tuning = TUNING): boolean {
    if (a.matchedFuzzy > Math.floor(a.matched * tuning.FUZZY_MAX_FRACTION)) return false
    return a.matchedInformative >= tuning.MIN_INFORMATIVE && a.matchedWeight >= tuning.MIN_WEIGHT && a.queryTo - a.queryFrom + 1 >= tuning.MIN_QUERY_SPAN && a.density >= tuning.DENSITY_FLOOR
}

export function classify(a: AlignResult, tuning: Tuning = TUNING): "high" | "medium" | null {
    if (!meetsFloors(a, tuning)) return null
    if (a.score >= tuning.EMIT_HIGH && a.matchedInformative >= tuning.HIGH_MIN_INFORMATIVE && a.matchedWeight >= tuning.HIGH_MIN_WEIGHT) return "high"
    if (a.score >= tuning.EMIT_MEDIUM) return "medium"
    return null
}

// --- QUOTE MATCHER STATE ENGINE ---

export interface Segment {
    text: string
    startMs: number
    endMs: number
}

export interface EmissionAnchor {
    book: number
    chapter: number
    verseStart: number
    verseEnd: number
}

export interface QuoteMatchEmission {
    translationId: string
    book: number
    chapter: number
    verseStart: number
    verseEnd: number
    confidence: number
    kind: "passage" | "single_shot" | "phrase" | "continuation"
    quoteText: string
    corrects?: EmissionAnchor
}

interface MatchCandidate {
    index: TranslationIndex
    ordinal: number
    align: AlignResult
    votes: number
    rawWeight: number
}

export class QuoteMatcher {
    private indexes: TranslationIndex[] = []
    private tuning: Tuning
    private windowTokens: Array<QueryToken & { charFrom: number; charTo: number }> = []
    private rawTranscript = ""

    private trackerOrdinal = -1
    private trackerMs = 0

    private anchorRef: { bookNumber: number; chapter: number; verseStart: number; verseEnd: number } | null = null

    private lastEmittedKey = ""
    private lastEmittedMs = 0

    constructor(indexes: TranslationIndex[], tuning: Tuning = TUNING) {
        this.indexes = indexes
        this.tuning = tuning
    }

    get translationCount(): number {
        return this.indexes.length
    }

    public addIndexes(indexes: TranslationIndex[]): void {
        this.indexes = [...this.indexes, ...indexes]
    }

    public removeTranslations(ids: string[]): void {
        const removeSet = new Set(ids)
        this.indexes = this.indexes.filter((index) => !removeSet.has(index.translationId))
    }

    public reorderTranslations(order: string[]): void {
        const rank = new Map(order.map((id, index) => [id, index]))
        this.indexes.sort((a, b) => (rank.get(a.translationId) ?? this.indexes.length) - (rank.get(b.translationId) ?? this.indexes.length))
    }

    public setAnchor(anchor: { bookNumber: number; chapter: number; verseStart: number; verseEnd: number } | null): void {
        this.anchorRef = anchor
    }

    public onSegment(segment: Segment): QuoteMatchEmission[] {
        this.pruneWindow(segment.startMs)
        this.appendSegment(segment)

        if (this.windowTokens.length < this.tuning.MIN_QUERY_SPAN) return []

        const candidates = this.findCandidates()
        if (!candidates.length) return []

        return this.evaluateCandidates(candidates, segment.endMs)
    }

    private pruneWindow(nowMs: number): void {
        const minTime = nowMs - this.tuning.WINDOW_MAX_AGE_MS
        let dropCount = 0
        while (dropCount < this.windowTokens.length && this.windowTokens[dropCount].endMs < minTime) {
            dropCount++
        }

        if (this.windowTokens.length - dropCount > this.tuning.WINDOW_TOKENS) {
            dropCount = this.windowTokens.length - this.tuning.WINDOW_TOKENS
        }

        if (dropCount > 0) {
            const cutChar = this.windowTokens[dropCount - 1].charTo
            this.windowTokens = this.windowTokens.slice(dropCount)
            this.rawTranscript = this.rawTranscript.slice(cutChar)
            for (const token of this.windowTokens) {
                token.charFrom -= cutChar
                token.charTo -= cutChar
            }
        }
    }

    private appendSegment(segment: Segment): void {
        const baseCharOffset = this.rawTranscript.length
        this.rawTranscript += (baseCharOffset > 0 ? " " : "") + segment.text

        const spans = tokenizeTranscriptWithSpans(segment.text)
        const dt = spans.length > 1 ? (segment.endMs - segment.startMs) / spans.length : 0

        for (let i = 0; i < spans.length; i++) {
            const span = spans[i]
            this.windowTokens.push({
                token: span.token,
                endMs: Math.round(segment.startMs + dt * (i + 1)),
                charFrom: baseCharOffset + (baseCharOffset > 0 ? 1 : 0) + span.from,
                charTo: baseCharOffset + (baseCharOffset > 0 ? 1 : 0) + span.to
            })
        }
    }

    private findCandidates(): MatchCandidate[] {
        if (!this.indexes.length) return []
        const primary = this.indexes[0]
        const query = this.windowTokens

        const keyVotes = new Map<number, { votes: number; weight: number }>()
        const vote = (ordinal: number, weight: number) => {
            const entry = keyVotes.get(ordinal) || { votes: 0, weight: 0 }
            entry.votes++
            entry.weight += weight
            keyVotes.set(ordinal, entry)
        }

        for (let i = 0; i < query.length; i++) {
            const q = query[i].token
            const prefixId = primary.pool.lookup(canonKey(q))
            const postings = postingsForKey(primary, prefixId)
            const idf = prefixIdf(primary, prefixId)

            if (postings && idf > 0) {
                for (let k = 0; k < postings.length; k++) vote(postings[k], idf)
            }

            if (i > 0 && primary.bigramPool) {
                const prev = query[i - 1].token
                const bId = primary.bigramPool.lookup(bigramKey(canonKey(prev), canonKey(q)))
                const bPostings = bigramPostings(primary, bId)
                if (bPostings) {
                    for (let k = 0; k < bPostings.length; k++) vote(bPostings[k], this.tuning.BIGRAM_VOTE_IDF)
                }
            }

            const pKey = phoneticKey(q)
            if (pKey) {
                const pId = primary.pool.lookup("~" + pKey)
                const pPostings = postingsForKey(primary, pId)
                if (pPostings) {
                    const pIdf = prefixIdf(primary, pId) * this.tuning.PHONETIC_VOTE_DISCOUNT
                    for (let k = 0; k < pPostings.length; k++) vote(pPostings[k], pIdf)
                }
            }

            for (const alt of confusableAlternates(q)) {
                const altId = primary.pool.lookup(canonKey(alt))
                const altPostings = postingsForKey(primary, altId)
                if (altPostings) {
                    const altIdf = prefixIdf(primary, altId) * 0.8
                    for (let k = 0; k < altPostings.length; k++) vote(altPostings[k], altIdf)
                }
            }
        }

        const candidates: MatchCandidate[] = []
        keyVotes.forEach((meta, ordinal) => {
            if (meta.votes < this.tuning.MIN_VOTE_KEYS || meta.weight < this.tuning.MIN_VOTE_WEIGHT) return

            for (const index of this.indexes) {
                const align = alignQuoteWindow(query, index, ordinal, this.tuning)
                if (align && meetsFloors(align, this.tuning)) {
                    candidates.push({
                        index,
                        ordinal,
                        align,
                        votes: meta.votes,
                        rawWeight: meta.weight
                    })
                }
            }
        })

        candidates.sort((a, b) => b.align.score - a.align.score)
        return candidates.slice(0, this.tuning.TOP_K)
    }

    private evaluateCandidates(candidates: MatchCandidate[], nowMs: number): QuoteMatchEmission[] {
        const best = candidates[0]
        const bestClass = classify(best.align, this.tuning)

        if (!bestClass) return []

        let scoreAdjusted = best.align.score

        if (this.anchorRef && best.index.book[best.ordinal] === this.anchorRef.bookNumber) {
            if (best.index.chapter[best.ordinal] === this.anchorRef.chapter) {
                scoreAdjusted += this.tuning.ANCHOR_BONUS_Z0
            } else {
                scoreAdjusted += this.tuning.ANCHOR_BONUS_Z1
            }
        }

        const isPhrase = phraseEvidence(best.align, this.tuning)
        let kind: "passage" | "single_shot" | "phrase" | "continuation" = "single_shot"

        if (this.trackerOrdinal >= 0 && Math.abs(best.ordinal - this.trackerOrdinal) <= 2 && nowMs - this.trackerMs <= this.tuning.TRACKER_TTL_MS) {
            kind = "continuation"
        } else if (isPhrase) {
            kind = "phrase"
        } else if (best.align.matchedInformative >= this.tuning.SINGLE_SHOT_INFORMATIVE) {
            kind = "passage"
        }

        let correctsAnchor: EmissionAnchor | undefined = undefined
        if (this.trackerOrdinal >= 0 && best.index.book[best.ordinal] !== this.indexes[0].book[this.trackerOrdinal]) {
            correctsAnchor = {
                book: this.indexes[0].book[this.trackerOrdinal],
                chapter: this.indexes[0].chapter[this.trackerOrdinal],
                verseStart: this.indexes[0].verseStart[this.trackerOrdinal],
                verseEnd: this.indexes[0].verseEnd[this.trackerOrdinal]
            }
        }

        const currentKey = `${best.index.book[best.ordinal]}:${best.index.chapter[best.ordinal]}:${best.index.verseStart[best.ordinal]}`
        if (currentKey === this.lastEmittedKey && nowMs - this.lastEmittedMs < 10000) {
            return []
        }

        this.trackerOrdinal = best.ordinal
        this.trackerMs = nowMs
        this.lastEmittedKey = currentKey
        this.lastEmittedMs = nowMs

        const quoteText = this.extractQuoteText(best)

        return [
            {
                translationId: best.index.translationId,
                book: best.index.book[best.ordinal],
                chapter: best.index.chapter[best.ordinal],
                verseStart: best.index.verseStart[best.ordinal],
                verseEnd: best.index.verseEnd[best.ordinal],
                confidence: Math.min(1.0, scoreAdjusted),
                kind,
                quoteText,
                corrects: correctsAnchor
            }
        ]
    }

    private extractQuoteText(cand: MatchCandidate): string {
        const qFrom = cand.align.bestRunQueryFrom >= 0 ? cand.align.bestRunQueryFrom : cand.align.queryFrom
        const qTo = cand.align.bestRunQueryTo >= 0 ? cand.align.bestRunQueryTo : cand.align.queryTo

        if (qFrom >= 0 && qTo < this.windowTokens.length && qFrom <= qTo) {
            const charStart = this.windowTokens[qFrom].charFrom
            const charEnd = this.windowTokens[qTo].charTo
            return this.rawTranscript.slice(charStart, charEnd).trim()
        }
        return this.rawTranscript.trim()
    }
}

// --- HOSTS & WORKER COMMUNICATION ---

export interface MatcherHostCallbacks {
    onReady: (info: { count: number; totalBytes: number }) => void
    onUpdated?: (info: { count: number; added: number; removed: number; totalBytes: number }) => void
    onEmissions: (emissions: any[]) => void
    onError: (message: string) => void
}

export interface MatcherHost {
    start(payloads: TranslationPayload[], callbacks: MatcherHostCallbacks): void
    update(add: TranslationPayload[], remove: string[], order?: string[]): void
    segment(segment: { text: string; startMs: number; endMs: number }): void
    setAnchor(anchor: any): void
    stop(): void
}

export function createWorkerHost(): MatcherHost {
    const worker = new Worker(new URL("./quoteMatchWorker.ts", import.meta.url), { type: "module" })
    let callbacks: MatcherHostCallbacks | null = null

    const send = (message: any, transfer?: Transferable[]) => {
        try {
            if (transfer) worker.postMessage(message, transfer)
            else worker.postMessage(message)
        } catch (err) {
            callbacks?.onError(String((err as Error)?.message || err))
        }
    }

    worker.onmessage = (event: MessageEvent<any>) => {
        const message = event.data
        if (!message || !callbacks) return
        if (message.type === "ready") callbacks.onReady({ count: message.count, totalBytes: message.totalBytes })
        else if (message.type === "updated") callbacks.onUpdated?.({ count: message.count, added: message.added, removed: message.removed, totalBytes: message.totalBytes })
        else if (message.type === "emissions") callbacks.onEmissions(message.emissions)
        else if (message.type === "error") callbacks.onError(message.message)
    }

    worker.onerror = (event: ErrorEvent) => {
        callbacks?.onError(event.message || "Quote match worker failed")
    }

    return {
        start(payloads: TranslationPayload[], hostCallbacks) {
            callbacks = hostCallbacks
            send({ type: "start", translations: payloads }, payloadTransferables(payloads))
        },
        update(add: TranslationPayload[], remove: string[], order?: string[]) {
            send({ type: "update", add, remove, order }, payloadTransferables(add))
        },
        segment(segment) {
            send({ type: "segment", segment })
        },
        setAnchor(anchor) {
            send({ type: "anchor", anchor })
        },
        stop() {
            callbacks = null
            worker.terminate()
        }
    }
}

export function createDirectHost(): MatcherHost {
    let matcher: QuoteMatcher | null = null
    let callbacks: MatcherHostCallbacks | null = null
    let stopped = false
    let buildContext = createIndexBuildContext()

    return {
        start(payloads, hostCallbacks) {
            callbacks = hostCallbacks
            buildContext = createIndexBuildContext()
            buildIndexesFromPayloads(payloads, buildContext)
                .then(({ indexes, totalBytes }) => {
                    if (stopped) return
                    matcher = new QuoteMatcher(indexes)
                    hostCallbacks.onReady({ count: indexes.length, totalBytes })
                })
                .catch((err) => {
                    if (!stopped) hostCallbacks.onError(String((err as Error)?.message || err))
                })
        },
        update(add, remove, order) {
            const active = matcher
            if (!active || !callbacks) return
            active.removeTranslations(remove)
            buildIndexesFromPayloads(add, buildContext)
                .then(({ indexes, totalBytes }) => {
                    if (stopped) return
                    active.addIndexes(indexes)
                    if (order) active.reorderTranslations(order)
                    callbacks?.onUpdated?.({ count: active.translationCount, added: indexes.length, removed: remove.length, totalBytes })
                })
                .catch((err) => {
                    if (!stopped) callbacks?.onError(String((err as Error)?.message || err))
                })
        },
        segment(segment) {
            if (!matcher || !callbacks) return
            try {
                const emissions = matcher.onSegment(segment)
                if (emissions.length) callbacks.onEmissions(emissions)
            } catch (err) {
                callbacks.onError(String((err as Error)?.message || err))
            }
        },
        setAnchor(anchor) {
            matcher?.setAnchor(anchor)
        },
        stop() {
            stopped = true
            matcher = null
            callbacks = null
        }
    }
}

export async function createMatcherHost(): Promise<MatcherHost> {
    if (typeof Worker !== "undefined") {
        try {
            return createWorkerHost()
        } catch (err) {
            console.warn("[AiScripture] Quote match worker unavailable - matching on main thread:", err)
        }
    }
    return createDirectHost()
}

// --- SESSION LIFECYCLE MANAGEMENT ---

export interface QuoteMatchSessionConfig {
    bibleIds: string[]
    interpretationMode: boolean
    listenLanguage?: string
    onDetection: (ref: DetectedReference) => void
}

interface TranscriptSegment {
    text: string
    startMs: number
    endMs: number
    language?: string
    music?: boolean
}

let host: MatcherHost | null = null
let starting = false
let gate: { interpretationMode: boolean; listenLanguage?: string } | null = null
let onDetection: ((ref: DetectedReference) => void) | null = null
let pendingSegments: TranscriptSegment[] = []
let pendingAnchor: { bookNumber: number; chapter: number; verseStart: number; verseEnd: number } | null = null
let sessionToken = 0
let idCounter = 0
let currentBibleIds: string[] = []
let updateChain: Promise<void> = Promise.resolve()

const PENDING_SEGMENT_CAP = 50

export function startQuoteMatching(config: QuoteMatchSessionConfig): void {
    stopQuoteMatching()
    const token = ++sessionToken

    starting = true
    gate = { interpretationMode: config.interpretationMode, listenLanguage: config.listenLanguage }
    onDetection = config.onDetection

    void startSession(token, config.bibleIds)
}

export function stopQuoteMatching(): void {
    sessionToken++
    starting = false
    aiQuoteMatchActive.set(false)
    host?.stop()
    host = null
    gate = null
    onDetection = null
    pendingSegments = []
    pendingAnchor = null
    currentBibleIds = []
}

export function updateQuoteMatchBibles(bibleIds: string[]): void {
    if (!host || starting) {
        if (gate && onDetection) startQuoteMatching({ bibleIds, interpretationMode: gate.interpretationMode, listenLanguage: gate.listenLanguage, onDetection })
        return
    }

    const token = sessionToken
    updateChain = updateChain.then(() => updateSession(token, bibleIds)).catch(() => undefined)
}

async function updateSession(token: number, bibleIds: string[]): Promise<void> {
    if (token !== sessionToken) return

    const removed = currentBibleIds.filter((id) => !bibleIds.includes(id))
    const addedIds = bibleIds.filter((id) => !currentBibleIds.includes(id))

    const addPayloads = addedIds.length ? await buildPayloads(addedIds) : []
    if (token !== sessionToken) return

    const rank = new Map(bibleIds.map((id, position) => [id, position]))
    const nextIds = [...currentBibleIds.filter((id) => !removed.includes(id)), ...addPayloads.map((payload) => payload.translationId)].sort((a, b) => (rank.get(a) ?? bibleIds.length) - (rank.get(b) ?? bibleIds.length))
    if (!removed.length && !addPayloads.length && nextIds.join("|") === currentBibleIds.join("|")) return

    console.info(`[AiScripture] Session bibles changed - updating quote match indexes (+${addPayloads.length} / -${removed.length})`)
    currentBibleIds = nextIds
    host?.update(addPayloads, removed, nextIds)
}

export function handleQuoteMatchTranscript(segment: TranscriptSegment): void {
    if (!host && !starting) return

    if (segment.music) return
    if (gate?.interpretationMode && segment.language && gate.listenLanguage && segment.language !== gate.listenLanguage) return

    if (starting) {
        pendingSegments.push(segment)
        if (pendingSegments.length > PENDING_SEGMENT_CAP) pendingSegments.shift()
        return
    }

    feedSegment(segment)
}

export function setQuoteMatchAnchor(anchor: { bookNumber: number; chapter: number; verseStart: number; verseEnd: number }): void {
    pendingAnchor = anchor
    host?.setAnchor(anchor)
}

async function startSession(token: number, bibleIds: string[]): Promise<void> {
    try {
        const payloads = await buildPayloads(bibleIds)
        if (token !== sessionToken) return

        if (!payloads.length) {
            starting = false
            console.warn("[AiScripture] Quote matching inactive: none of the selected bibles have local verse text", bibleIds)
            return
        }

        const created = await createMatcherHost()
        if (token !== sessionToken) {
            created.stop()
            return
        }

        host = created
        currentBibleIds = payloads.map((payload) => payload.translationId)
        host.start(payloads, callbacksFor(token, payloads))
    } catch (err) {
        if (token !== sessionToken) return
        starting = false
        console.error("AI scripture quote matching failed to start:", err)
    }
}

function callbacksFor(token: number, fallbackPayloads: TranslationPayload[] | null): MatcherHostCallbacks {
    return {
        onReady: (info) => {
            if (token !== sessionToken) return
            starting = false
            console.info(`[AiScripture] Quote matching active: ${info.count} translation${info.count === 1 ? "" : "s"} indexed (${(info.totalBytes / 1024 / 1024).toFixed(1)} MB)`)
            aiQuoteMatchActive.set(true)
            if (pendingAnchor) host?.setAnchor(pendingAnchor)

            const buffered = pendingSegments
            pendingSegments = []
            for (const segment of buffered) feedSegment(segment)
        },
        onUpdated: (info) => {
            if (token !== sessionToken) return
            console.info(`[AiScripture] Quote match indexes updated: ${info.count} translation${info.count === 1 ? "" : "s"} indexed (+${info.added} / -${info.removed}, ${(info.totalBytes / 1024 / 1024).toFixed(1)} MB)`)
        },
        onEmissions: (emissions) => {
            if (token !== sessionToken || !onDetection) return
            for (const emission of emissions) {
                const detected = toDetectedReference(emission)
                if (detected) onDetection(detected)
            }
        },
        onError: (message) => {
            if (token !== sessionToken) return
            if (starting && fallbackPayloads) {
                console.warn("[AiScripture] Quote match worker failed - matching on the main thread:", message)
                host?.stop()
                host = createDirectHost()
                host.start(fallbackPayloads, callbacksFor(token, null))
                return
            }
            if (starting) {
                starting = false
                console.error("AI scripture quote matching failed to start:", message)
                return
            }
            console.error("AI scripture quote matching error:", message)
        }
    }
}

function feedSegment(segment: TranscriptSegment): void {
    host?.segment({ text: segment.text, startMs: segment.startMs, endMs: segment.endMs })
}

async function buildPayloads(bibleIds: string[]): Promise<TranslationPayload[]> {
    const payloads: TranslationPayload[] = []
    for (const id of bibleIds) {
        if (get(scriptures)[id]?.api) continue
        const bible = get(scripturesCache)[id]
        if (!bible?.books?.length) continue

        const payload = buildTranslationPayload(id, bible)
        if (payload) payloads.push(payload)
        await new Promise((resolve) => setTimeout(resolve))
    }
    return payloads
}

function toDetectedReference(emission: QuoteMatchEmission): DetectedReference | null {
    const id = "aiq-" + Date.now().toString(36) + "-" + (idCounter++).toString(36)
    if (emission.confidence < 50) return null

    return {
        id: id,
        book: bookNameFor(emission.translationId, emission.book),
        bookNumber: emission.book,
        chapter: emission.chapter,
        verseStart: emission.verseStart,
        verseEnd: emission.verseEnd,
        confidence: emission.confidence,
        type: "quoted",
        source: "local",
        quote: emission.quoteText,
        matchedBibleId: emission.translationId,
        continuation: emission.kind === "continuation" || undefined,
        corrects: emission.corrects ? { id, bookNumber: emission.corrects.book, chapter: emission.corrects.chapter, verseStart: emission.corrects.verseStart, verseEnd: emission.corrects.verseEnd } : undefined,
        timestamp: Date.now()
    }
}

export const CANON_BOOK_NAMES = [
    "",
    "Genesis",
    "Exodus",
    "Leviticus",
    "Numbers",
    "Deuteronomy",
    "Joshua",
    "Judges",
    "Ruth",
    "1 Samuel",
    "2 Samuel",
    "1 Kings",
    "2 Kings",
    "1 Chronicles",
    "2 Chronicles",
    "Ezra",
    "Nehemiah",
    "Esther",
    "Job",
    "Psalms",
    "Proverbs",
    "Ecclesiastes",
    "Song of Solomon",
    "Isaiah",
    "Jeremiah",
    "Lamentations",
    "Ezekiel",
    "Daniel",
    "Hosea",
    "Joel",
    "Amos",
    "Obadiah",
    "Jonah",
    "Micah",
    "Nahum",
    "Habakkuk",
    "Zephaniah",
    "Haggai",
    "Zechariah",
    "Malachi",
    "Matthew",
    "Mark",
    "Luke",
    "John",
    "Acts",
    "Romans",
    "1 Corinthians",
    "2 Corinthians",
    "Galatians",
    "Ephesians",
    "Philippians",
    "Colossians",
    "1 Thessalonians",
    "2 Thessalonians",
    "1 Timothy",
    "2 Timothy",
    "Titus",
    "Philemon",
    "Hebrews",
    "James",
    "1 Peter",
    "2 Peter",
    "1 John",
    "2 John",
    "3 John",
    "Jude",
    "Revelation"
]

export function bookNameFor(bibleId: string, bookNumber: number): string {
    const books = get(scripturesCache)[bibleId]?.books || []
    return books.find((book) => book.number === bookNumber)?.name || CANON_BOOK_NAMES[bookNumber] || String(bookNumber)
}
