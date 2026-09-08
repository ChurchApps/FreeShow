import type { EngineStatus } from "../../../types/ai/Ai"
import { getLLMProvider } from "../llm/llmProviders"
import { getAiKey } from "./aiKeys"
import { LocalModelManager } from "./LocalModelManager"

export async function aiGetModelStatus(data?: { engineId?: string; modelId?: string; customPath?: string }) {
    const status: { [key: string]: EngineStatus } = {}

    const id = data?.engineId
    const modelId = data?.modelId || ""

    if (!id || id === "whisper") status["whisper"] = await LocalModelManager.getStatus("whisper", modelId, data?.customPath)
    if (!id || id === "nemotron") status["nemotron"] = await LocalModelManager.getStatus("nemotron", modelId, data?.customPath)

    if (!id || id === "ollama") {
        // ollama runs locally without any credentials - reachability is its readiness
        const result = await getLLMProvider("ollama").testConnection("", modelId)
        if ("error" in result) status["ollama"] = { ready: false, error: result?.error }
        else status["ollama"] = { ready: result?.ok }
    }
    // remote providers: a saved key is readiness - the explicit test button does the live connection check
    for (const providerId of ["anthropic", "openai", "google"] as const) {
        if (!id || id === providerId) {
            const key = getAiKey(providerId)
            if (!key)
                status[providerId] = { ready: false } // No API Key set
            else {
                const result = await getLLMProvider(providerId).testConnection(key, modelId)
                if ("error" in result) status[providerId] = { ready: false, error: result?.error }
                else status[providerId] = { ready: result?.ok }
            }
        }
    }

    return status
}
