import { pipeline } from "transformers"
import { formatSearch, tokenize } from "./search"

export interface AIScriptureResult {
    book: number
    chapter: number
    verse: number
    reference: string
    text: string
    score: number // 0-100, descending
}

let extractor: any = null
let loadingPromise: Promise<any> | null = null
const verseEmbCache = new Map<string, number[]>()

export function cosineSimilarity(a: any, b: any): number {
    let dot = 0
    let na = 0
    let nb = 0
    const len = Math.min(a.length, b.length)
    for (let i = 0; i < len; i++) {
        dot += a[i] * b[i]
        na += a[i] * a[i]
        nb += b[i] * b[i]
    }
    if (!na || !nb) return 0
    return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export function cleanVerseText(t: string) {
    return (t || "")
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
}

async function loadModel(onProgress?: (p: string) => void) {
    if (extractor) return extractor
    if (!loadingPromise) {
        onProgress?.("downloading AI model first run ~30MB...")
        loadingPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { quantized: true })
            .then((m: any) => {
                extractor = m
                onProgress?.("AI ready")
                return m
            })
            .catch((e) => {
                loadingPromise = null
                throw e
            })
    }
    return loadingPromise
}

async function embed(text: string) {
    const model = await loadModel()
    const out = await model(cleanVerseText(text), { pooling: "mean", normalize: true })
    return Array.from(out.data as number[])
}

// V2 real semantic search — same output shape as V1, sorted descending
export async function aiScriptureSearchAsync(query: string, verses: { book: number; chapter: number; verse: number; reference: string; text: string }[], maxResults = 20): Promise<AIScriptureResult[]> {
    try {
        const qEmb = await embed(query)
        const scored: AIScriptureResult[] = []
        for (const v of verses) {
            const key = `${v.book}-${v.chapter}-${v.verse}`
            let vEmb = verseEmbCache.get(key)
            if (!vEmb) {
                vEmb = await embed(v.text)
                verseEmbCache.set(key, vEmb)
            }
            const cos = cosineSimilarity(qEmb, vEmb) // -1 to 1
            scored.push({ ...v, score: Math.round(((cos + 1) / 2) * 100) })
        }
        return scored.sort((a, b) => b.score - a.score).slice(0, maxResults)
    } catch {
        return aiScriptureSearch(query, verses, maxResults) // fallback to V1 if offline
    }
}

// V1 fallback kept
export function aiScriptureSearch(query: string, verses: { book: number; chapter: number; verse: number; reference: string; text: string }[], maxResults = 20): AIScriptureResult[] {
    const qT = new Set(tokenize(formatSearch(query)))
    if (!qT.size) return []
    return verses
        .map((v) => {
            const vT = new Set(tokenize(formatSearch(cleanVerseText(v.text))))
            let o = 0
            qT.forEach((t) => {
                if (t.length < 3) return
                if (vT.has(t)) o += 2
            })
            return { ...v, score: Math.min(100, Math.round((o / Math.max(1, qT.size)) * 50)) }
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
}
