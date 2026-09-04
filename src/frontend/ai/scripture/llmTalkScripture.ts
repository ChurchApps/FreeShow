import { createLLMTalk } from "../llm/llmTalk"
import type { AIProviderId } from "../models"

export interface RawDetection {
    book: string
    bookNumber: number
    chapter: number
    verseStart: number
    verseEnd: number
    confidence: number
    type: "explicit" | "quoted"
    quote?: string
}

export interface AIDetectionRequest {
    transcript: string
    alreadyDetected: string[]
    liveContext?: string
}

export const DETECTION_PROMPT = `You detect Bible references in a live, imperfect speech transcript from a sermon. The transcript comes from automatic speech recognition and contains errors, missing punctuation, and mid-sentence cuts.

Report a reference only in these two cases:
1. "explicit" - the speaker names a passage (e.g. "John chapter 3 verse 16", "verses 28 through 30 of Romans 8", "back to our text in First Corinthians 13"). Spoken forms vary: "first/second/third" for numbered books, chapter-only mentions, verse ranges, references split across sentences, and bare number pairs - "Matthew 12 4", "Matthew 12, 4" or "Matthew 12-4" all mean Matthew 12:4. If only a chapter is named with no verse, report verseStart 1 and verseEnd 1 - with confidence 90+ when the speaker clearly directs listeners to it ("turn to", "open your bibles to"), otherwise 40-50.
2. "quoted" - the speaker recites or closely paraphrases the wording of a specific, identifiable verse (e.g. "for God so loved the world, that he gave..."). Only report a quote when the wording clearly matches one specific verse or contiguous verse range. Do not report mere allusions, themes, or story retellings. For quoted references, include the spoken words in the "quote" field.

Rules:
- bookNumber is the book's position in the 66-book Protestant canon (Genesis=1, Malachi=39, Matthew=40, Revelation=66). book is the canonical English name.
- The transcript may be in any language, and book names may be localized. Always output the canonical English name and the correct bookNumber.
- verseEnd equals verseStart for a single verse; for a range, verseEnd is the last verse.
- Do not report a reference that appears in the already-detected list unless the speaker has moved to a different verse or range.
- The end of the transcript may cut off mid-reference. If a reference is incomplete (book named but no chapter or verse yet), do not report it - it will complete in a later window.
- confidence: a percentage number from 1 to 100. 85-100 = unambiguous explicit reference or verbatim quote; 50-84 = clear but with minor ASR garbling or slight paraphrase; 1-49 = plausible but uncertain.
- If there are no references, return an empty references array.`

export const DETECTION_SCHEMA = {
    type: "object",
    properties: {
        references: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    book: { type: "string" },
                    bookNumber: { type: "integer" },
                    chapter: { type: "integer" },
                    verseStart: { type: "integer" },
                    verseEnd: { type: "integer" },
                    confidence: { type: "integer", minimum: 1, maximum: 100 },
                    type: { type: "string", enum: ["explicit", "quoted"] },
                    quote: { type: "string" }
                },
                required: ["book", "bookNumber", "chapter", "verseStart", "verseEnd", "confidence", "type", "quote"],
                additionalProperties: false
            }
        }
    },
    required: ["references"],
    additionalProperties: false
}

export function buildUserContent(req: AIDetectionRequest): string {
    const alreadyDetected = req.alreadyDetected.length ? req.alreadyDetected.join(", ") : "none"
    const liveContext = req.liveContext ? `${req.liveContext}\n\n` : ""
    return `${liveContext}Already detected (do not repeat): ${alreadyDetected}\n\n\`\`\`\n${req.transcript}\n\`\`\``
}

export function parseDetectionResponse(text: any): RawDetection[] {
    if (typeof text !== "string") throw new Error("No text content in the response")

    let parsed: any
    try {
        parsed = JSON.parse(text)
    } catch {
        throw new Error("Response is not valid JSON")
    }

    if (!Array.isArray(parsed?.references)) throw new Error("Response is missing the references array")

    return parsed.references.map(toRawDetection).filter(Boolean) as RawDetection[]
}

function toRawDetection(entry: any): RawDetection | null {
    if (!isValidDetection(entry)) return null

    return {
        book: entry.book,
        bookNumber: entry.bookNumber,
        chapter: entry.chapter,
        verseStart: entry.verseStart,
        verseEnd: entry.verseEnd,
        confidence: entry.confidence,
        type: entry.type,
        ...(typeof entry.quote === "string" && entry.quote ? { quote: entry.quote } : {})
    }
}

function isPositiveInteger(value: any): boolean {
    return Number.isInteger(value) && value > 0
}

function isValidDetection(entry: any): boolean {
    if (!entry || typeof entry !== "object") return false
    return typeof entry.book === "string" && !!entry.book && isPositiveInteger(entry.bookNumber) && entry.bookNumber <= 66 && isPositiveInteger(entry.chapter) && isPositiveInteger(entry.verseStart) && isPositiveInteger(entry.verseEnd) && Number.isInteger(entry.confidence) && entry.confidence >= 1 && entry.confidence <= 100 && (entry.type === "explicit" || entry.type === "quoted")
}

export function getLLMScriptureProvider(providerId: AIProviderId) {
    return {
        id: providerId,
        detectScripture: async (model: string, req: AIDetectionRequest, signal?: AbortSignal) => {
            if (signal?.aborted) throw new Error("Aborted")

            const llm = createLLMTalk(providerId, model)

            const response = await llm.completeJson<{ references: RawDetection[] }>(
                {
                    systemPrompt: DETECTION_PROMPT,
                    prompt: buildUserContent(req),
                    jsonSchema: DETECTION_SCHEMA
                },
                (json) => ({
                    references: (Array.isArray(json?.references) ? json.references : []).map(toRawDetection).filter(Boolean) as RawDetection[]
                }),
                signal
            )

            if (signal?.aborted) throw new Error("Aborted")
            if (response.error) throw new Error(response.error)

            return { references: response.parsed?.references || [] }
        }
    }
}
