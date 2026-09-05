import { getStoreValue, setStoreValue } from "../../data/store"

export function getAiKey(providerId: string): string {
    const secrets = getStoreValue({ file: "ACCESS", key: "secrets" }) || {}
    return secrets.aiProviders?.[providerId] || ""
}

export function setAiKey(data: { providerId: string; key: string }) {
    const secrets = getStoreValue({ file: "ACCESS", key: "secrets" }) || {}
    const aiProviders = { ...(secrets.aiProviders || {}) }

    if (data.key) aiProviders[data.providerId] = data.key
    else delete aiProviders[data.providerId]

    setStoreValue({ file: "ACCESS", key: "secrets", value: { ...secrets, aiProviders } })
}
