import type { EngineStatus } from "../../../types/ai/AiModels"
import { type AIProviderId, getLLMProvider } from "../llm/llmProviders"
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
        status["ollama"] = { ready: (await getLLMProvider("ollama").testConnection("", modelId))?.ok }
    }
    // remote providers: a saved key is readiness - the explicit test button does the live connection check
    for (const providerId of ["anthropic", "openai", "gemini"] as const) {
        if (!id || id === providerId) status[providerId] = { ready: !!getAiKey(providerId) }
    }

    return status
}

export async function checkLLMConnection(data: { providerId: AIProviderId; model: string }): Promise<{ ok: boolean; error?: string }> {
    const key = getAiKey(data.providerId)
    if (!key && data.providerId !== "ollama") return { ok: false, error: "Invalid API key" }

    return await getLLMProvider(data.providerId).testConnection(key, data.model)
}
