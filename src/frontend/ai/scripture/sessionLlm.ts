import { get } from "svelte/store"
import type { AiScriptureDetectionConfig } from "../../../types/ai/AiScripture"
import { Main } from "../../../types/IPC/Main"
import { requestMain } from "../../IPC/main"
import { ai, aiScriptureStatus } from "../../stores"
import { AI_PROVIDER_MODELS } from "../models"
import { getSettings, scriptureState } from "./scriptureState"
import { updateScriptureCoordinatorLlm } from "./session"

/** The tier-2 LLM config as it stands right now: a chosen provider whose key is saved, or null. */
export async function resolveSessionLlm(): Promise<AiScriptureDetectionConfig["llm"]> {
    const settings = getSettings()
    const provider = get(ai).llm?.provider || settings.provider || "none"
    if (provider === "none") return null

    const status = await requestMain(Main.AI_GET_STATUS, { engineId: provider })
    if (!status?.[provider]?.ready) return null

    // only a model the provider CURRENTLY lists may travel - a stale stored id (a retired model
    // kept in settings) 404s live while the popup's Test, which validates against the list,
    // passes. Anything unlisted falls through; an empty model means the provider's own default
    const listed = (id: string | undefined) => (id && AI_PROVIDER_MODELS[provider].models.some((entry) => entry.id === id) ? id : "")
    const model = listed(get(ai).llm?.model) || listed(settings.customModel) || listed(settings.models?.[provider]) || listed(settings.model) || ""
    const stored = get(ai).llm?.model || settings.customModel || settings.models?.[provider] || settings.model
    if (stored && !model) console.info(`[AiScripture] Stored ${provider} model "${stored}" is no longer offered - using the provider default`)
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
    aiScriptureStatus.update((status) => (status.state === "listening" || status.state === "llm_paused" ? { ...status, state: "listening", keyless: !llm } : status))
}

