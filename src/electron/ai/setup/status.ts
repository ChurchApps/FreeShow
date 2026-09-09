import type { EngineStatus } from "../../../types/ai/Ai"
import { getLLMProvider } from "../llm/llmProviders"
import { getAiKey } from "./aiKeys"
import { LocalModelManager } from "./LocalModelManager"

async function checkConnectionStatus(providerId: "ollama" | "anthropic" | "openai" | "google", key: string, modelId: string): Promise<EngineStatus> {
    const result = await getLLMProvider(providerId).testConnection(key, modelId)
    return "error" in result ? { ready: false, error: result.error } : { ready: result.ok }
}

export async function aiGetModelStatus(data?: { engineId?: string; modelId?: string; customPath?: string }) {
    const status: Record<string, EngineStatus> = {}
    const { engineId: id, modelId = "", customPath } = data || {}

    if (!id || id === "nemotron") status["nemotron"] = await LocalModelManager.getStatus("nemotron", modelId, customPath)

    if (!id || id === "ollama") {
        status["ollama"] = await checkConnectionStatus("ollama", "", modelId)
    }

    const remoteProviders = ["anthropic", "openai", "google"] as const
    for (const providerId of remoteProviders) {
        if (!id || id === providerId) {
            const key = getAiKey(providerId)
            if (!key) {
                status[providerId] = { ready: false } // No API Key set
                continue
            }

            status[providerId] = await checkConnectionStatus(providerId, key, modelId)
        }
    }

    return status
}
