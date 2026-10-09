import { get, writable, type Writable } from "svelte/store"
import type { AIProviderId, MatchResult } from "../../../types/ai/Ai"
import { Main } from "../../../types/IPC/Main"
import { requestMain } from "../../IPC/main"
import { ai } from "../../stores"
import { getEditItems } from "../../components/edit/scripts/itemHelpers"
import { CHAT_RESPONSE_SCHEMA, CHAT_SYSTEM_PROMPT, getSlideChatSystemPrompt, SLIDE_CHAT_RESPONSE_SCHEMA, STT_CONTROLLER_PROMPT, STT_CONTROLLER_SCHEMA } from "./prompts"
import type { FreeShowAction } from "../manager/ChatAction"

export interface ChatMessage {
    id: string
    role: "user" | "assistant" | "system"
    content: string
    timestamp: number
    action?: FreeShowAction
}

export interface ChatSendOptions {
    systemPrompt?: string
    jsonSchema?: any
}

export const chatSessions: Writable<Record<string, ChatMessage[]>> = writable({})

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

    getHistory(sessionKey: string = "default"): ChatMessage[] {
        return getChatHistory(sessionKey)
    }

    clearHistory(sessionKey: string = "default"): void {
        clearChatHistory(sessionKey)
    }

    addMessage(sessionKey: string, role: ChatMessage["role"], content: string, action?: FreeShowAction): ChatMessage {
        return addChatMessage(sessionKey, role, content, action)
    }

    private readonly DEBUG_MODE = false
    async sendMessage(sessionKeyOrPrompt: string, promptOrOptions?: string | ChatSendOptions, maybeOptions?: ChatSendOptions): Promise<ChatMessage | null> {
        let sessionKey = "default"
        let prompt = ""
        let options: ChatSendOptions = {}

        if (typeof promptOrOptions === "string") {
            sessionKey = sessionKeyOrPrompt
            prompt = promptOrOptions
            options = maybeOptions || {}
        } else {
            prompt = sessionKeyOrPrompt
            options = promptOrOptions || {}
        }

        const trimmed = prompt.trim()
        if (!trimmed) return null

        if (this.DEBUG_MODE) console.log(`[CHAT:${sessionKey}] Sending message:`, trimmed)

        this.addMessage(sessionKey, "user", trimmed)

        const currentHistory = this.getHistory(sessionKey)
        const messages = currentHistory.map(({ role, content, action }) => {
            if (role === "assistant" && action?.data?.items) {
                return {
                    role,
                    content: JSON.stringify({ content, items: action.data.items })
                }
            }
            return { role, content }
        })
        const systemPrompt =
            options.systemPrompt ||
            (sessionKey.startsWith("overlay")
                ? getSlideChatSystemPrompt("overlay", getEditItems())
                : sessionKey.startsWith("template")
                  ? getSlideChatSystemPrompt("template", getEditItems())
                  : sessionKey.includes("slide")
                    ? getSlideChatSystemPrompt("slide", getEditItems())
                    : CHAT_SYSTEM_PROMPT)

        const isSlideTarget = sessionKey.startsWith("overlay") || sessionKey.startsWith("template") || sessionKey.includes("slide")
        const defaultSchema = isSlideTarget ? SLIDE_CHAT_RESPONSE_SCHEMA : CHAT_RESPONSE_SCHEMA

        const rawResponse = await this.request<any>({
            systemPrompt,
            jsonSchema: options.jsonSchema || defaultSchema,
            prompt: trimmed,
            messages
        })

        if (!rawResponse) return null

        let content = rawResponse.content || rawResponse.text || rawResponse.response || ""
        content = content.replace(/\s*content\s*$/i, "").trim()

        let action: FreeShowAction | undefined = rawResponse.action?.type && rawResponse.action?.data ? (rawResponse.action as FreeShowAction) : undefined

        if (!action && Array.isArray(rawResponse.items) && rawResponse.items.length > 0) {
            action = {
                type: "APPLY_TO_SLIDE",
                data: {
                    items: rawResponse.items
                }
            }
        }

        if (!content) {
            content = action ? `Apply changes to ${sessionKey.startsWith("overlay") ? "overlay" : sessionKey.startsWith("template") ? "template" : "slide"}?` : "Incorrect response format received. Try again!"
        }

        return this.addMessage(sessionKey, "assistant", content, action)
    }
}

// CHAT

export function getChatHistory(sessionKey: string = "default"): ChatMessage[] {
    return get(chatSessions)[sessionKey] || []
}

export function clearChatHistory(sessionKey: string = "default"): void {
    chatSessions.update((sessions) => {
        delete sessions[sessionKey]
        return sessions
    })
}

export function addChatMessage(sessionKey: string, role: ChatMessage["role"], content: string, action?: FreeShowAction): ChatMessage {
    const message: ChatMessage = {
        id: crypto.randomUUID(),
        role,
        content,
        timestamp: Date.now(),
        ...(action ? { action } : {})
    }

    chatSessions.update((sessions) => {
        const history = sessions[sessionKey] || []
        return { ...sessions, [sessionKey]: [...history, message] }
    })

    return message
}
