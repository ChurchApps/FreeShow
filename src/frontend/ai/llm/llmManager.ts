import { get } from "svelte/store"
import type { AIProviderId, MatchResult } from "../../../types/ai/Ai"
import { Main } from "../../../types/IPC/Main"
import { requestMain } from "../../IPC/main"
import { ai } from "../../stores"
import { CHAT_RESPONSE_SCHEMA, CHAT_SYSTEM_PROMPT, STT_CONTROLLER_PROMPT, STT_CONTROLLER_SCHEMA } from "./prompts"
import type { FreeShowAction } from "../manager/ChatAction"

export interface ChatMessage {
    id: string
    role: "user" | "assistant" | "system"
    content: string
    timestamp: number
    action?: FreeShowAction
}

interface LLMRequestOptions {
    systemPrompt?: string
    prompt: string
    jsonSchema?: any
    temperature?: number
    maxTokens?: number
    messages?: Array<{ role: string; content: string }>
}

let llmManager: LLMManager | null = null

export function getLLMManager(): LLMManager | null {
    const { provider = "none", model = "" } = get(ai).llm || {}
    if (provider === "none") return null

    if (llmManager && (llmManager.providerId !== provider || llmManager.model !== model)) {
        llmManager.stop()
        llmManager = null
    }

    if (!llmManager) llmManager = new LLMManager(provider as AIProviderId, model)

    return llmManager
}

export class LLMManager {
    providerId: AIProviderId
    model: string

    constructor(providerId: AIProviderId, model: string) {
        this.providerId = providerId
        this.model = model
    }

    private retryTimeout: ReturnType<typeof setTimeout> | null = null
    private isRequesting = false
    async request<T>(options: LLMRequestOptions): Promise<T | null> {
        if (this.isRequesting) return null
        this.isRequesting = true

        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout)
            this.retryTimeout = null
        }

        try {
            const data = { providerId: this.providerId, model: this.model, options }
            const response = await requestMain(Main.AI_LLM_COMPLETE, data, undefined, 60000)

            if (response?.error || !response?.text) {
                if (response?.error) console.error("LLM error:", response.error)
                return null
            }

            return JSON.parse(response.text) as T
        } catch (error: any) {
            console.error("LLM request failed:", error?.message || error)
            return null
        } finally {
            this.isRequesting = false
        }
    }

    stop() {
        if (this.retryTimeout) clearTimeout(this.retryTimeout)
        this.retryTimeout = null
        this.isRequesting = false
    }

    // --- STT Match Detection ---

    private readonly MIN_NEW_WORDS = 15
    private accumulatedNewWords = 0
    private requestInProgress: boolean = false
    async detectMatch(chunk: { chunkWithOverlap: string; newWordsCount: number }): Promise<MatchResult | null> {
        const { chunkWithOverlap, newWordsCount } = chunk
        if (!chunkWithOverlap) return null

        this.accumulatedNewWords += newWordsCount
        if (this.requestInProgress) return null
        if (this.accumulatedNewWords < this.MIN_NEW_WORDS) return null

        this.accumulatedNewWords = 0
        this.requestInProgress = true

        const result = await this.request<MatchResult>({
            systemPrompt: STT_CONTROLLER_PROMPT,
            jsonSchema: STT_CONTROLLER_SCHEMA,
            prompt: chunkWithOverlap
        })

        this.requestInProgress = false

        if (!result?.content) return null
        return result
    }

    // --- Chat Helper ---

    private chatHistory: ChatMessage[] = []

    getHistory(): ChatMessage[] {
        return [...this.chatHistory]
    }

    clearHistory(): void {
        this.chatHistory = []
    }

    addMessage(role: ChatMessage["role"], content: string, action?: FreeShowAction): ChatMessage {
        const message: ChatMessage = {
            id: crypto.randomUUID(),
            role,
            content,
            timestamp: Date.now(),
            ...(action ? { action } : {})
        }
        this.chatHistory.push(message)
        return message
    }

    private readonly DEBUG_MODE = false
    async sendMessage(prompt: string): Promise<ChatMessage | null> {
        const trimmed = prompt.trim()
        if (!trimmed) return null

        if (this.DEBUG_MODE) console.log("[CHAT] Sending message:", trimmed)

        this.addMessage("user", trimmed)

        const messages = this.chatHistory.map(({ role, content }) => ({ role, content }))
        const rawResponse = await this.request<any>({
            systemPrompt: CHAT_SYSTEM_PROMPT,
            jsonSchema: CHAT_RESPONSE_SCHEMA,
            prompt: trimmed,
            messages
        })

        if (!rawResponse) return null

        let content = rawResponse.content || rawResponse.text || rawResponse.response || ""
        content = content.replace(/\s*content\s*$/i, "").trim()

        const action = rawResponse.action?.type && rawResponse.action?.data ? (rawResponse.action as FreeShowAction) : undefined

        if (!content) {
            content = action ? `Create ${action.type.replace("CREATE_", "").toLowerCase()}?` : "Incorrect response format received. Try again!"
        }

        return this.addMessage("assistant", content, action)
    }
}
