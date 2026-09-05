import { getAiKey } from "../setup/aiKeys"
import { anthropicProvider } from "./models/anthropic"
import { geminiProvider } from "./models/gemini"
import { ollamaProvider } from "./models/ollama"
import { openaiProvider } from "./models/openai"

export const llmProviders = {
    anthropic: anthropicProvider,
    openai: openaiProvider,
    gemini: geminiProvider,
    ollama: ollamaProvider
}
export type AIProviderId = keyof typeof llmProviders

export function getLLMProvider(id: AIProviderId) {
    return llmProviders[id]
}

export async function completeLLM(data: { providerId: AIProviderId; model: string; options: { systemPrompt?: string; prompt: string; jsonSchema?: any; temperature?: number; maxTokens?: number } }): Promise<{ text: string; error?: string; code?: string; retryAfter?: number }> {
    const key = getAiKey(data.providerId)
    if (!key && data.providerId !== "ollama") return { text: "", error: "Invalid API key", code: "invalid_key" }

    try {
        const provider = getLLMProvider(data.providerId)
        const text = await provider.complete(key, data.model, data.options)
        return { text }
    } catch (err: any) {
        return {
            text: "",
            error: err?.message || "llm_failed",
            code: err?.code || "server_error",
            retryAfter: err?.retryAfter
        }
    }
}
