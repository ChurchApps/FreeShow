// AI AUTO SCRIPTURE: LLM provider registry

import type { AIProviderId } from "../../../types/ai/AiScripture"
import { anthropicProvider } from "./anthropic"
import { geminiProvider } from "./gemini"
import { ollamaProvider } from "./ollama"
import { openaiProvider } from "./openai"
import type { AIDetectionRequest, AIProvider } from "./types"

export type { AIDetectionRequest, AIProvider, RawDetection } from "./types"

const providers: { [id in AIProviderId]: AIProvider } = {
    anthropic: anthropicProvider,
    openai: openaiProvider,
    gemini: geminiProvider,
    ollama: ollamaProvider
}

// same values in frontend/ai/models.ts
const AI_FALLBACK_MODELS = {
    anthropic: "claude-haiku-4-5",
    openai: "gpt-4o-mini",
    gemini: "gemini-2.5-flash",
    ollama: "gemma3:4b"
}

export function getProvider(id: AIProviderId): AIProvider {
    const provider = providers[id]
    const fallbackModel = AI_FALLBACK_MODELS[id]

    // fall back to the provider's default model when no model is configured
    return {
        id: provider.id,
        detectScripture: (apiKey: string, model: string, req: AIDetectionRequest, signal: AbortSignal) => provider.detectScripture(apiKey, model || fallbackModel, req, signal),
        testConnection: (apiKey: string, model: string) => provider.testConnection(apiKey, model || fallbackModel)
    }
}
