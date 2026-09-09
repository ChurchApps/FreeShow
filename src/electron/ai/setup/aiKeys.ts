import type { AIProviderId } from "../../../types/ai/Ai"
import { getStoreValue, setStoreValue } from "../../data/store"
import { getLLMProvider } from "../llm/llmProviders"

export function getAiKey(providerId: AIProviderId): string {
    const secrets = getStoreValue({ file: "ACCESS", key: "secrets" }) || {}
    return secrets.aiProviders?.[providerId] || ""
}

export async function setAiKey(data: { providerId: AIProviderId; key: string }) {
    // test key before saving it
    const result = await getLLMProvider(data.providerId).testConnection(data.key, "")
    if ("error" in result) return false

    const secrets = getStoreValue({ file: "ACCESS", key: "secrets" }) || {}
    const aiProviders = { ...(secrets.aiProviders || {}) }

    if (data.key) aiProviders[data.providerId] = data.key
    else delete aiProviders[data.providerId]

    setStoreValue({ file: "ACCESS", key: "secrets", value: { ...secrets, aiProviders } })
    return true
}
