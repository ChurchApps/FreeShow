export interface EngineStatus {
    ready: boolean
    localPath?: string | null
    downloadedModels?: string[]
    supported?: boolean // engines with a native addon (nemotron) report whether this platform can run it at all
}

export interface AiSetupOptions {
    action: "download" | "cancel" | "delete" | "verify"
    engineId: string
    modelId?: string
    customPath?: string
}

export interface LLMCompletionOptions {
    systemPrompt?: string
    prompt: string
    jsonSchema?: any
    temperature?: number
    maxTokens?: number
    signal?: AbortSignal
}
