import { get } from "svelte/store"
import { Main } from "../../../types/IPC/Main"
import { requestMain } from "../../IPC/main"
import { ai, aiLlmStatus } from "../../stores"
import { AI_PROVIDER_MODELS, type AIProviderId } from "./llmModels"
import { LLMTalk } from "./llmTalk"

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

        const stored = llmConfig?.model
        const model = this.resolveListedModel(provider, stored)
        if (stored && !model) {
            console.info(`[AI LLM] Stored ${provider} model "${stored}" is no longer offered - using the provider default`)
        }

        return { provider, model }
    }

    async refreshConfig(): Promise<void> {
        const config = await this.resolveConfig()
        this.syncStatus(config)
        if (JSON.stringify(config) !== JSON.stringify(this.lastConfig)) {
            this.lastConfig = config
            this.notifyListeners(config)
        }
    }

    getConfig(): LLMSessionConfig {
        return this.lastConfig
    }

    createLLMTalk(): LLMTalk | null {
        const config = this.lastConfig
        if (!config) return null
        return new LLMTalk({ providerId: config.provider, model: config.model })
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

    private resolveListedModel(provider: AIProviderId, modelId: string | undefined): string {
        if (!modelId) return ""
        return AI_PROVIDER_MODELS[provider].models.some((entry) => entry.id === modelId) ? modelId : ""
    }
}

export const llmSession = new LLMSession()
