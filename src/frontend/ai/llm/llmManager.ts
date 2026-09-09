import { get } from "svelte/store"
import type { AIProviderId } from "../../../types/ai/Ai"
import { Main } from "../../../types/IPC/Main"
import { requestMain } from "../../IPC/main"
import { ai } from "../../stores"
import { type MatchResult } from "../manager/AiManager"
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
    private chatHistory: ChatMessage[] = []

    constructor(providerId: AIProviderId, model: string) {
        this.providerId = providerId
        this.model = model
    }

    private MIN_NEW_WORDS: number = 15
    private accumulatedNewWords: number = 0
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

    // --- STT Match Detection ---

    private requestInProgress: boolean = false
    async detectMatch(chunk: { chunkWithOverlap: string; newWordsCount: number }) {
        const { chunkWithOverlap, newWordsCount } = chunk
        if (!chunkWithOverlap) return null

        this.accumulatedNewWords += newWordsCount
        if (this.requestInProgress) return null
        if (this.accumulatedNewWords < this.MIN_NEW_WORDS) return null

        const options: LLMRequestOptions = {
            systemPrompt: STT_CONTROLLER_PROMPT,
            jsonSchema: STT_CONTROLLER_SCHEMA,
            prompt: chunkWithOverlap
        }

        this.accumulatedNewWords = 0
        this.requestInProgress = true

        const result = await this.request<MatchResult | null>(options)

        this.requestInProgress = false

        if (!result?.content) return null
        return result
    }

    // --- Chat Helper ---

    getHistory(): ChatMessage[] {
        return [...this.chatHistory]
    }

    clearHistory(): void {
        this.chatHistory = []
    }

    addMessage(role: ChatMessage["role"], content: string, action?: FreeShowAction): ChatMessage {
        const message: ChatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            role,
            content,
            timestamp: Date.now(),
            ...(action ? { action } : {})
        }
        this.chatHistory.push(message)
        return message
    }

    /**
     * Sends a chat prompt to the LLM with FreeShow system instructions and JSON schema enforcement.
     */
    private DEBUG_MODE = false
    async sendMessage(prompt: string): Promise<ChatMessage | null> {
        if (!prompt.trim()) return null

        if (this.DEBUG_MODE) console.log("[CHAT] Sending message:", prompt)

        // 1. Add user prompt to history
        this.addMessage("user", prompt.trim())

        // 2. Format history for payload
        const messagesPayload = this.chatHistory.map((msg) => ({
            role: msg.role,
            content: msg.content
        }))

        const options: LLMRequestOptions = {
            systemPrompt: CHAT_SYSTEM_PROMPT,
            jsonSchema: CHAT_RESPONSE_SCHEMA,
            prompt: prompt.trim(),
            messages: messagesPayload
        }

        // 3. Request LLM response
        const rawResponse = await this.request<any>(options)
        if (!rawResponse) return null

        let content = ""
        let action: FreeShowAction | undefined

        // 4. Get content and action if any
        content = rawResponse.content || rawResponse.text || rawResponse.response || ""
        if (rawResponse.action && typeof rawResponse.action === "object" && rawResponse.action.type && rawResponse.action.data) {
            action = rawResponse.action as FreeShowAction
        }

        if (this.DEBUG_MODE) console.log("[CHAT] Received content response:", content, "with action:", action)

        if (typeof content === "string") {
            // Remove trailing or leading literal "content" keywords left by loose models
            content = content.replace(/\s*content\s*$/i, "").trim()
        }

        if (!content) {
            content = action ? `Create ${action.type.replace("CREATE_", "").toLowerCase()}?` : "Incorrect response format received. Try again!"
        }

        // 5. Append assistant reply and attach action if returned
        return this.addMessage("assistant", content, action)
    }
}
