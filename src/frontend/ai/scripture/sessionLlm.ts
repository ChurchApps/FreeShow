import { get } from "svelte/store"
import { Main } from "../../../types/IPC/Main"
import { requestMain } from "../../IPC/main"
import { ai, aiScriptureStatus } from "../../stores"
import { AI_PROVIDER_MODELS, type AIProviderId } from "../models"
import { scriptureState } from "./scriptureState"
import { updateScriptureCoordinatorLlm } from "./session"

function resolveListedModel(provider: AIProviderId, modelId: string | undefined): string {
    if (!modelId) return ""
    return AI_PROVIDER_MODELS[provider].models.some((entry) => entry.id === modelId) ? modelId : ""
}

function isListeningStatus(state: string | undefined): boolean {
    return state === "listening" || state === "llm_paused"
}

/** The tier-2 LLM config as it stands right now: a chosen provider whose key is saved, or null. */
export async function resolveSessionLlm() {
    const llmConfig = get(ai).llm
    const provider = (llmConfig?.provider || null) as AIProviderId | null
    if (!provider) return null

    const status = await requestMain(Main.AI_GET_STATUS, { engineId: provider })
    if (!status?.[provider]?.ready) return null

    // only a model the provider CURRENTLY lists may travel - a stale stored id (a retired model
    // kept in settings) 404s live while the popup's Test, which validates against the list,
    // passes. Anything unlisted falls through; an empty model means the provider's own default
    const stored = llmConfig?.model
    const model = resolveListedModel(provider, stored)
    if (stored && !model) console.info(`[AI Scripture] Stored ${provider} model "${stored}" is no longer offered - using the provider default`)
    return { provider, model }
}

/**
 * The AI provider was configured mid-session (key saved, provider/model picked) - arm or update
 * tier 2 in the running session instead of making the user restart listening. No-op otherwise.
 */
export async function refreshSessionLlm(): Promise<void> {
    if (!scriptureState.sessionActive) return
    const llm = await resolveSessionLlm()
    if (!scriptureState.sessionActive) return

    updateScriptureCoordinatorLlm(llm)
    aiScriptureStatus.update((status) => (isListeningStatus(status.state) ? { ...status, state: "listening", keyless: !llm } : status))
}
