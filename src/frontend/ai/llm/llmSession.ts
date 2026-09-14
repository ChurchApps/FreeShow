import { get } from "svelte/store"
import type { AIProviderId } from "../../../types/ai/Ai"
import { Main } from "../../../types/IPC/Main"
import { requestMain } from "../../IPC/main"
import { ai, aiLlmStatus } from "../../stores"

export type LLMSessionConfig = { provider: AIProviderId; model: string } | null

type LLMSessionListener = (config: LLMSessionConfig) => void

class LLMSession {
    private listeners = new Set<LLMSessionListener>()
    private lastConfig: LLMSessionConfig = null

    async resolveConfig(): Promise<LLMSessionConfig> {
        const llmConfig = get(ai).llm
        const provider = (llmConfig?.provider || null) as AIProviderId | null
        if (!provider) return null

        const status = await requestMain(Main.AI_GET_STATUS, { engineId: provider })
        if (!status?.[provider]?.ready) return null

        const model = llmConfig?.model
        if (!model) return null

        return { provider, model }
    }

    async refreshConfig(): Promise<void> {
        const config = await this.resolveConfig()
        this.syncStatus(config)

        const isSameConfig = JSON.stringify(config) === JSON.stringify(this.lastConfig)
        if (!isSameConfig) {
            this.lastConfig = config
            this.notifyListeners(config)
        }
    }

    getConfig(): LLMSessionConfig {
        return this.lastConfig
    }

    onChange(listener: LLMSessionListener): () => void {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    private notifyListeners(config: LLMSessionConfig): void {
        this.listeners.forEach((listener) => listener(config))
    }

    private syncStatus(config: LLMSessionConfig): void {
        aiLlmStatus.update((status) => (status.state === "listening" || status.state === "llm_paused" ? { ...status, state: "listening", keyless: !config } : status))
    }
}

export const llmSession = new LLMSession()
