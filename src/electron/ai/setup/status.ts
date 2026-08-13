import type { EngineStatus } from "../../../types/ai/AiModels"
import { getLLMProvider } from "../llm/llmProviders"
import { getAiKey } from "./aiKeys"
import { LocalModelManager } from "./LocalModelManager"

export async function aiGetModelStatus(data: { engineId?: string; modelId?: string; customPath?: string }) {
    let status: { [key: string]: EngineStatus } = {}

    const id = data.engineId
    const modelId = data.modelId || ""

    if (!id || id === "whisper") status["whisper"] = await LocalModelManager.getStatus("whisper", modelId, data.customPath)
    if (!id || id === "nemotron") status["nemotron"] = await LocalModelManager.getStatus("nemotron", modelId, data.customPath)

    if (!id || id === "ollama") {
        // no key
        status["ollama"] = { ready: (await getLLMProvider("ollama").testConnection("", modelId))?.ok }
    }
    if (!id || id === "anthropic") {
        const key = getAiKey("anthropic")
        status["anthropic"] = { ready: (await getLLMProvider("anthropic").testConnection(key, modelId))?.ok }
    }
    if (!id || id === "openai") {
        const key = getAiKey("openai")
        status["openai"] = { ready: (await getLLMProvider("openai").testConnection(key, modelId))?.ok }
    }
    if (!id || id === "gemini") {
        const key = getAiKey("gemini")
        status["gemini"] = { ready: (await getLLMProvider("gemini").testConnection(key, modelId))?.ok }
    }

    return status
}
