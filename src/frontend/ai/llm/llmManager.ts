import { get } from "svelte/store"
import type { AIProviderId } from "../../../types/ai/Ai"
import { Main } from "../../../types/IPC/Main"
import { requestMain } from "../../IPC/main"
import { ai } from "../../stores"
import { type MatchResult } from "../manager/AiManager"
import { LLM_PROMPT, LLM_SCHEMA } from "./llmPrompt"

interface LLMRequestOptions {
    systemPrompt?: string
    prompt: string
    jsonSchema?: any
    temperature?: number
    maxTokens?: number
}

let llmManager: LLMManager | null = null
export function getLLMManager() {
    const llmOptions = get(ai).llm
    if (!llmOptions || (llmOptions.provider || "none") === "none") return null

    const provider = llmOptions.provider as AIProviderId
    const model = llmOptions.model || ""

    if (llmManager && (llmManager.providerId !== provider || llmManager.model !== model)) {
        llmManager.stop()
        llmManager = null
    }

    if (!llmManager) llmManager = new LLMManager(provider, model)

    return llmManager
}

export class LLMManager {
    providerId: AIProviderId
    model: string
    private IPC_REQUEST_TIMEOUT_MS: number = 45000

    constructor(providerId: AIProviderId, model: string) {
        this.providerId = providerId
        this.model = model
    }

    private MIN_NEW_WORDS: number = 15
    private isRequesting: boolean = false
    private retryTimeout: any = null

    async request<T>(options: LLMRequestOptions): Promise<T | null> {
        if (this.isRequesting) return null
        this.isRequesting = true

        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout)
            this.retryTimeout = null
        }

        console.log("[LLM] Requesting completion...", options.prompt)
        const data = {
            providerId: this.providerId,
            model: this.model,
            options
        }

        try {
            const response = await requestMain(Main.AI_LLM_COMPLETE, data, undefined, this.IPC_REQUEST_TIMEOUT_MS)

            if (response?.error) {
                console.error("LLM error:", response.error)
                return null
            }
            if (!response?.text) return null

            const match = JSON.parse(response.text)
            if (!match?.content) return null

            return match as T
        } catch (error: any) {
            console.error("LLM request failed:", error?.message || error)
            return null
        } finally {
            this.isRequesting = false
        }
    }

    stop() {
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout)
            this.retryTimeout = null
        }
        this.isRequesting = false
    }

    async detectMatch(chunk: { chunkWithOverlap: string; newWordsCount: number }) {
        const { chunkWithOverlap, newWordsCount } = chunk
        if (!chunkWithOverlap || newWordsCount < this.MIN_NEW_WORDS) return null

        const options: LLMRequestOptions = {
            systemPrompt: LLM_PROMPT,
            jsonSchema: LLM_SCHEMA,
            prompt: chunkWithOverlap
        }

        return this.request<MatchResult | null>(options)
    }
}
