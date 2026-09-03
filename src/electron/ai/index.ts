import { app } from "electron"
import { getLLMProvider } from "./llm/llmProviders"
import { getAiKey } from "./setup/aiKeys"
import { SpeechToText } from "./stt/SpeechToTextManager"

export async function completeAiLlm(data: { providerId: string; model: string; options: { systemPrompt?: string; prompt: string; jsonSchema?: any; temperature?: number; maxTokens?: number } }): Promise<{ text: string; error?: string; code?: string; retryAfter?: number }> {
    const key = getAiKey(data.providerId)
    if (!key && data.providerId !== "ollama") return { text: "", error: "Invalid API key", code: "invalid_key" }

    try {
        const provider = getLLMProvider(data.providerId as any)
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

export async function testAiConnection(data: { providerId: string; model: string }): Promise<{ ok: boolean; error?: string }> {
    const key = getAiKey(data.providerId)
    if (!key && data.providerId !== "ollama") return { ok: false, error: "Invalid API key" }

    return await getLLMProvider(data.providerId as any).testConnection(key, data.model)
}

app.on("will-quit", () => {
    SpeechToText.stop()
})
