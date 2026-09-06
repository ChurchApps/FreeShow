import { get } from "svelte/store"
import { ai, sttTranscript } from "../../stores"
import { AiManager } from "../manager/AiManager"

type TranscriptPart = {
    text: string
    interim?: boolean

    startMs?: number
    endMs?: number

    language?: string
    music?: boolean
    utteranceEnd?: boolean
}

export class Transcript {
    private static readonly MAX_TRANSCRIPT_CHARS = 10000
    private static interimTimeout: NodeJS.Timeout | null = null
    private static readonly INTERIM_DEBOUNCE_MS = 350

    static push(part: TranscriptPart) {
        if (!get(ai).enabled) return

        const textPart = part.text

        sttTranscript.update((t) => {
            if (part.interim) {
                return { ...t, unprocessed: textPart }
            } else {
                let finalized = t.finalized + (t.finalized ? " " : "") + textPart.trim()

                // cap at a certain amount of characters
                if (finalized.length > this.MAX_TRANSCRIPT_CHARS) finalized = finalized.slice(-this.MAX_TRANSCRIPT_CHARS)

                return { finalized, unprocessed: "" }
            }
        })

        if (part.interim) {
            if (this.interimTimeout) clearTimeout(this.interimTimeout)
            this.interimTimeout = setTimeout(() => {
                this.interimTimeout = null
                this.processPendingChunk()
            }, this.INTERIM_DEBOUNCE_MS)
        } else {
            if (this.interimTimeout) {
                clearTimeout(this.interimTimeout)
                this.interimTimeout = null
            }
            this.processPendingChunk()
        }
    }

    private static processPendingChunk() {
        const chunk = this.getTranscriptChunk()
        if (chunk.newWordsCount === 0) return

        AiManager.processSTTChunk(chunk)
    }

    private static OVERLAP_WORDS: number = 8
    private static MAX_CHUNK_WORDS: number = 120
    private static lastSentWords: string[] = []
    private static getTranscriptChunk(): { chunkWithOverlap: string; newWordsCount: number } {
        const { finalized, unprocessed } = get(sttTranscript)
        const combined = ((finalized || "") + (finalized && unprocessed ? " " : "") + (unprocessed || "")).trim()

        if (!combined) {
            this.lastSentWords = []
            return { chunkWithOverlap: "", newWordsCount: 0 }
        }

        let words = combined.split(/\s+/).filter(Boolean)
        if (!words.length) return { chunkWithOverlap: "", newWordsCount: 0 }

        if (words.length > this.MAX_CHUNK_WORDS) {
            words = words.slice(-this.MAX_CHUNK_WORDS)
        }

        let startIdx = 0
        if (this.lastSentWords.length) {
            const lastWords = this.lastSentWords.map((w) => w.toLowerCase())
            const currWords = words.map((w) => w.toLowerCase())

            // 1. Direct prefix match (words started from where lastSentWords started)
            let prefixMatchCount = 0
            while (prefixMatchCount < lastWords.length && prefixMatchCount < currWords.length && lastWords[prefixMatchCount] === currWords[prefixMatchCount]) {
                prefixMatchCount++
            }

            if (prefixMatchCount > 0 && prefixMatchCount >= lastWords.length - 3) {
                startIdx = prefixMatchCount
            } else {
                // 2. Seam match (e.g. transcript finalized/shifted or pruned)
                const maxSeam = Math.min(lastWords.length, currWords.length, 30)
                for (let seam = maxSeam; seam >= 3; seam--) {
                    const tail = lastWords.slice(-seam)
                    const head = currWords.slice(0, seam)
                    if (tail.every((w, idx) => w === head[idx])) {
                        startIdx = seam
                        break
                    }
                }
            }
        }

        const newWordsCount = words.length - startIdx
        const chunkStartIdx = Math.max(0, startIdx - this.OVERLAP_WORDS)
        const chunkWithOverlap = words.slice(chunkStartIdx).join(" ")

        this.lastSentWords = words

        return { chunkWithOverlap, newWordsCount }
    }
}
