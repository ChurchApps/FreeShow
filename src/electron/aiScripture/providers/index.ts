// AI AUTO SCRIPTURE: LLM provider registry

import type { AIProviderId } from "../../../types/AiScripture"
import { AI_PROVIDER_MODELS } from "../../../types/AiScripture"
import { anthropicProvider } from "./anthropic"
import { geminiProvider } from "./gemini"
import { openaiProvider } from "./openai"
import type { AIDetectionRequest, AIProvider } from "./types"

export type { AIDetectionRequest, AIProvider, RawDetection } from "./types"

const providers: { [id in AIProviderId]: AIProvider } = {
    anthropic: anthropicProvider,
    openai: openaiProvider,
    gemini: geminiProvider
}

export function getProvider(id: AIProviderId): AIProvider {
    const provider = providers[id]
    const defaultModel = AI_PROVIDER_MODELS[id].defaultModel

    // fall back to the provider's default model when no model is configured
    return {
        id: provider.id,
        detectScripture: (apiKey: string, model: string, req: AIDetectionRequest, signal: AbortSignal) => provider.detectScripture(apiKey, model || defaultModel, req, signal),
        testConnection: (apiKey: string, model: string) => provider.testConnection(apiKey, model || defaultModel)
    }
}
