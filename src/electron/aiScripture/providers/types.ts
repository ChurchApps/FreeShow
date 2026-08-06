// AI AUTO SCRIPTURE: shared LLM provider contracts, the detection prompt/schema & error normalization

import type { AIError, AIErrorCode, AIProviderId } from "../../../types/AiScripture"

export interface RawDetection {
    book: string // canonical English book name
    bookNumber: number // position in the 66 book Protestant canon
    chapter: number
    verseStart: number
    verseEnd: number
    confidence: "high" | "medium" | "low"
    type: "explicit" | "quoted"
    quote?: string // the spoken words that triggered a "quoted" detection
}

export interface AIDetectionRequest {
    transcript: string
    alreadyDetected: string[] // formatted references already reported (e.g. "John 3:16-17")
    liveContext?: string // one-line anchor hint for the passage currently live on the output
}

export interface AIProvider {
    id: AIProviderId
    detectScripture(apiKey: string, model: string, req: AIDetectionRequest, signal: AbortSignal): Promise<{ references: RawDetection[] }>
    testConnection(apiKey: string, model: string): Promise<{ ok: true } | { ok: false; error: AIError }>
}

export const REQUEST_TIMEOUT = 12000

// identical for all providers - keep in sync with the JSON schema below
export const DETECTION_PROMPT = `You detect Bible references in a live, imperfect speech transcript from a sermon. The transcript comes from automatic speech recognition and contains errors, missing punctuation, and mid-sentence cuts.

Report a reference only in these two cases:
1. "explicit" - the speaker names a passage (e.g. "John chapter 3 verse 16", "verses 28 through 30 of Romans 8", "back to our text in First Corinthians 13"). Spoken forms vary: "first/second/third" for numbered books, chapter-only mentions, verse ranges, and references split across sentences. If only a chapter is named with no verse, report verseStart 1 and verseEnd 1 with confidence "low".
2. "quoted" - the speaker recites or closely paraphrases the wording of a specific, identifiable verse (e.g. "for God so loved the world, that he gave..."). Only report a quote when the wording clearly matches one specific verse or contiguous verse range. Do not report mere allusions, themes, or story retellings. For quoted references, include the spoken words in the "quote" field.

Rules:
- bookNumber is the book's position in the 66-book Protestant canon (Genesis=1, Malachi=39, Matthew=40, Revelation=66). book is the canonical English name.
- The transcript may be in any language, and book names may be localized. Always output the canonical English name and the correct bookNumber.
- verseEnd equals verseStart for a single verse; for a range, verseEnd is the last verse.
- Do not report a reference that appears in the already-detected list unless the speaker has moved to a different verse or range.
- The end of the transcript may cut off mid-reference. If a reference is incomplete (book named but no chapter or verse yet), do not report it - it will complete in a later window.
- confidence: "high" = unambiguous explicit reference or verbatim quote; "medium" = clear but with minor ASR garbling or slight paraphrase; "low" = plausible but uncertain.
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
                    confidence: { type: "string", enum: ["high", "medium", "low"] },
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

// Gemini's responseSchema (OpenAPI subset) rejects additionalProperties
export function schemaWithoutAdditionalProperties(schema: any): any {
    if (Array.isArray(schema)) return schema.map(schemaWithoutAdditionalProperties)
    if (!schema || typeof schema !== "object") return schema

    const copy: any = {}
    Object.keys(schema).forEach((key) => {
        if (key === "additionalProperties") return
        copy[key] = schemaWithoutAdditionalProperties(schema[key])
    })
    return copy
}

export function buildUserContent(req: AIDetectionRequest): string {
    const alreadyDetected = req.alreadyDetected.length ? req.alreadyDetected.join(", ") : "none"
    const liveContext = req.liveContext ? req.liveContext + "\n\n" : ""
    return liveContext + "Already detected (do not repeat): " + alreadyDetected + "\n\n```\n" + req.transcript + "\n```"
}

// parse & defensively validate the model's JSON output - throws AIError shaped objects
export function parseDetectionResponse(text: any): RawDetection[] {
    if (typeof text !== "string") throw { code: "bad_response", message: "No text content in the response" } as AIError

    let parsed: any
    try {
        parsed = JSON.parse(text)
    } catch {
        throw { code: "bad_response", message: "Response is not valid JSON" } as AIError
    }

    if (!Array.isArray(parsed?.references)) throw { code: "bad_response", message: "Response is missing the references array" } as AIError

    const references: RawDetection[] = []
    parsed.references.forEach((entry: any) => {
        if (!isValidDetection(entry)) return

        const detection: RawDetection = {
            book: entry.book,
            bookNumber: entry.bookNumber,
            chapter: entry.chapter,
            verseStart: entry.verseStart,
            verseEnd: entry.verseEnd,
            confidence: entry.confidence,
            type: entry.type
        }
        if (typeof entry.quote === "string" && entry.quote) detection.quote = entry.quote

        references.push(detection)
    })

    return references
}

function isValidDetection(entry: any): boolean {
    if (!entry || typeof entry !== "object") return false
    if (typeof entry.book !== "string" || !entry.book) return false
    if (!isPositiveInteger(entry.bookNumber) || entry.bookNumber > 66) return false
    if (!isPositiveInteger(entry.chapter)) return false
    if (!isPositiveInteger(entry.verseStart)) return false
    if (!isPositiveInteger(entry.verseEnd)) return false
    if (entry.confidence !== "high" && entry.confidence !== "medium" && entry.confidence !== "low") return false
    if (entry.type !== "explicit" && entry.type !== "quoted") return false
    return true
}

function isPositiveInteger(value: any): boolean {
    return typeof value === "number" && Number.isInteger(value) && value > 0
}

// map provider specific HTTP error responses that the generic mapping below can't infer from the status alone
export type ProviderQuirks = (status: number, data: any, headers: { [key: string]: any }) => AIError | null

const AI_ERROR_CODES: AIErrorCode[] = ["invalid_key", "forbidden", "model_not_found", "rate_limited", "invalid_request", "server_error", "timeout", "network", "refusal", "bad_response"]

// provider error bodies can echo the submitted credentials (OpenAI 401s include a partially redacted copy of the key) -
// strip anything key shaped before the message leaves the provider module for the renderer/UI/logs
const SECRET_PATTERNS = [/sk-[A-Za-z0-9_-]{8,}/g, /AIza[0-9A-Za-z_-]{20,}/g]

export function redactSecrets(message: string | undefined): string | undefined {
    if (!message) return message
    return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, "[redacted]"), message)
}

export function toAIError(err: unknown, providerQuirks?: ProviderQuirks): AIError {
    const error = mapToAIError(err, providerQuirks)
    return { code: error.code, message: redactSecrets(error.message) }
}

function mapToAIError(err: unknown, providerQuirks?: ProviderQuirks): AIError {
    const e = err as any

    // errors thrown by the providers themselves (refusal/bad_response) are already AIError shaped
    if (e && typeof e.code === "string" && (AI_ERROR_CODES as string[]).includes(e.code)) return { code: e.code, message: e.message }

    // axios timeout / aborted request
    if (e?.code === "ECONNABORTED" || e?.code === "ETIMEDOUT" || e?.code === "ERR_CANCELED") return { code: "timeout", message: String(e.message || "Request timed out") }

    const status = e?.response?.status
    if (typeof status === "number") {
        const data = e.response.data
        const quirk = providerQuirks?.(status, data, e.response.headers || {})
        if (quirk) return quirk

        // all three providers use an { error: { message } } body shape
        const message = typeof data?.error?.message === "string" ? data.error.message : undefined
        if (status === 401) return { code: "invalid_key", message }
        if (status === 403) return { code: "forbidden", message }
        if (status === 404) return { code: "model_not_found", message }
        if (status === 429) return { code: "rate_limited", message }
        if (status >= 500) return { code: "server_error", message }
        return { code: "invalid_request", message: message || `HTTP ${status}` }
    }

    return { code: "network", message: String(e?.message || e || "Network error") }
}
