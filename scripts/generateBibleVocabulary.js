// AI AUTO SCRIPTURE - Bible vocabulary generator
//
// Scans a folder of FreeShow bibles (.fsb), merges every English translation, and generates
// src/electron/ai/speech/whisper/bibleVocabulary.ts: ranked biblical proper nouns (names, places,
// peoples) used to bias speech-to-text decoding toward words it would otherwise mishear.
//
// Usage: node scripts/generateBibleVocabulary.js [biblesFolder]
//   biblesFolder defaults to ~/Documents/FreeShow/Bibles
//   then: npx prettier --config config/formatting/.prettierrc.yaml --write src/electron/ai/speech/whisper/bibleVocabulary.ts
//
// A word counts as a proper noun when it appears capitalized mid-sentence at least twice and is
// capitalized in at least 90% of its occurrences. Translations are merged so spelling variants
// (Melchisedec/Melchizedek) and modern-only names (Xerxes, Negev) all survive.

const { existsSync, readdirSync, readFileSync, writeFileSync } = require("fs")
const { join } = require("path")
const os = require("os")

const biblesFolder = process.argv[2] || join(os.homedir(), "Documents", "FreeShow", "Bibles")
const outputPath = join(__dirname, "..", "src", "electron", "ai", "speech", "whisper", "bibleVocabulary.ts")

// every proper noun that survives the filters is kept - the runtime prompt composer applies its
// own character budget, and a name missing here (Junia, Andronicus - each spoken once, in
// Romans 16:7) can never be biased at all
const GLOBAL_RANKED_COUNT = Infinity
const PER_BOOK_COUNT = 30
// names this common are known to every STT model and would crowd every per-book list
const PER_BOOK_GLOBAL_EXCLUDE = 25
const MIN_NAME_LENGTH = 4
// single-translation words are usually artifacts unless clearly established by frequency
const MIN_TRANSLATIONS = 2
const MIN_SINGLE_TRANSLATION_FREQ = 50
// hyphenated compounds need broader support - sibling paraphrases (MSG + MSG 18) sharing a
// coinage must not count as independent confirmation
const MIN_HYPHENATED_TRANSLATIONS = 3

// hyphen-compound parts that mark a paraphrase construction ("All-Powerful", "Grain-Offering") rather than a name
const COMPOUND_STOP_PARTS = new Set(["all", "powerful", "offering", "offerings", "grain", "absolution", "burnt", "whole", "high", "strong", "most"])

// ordinary capitalized English words that pass the capitalization test but need no STT biasing
const STOPLIST = new Set(["meanwhile", "sovereign", "almighty", "musician", "musicians", "savior", "saviour", "scripture", "scriptures", "gentile", "gentiles", "sabbath", "passover", "heavens", "kingdom", "instead", "however", "suddenly", "finally", "immediately", "therefore", "message", "praise", "temple", "spirit", "father", "mother", "master", "teacher", "everyone", "listen", "look", "remember", "today", "long", "yes", "friend", "friends", "brother", "brothers"])

main()

function main() {
    if (!existsSync(biblesFolder)) {
        console.error("Bibles folder not found: " + biblesFolder)
        process.exit(1)
    }

    const files = readdirSync(biblesFolder).filter((file) => file.endsWith(".fsb"))
    if (!files.length) {
        console.error("No .fsb bibles in " + biblesFolder)
        process.exit(1)
    }

    // lower-case word -> aggregated stats across all English translations
    const words = new Map()
    const scanned = []
    const skipped = []

    for (const file of files) {
        let bible
        try {
            bible = JSON.parse(readFileSync(join(biblesFolder, file), "utf8"))[1]
        } catch (err) {
            skipped.push(file + " (unreadable: " + err.message + ")")
            continue
        }
        if (!bible || !Array.isArray(bible.books)) {
            skipped.push(file + " (unexpected format)")
            continue
        }
        if (!isEnglish(bible)) {
            skipped.push(file + " (not English)")
            continue
        }

        scanTranslation(bible, words)
        scanned.push(bible.name || file)
    }

    if (!scanned.length) {
        console.error("No English bibles found in " + biblesFolder)
        process.exit(1)
    }

    const names = collectProperNouns(words)
    const ranked = rankGlobal(names)
    const byBook = rankPerBook(names)

    writeFileSync(outputPath, renderModule(ranked, byBook, scanned))

    console.log("Scanned " + scanned.length + " English translations: " + scanned.join(", "))
    if (skipped.length) console.log("Skipped: " + skipped.join(", "))
    console.log("Proper nouns found: " + names.length)
    console.log("Wrote " + ranked.length + " ranked names + " + Object.keys(byBook).length + " per-book lists to " + outputPath)
}

// English detection: fraction of sampled verses containing very common English words.
// Catches traps like French bibles stored under English-looking names (Darby.fsb, KJF.fsb),
// while loose paraphrases (MSG) still pass.
function isEnglish(bible) {
    const commonEnglish = /\b(the|and|of|to|that|in)\b/i
    let sampled = 0
    let hits = 0
    for (const book of bible.books) {
        for (const chapter of book.chapters || []) {
            for (const verse of chapter.verses || []) {
                if (typeof verse.text !== "string") continue
                sampled++
                if (commonEnglish.test(verse.text)) hits++
                if (sampled >= 2000) return hits / sampled >= 0.5
            }
        }
    }
    return sampled > 0 && hits / sampled >= 0.5
}

function scanTranslation(bible, words) {
    const wordRegex = /[A-Za-z][A-Za-z'-]*/g
    const seenInTranslation = new Set()

    for (const book of bible.books) {
        const bookNumber = book.number
        for (const chapter of book.chapters || []) {
            for (const verse of chapter.verses || []) {
                if (typeof verse.text !== "string") continue
                const text = cleanVerseText(verse.text)

                let match
                while ((match = wordRegex.exec(text))) {
                    const raw = normalizeWord(match[0])
                    if (!raw) continue
                    const lower = raw.toLowerCase()

                    let entry = words.get(lower)
                    if (!entry) words.set(lower, (entry = { cap: 0, low: 0, mid: 0, translations: 0, byBook: new Map(), forms: new Map() }))

                    if (/^[A-Z]/.test(raw)) {
                        entry.cap++
                        entry.byBook.set(bookNumber, (entry.byBook.get(bookNumber) || 0) + 1)
                        entry.forms.set(raw, (entry.forms.get(raw) || 0) + 1)
                        if (!isSentenceStart(text, match.index)) entry.mid++
                        if (!seenInTranslation.has(lower)) {
                            seenInTranslation.add(lower)
                            entry.translations++
                        }
                    } else {
                        entry.low++
                    }
                }
            }
        }
    }
}

function cleanVerseText(text) {
    return text
        .replace(/<[^>]*>/g, " ") // markup (Strong's tags etc.)
        .replace(/\[[^\]]*\]/g, " ") // editorial brackets
        .replace(/[¶—–]/g, " ")
}

function normalizeWord(word) {
    let out = word
        .replace(/'s?$/i, "")
        .replace(/[-']+$/, "")
        .replace(/^[-']+/, "")
    if (out.includes("'")) return null // contractions (I'm, don't) are never names
    const hyphens = (out.match(/-/g) || []).length
    if (hyphens > 1) return null // paraphrase compounds ("God-of-the-angel-armies")
    if (out.length < 2) return null
    return out
}

function isSentenceStart(text, index) {
    if (index === 0) return true
    const before = text.slice(Math.max(0, index - 3), index)
    return /[.!?:;"']\s*$/.test(before) || /^\s*$/.test(text.slice(0, index))
}

function collectProperNouns(words) {
    const names = []
    for (const [lower, entry] of words) {
        if (lower.length < MIN_NAME_LENGTH) continue
        if (STOPLIST.has(lower.replace(/-/g, ""))) continue
        if (entry.mid < 2) continue
        if (entry.cap / (entry.cap + entry.low) < 0.9) continue
        if (entry.translations < MIN_TRANSLATIONS && entry.cap < MIN_SINGLE_TRANSLATION_FREQ) continue
        if (lower.includes("-")) {
            // real hyphenated names (Ben-hadad) appear across the classic translations, while
            // paraphrase coinages ("God-bashers", "Band-Aid") live in one loose family and are
            // built from everyday words - words the corpus mostly saw in lowercase
            if (entry.translations < MIN_HYPHENATED_TRANSLATIONS) continue
            if (lower.split("-").some((part) => COMPOUND_STOP_PARTS.has(part))) continue
            const everydayPart = lower.split("-").some((part) => {
                const partEntry = words.get(part)
                return partEntry && partEntry.low > partEntry.cap
            })
            if (everydayPart) continue
        }

        // most frequent surface form wins (proper capitalization for the STT prompt); stylized
        // all-caps renderings (UPHARSIN) fold back to title case
        let bestForm = ""
        let bestCount = 0
        for (const [form, count] of entry.forms) {
            if (count > bestCount) {
                bestForm = form
                bestCount = count
            }
        }
        if (bestForm.length > 3 && bestForm === bestForm.toUpperCase()) bestForm = bestForm[0] + bestForm.slice(1).toLowerCase()

        names.push({ name: bestForm, lower, freq: entry.cap, byBook: entry.byBook })
    }
    return dropTruncationDebris(names)
}

// hyphenation/footnote splits leave prefixes of real names behind ("Nebuchadnez", "Chalde",
// "Azari") - a name that is a strict prefix of a far more frequent longer name is debris.
// Genuine short variants survive because their frequencies are comparable (Junia/Junias)
function dropTruncationDebris(names) {
    const byPrefixable = [...names].sort((a, b) => a.lower.length - b.lower.length)
    const kept = []
    for (const entry of byPrefixable) {
        const debris = names.some((other) => other.lower.length > entry.lower.length && other.lower.startsWith(entry.lower) && other.freq >= entry.freq * 20)
        if (!debris) kept.push(entry)
    }
    return kept
}

// complexity first (long or hyphenated names are what STT garbles), frequency within each tier
function complexityTier(name) {
    if (name.length >= 8 || name.includes("-")) return 0
    if (name.length >= 6) return 1
    return 2
}

function rankGlobal(names) {
    return [...names]
        .sort((a, b) => complexityTier(a.name) - complexityTier(b.name) || b.freq - a.freq)
        .slice(0, GLOBAL_RANKED_COUNT)
        .map((entry) => entry.name)
}

function rankPerBook(names) {
    const globallyCommon = new Set(
        [...names]
            .sort((a, b) => b.freq - a.freq)
            .slice(0, PER_BOOK_GLOBAL_EXCLUDE)
            .map((entry) => entry.lower)
    )

    const byBook = {}
    for (let bookNumber = 1; bookNumber <= 66; bookNumber++) {
        // rarest first: the book lists exist for the names STT has barely ever seen (Junia,
        // Andronicus - Romans 16's greetings), while frequent hard names (Nebuchadnezzar) already
        // arrive through the global ranking. A frequency-first sort filled every list with names
        // whisper knows and dropped the once-mentioned ones - the very names that need biasing
        const inBook = names
            .filter((entry) => (entry.byBook.get(bookNumber) || 0) > 0 && !globallyCommon.has(entry.lower) && entry.name.length >= 5)
            .sort((a, b) => a.freq - b.freq || complexityTier(a.name) - complexityTier(b.name) || (b.byBook.get(bookNumber) || 0) - (a.byBook.get(bookNumber) || 0))
            .slice(0, PER_BOOK_COUNT)
            .map((entry) => entry.name)
        if (inBook.length) byBook[bookNumber] = inBook
    }
    return byBook
}

function renderModule(ranked, byBook, scanned) {
    const lines = []
    lines.push("// AI AUTO SCRIPTURE - biblical proper nouns for speech-to-text vocabulary biasing")
    lines.push("// GENERATED FILE - do not edit. Regenerate with: node scripts/generateBibleVocabulary.js")
    lines.push("// Sources: " + scanned.join(", "))
    lines.push("")
    lines.push("/** Biblical names/places/peoples ranked hardest-to-transcribe first (complexity, then frequency). */")
    lines.push("export const BIBLE_NAMES_RANKED: string[] = [")
    for (let i = 0; i < ranked.length; i += 10) {
        lines.push(
            "    " +
                ranked
                    .slice(i, i + 10)
                    .map((name) => JSON.stringify(name))
                    .join(", ") +
                ","
        )
    }
    lines.push("]")
    lines.push("")
    lines.push("/** The most frequent distinctive names per bible book (1-66), for passage-aware prompts. */")
    lines.push("export const BIBLE_NAMES_BY_BOOK: Record<number, string[]> = {")
    for (const bookNumber of Object.keys(byBook)) {
        lines.push("    " + bookNumber + ": [" + byBook[bookNumber].map((name) => JSON.stringify(name)).join(", ") + "],")
    }
    lines.push("}")
    lines.push("")
    return lines.join("\n")
}
