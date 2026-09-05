import { Main } from "../../../types/IPC/Main"
import { requestMain } from "../../IPC/main"
import type { AIProviderId } from "./llmModels"

export interface LLMRequestOptions {
    systemPrompt?: string
    prompt: string
    jsonSchema?: any
    temperature?: number
    maxTokens?: number
}

export interface LLMResponse<T = any> {
    text: string
    error?: string
    parsed?: T
}

export interface LLMConfig {
    providerId: AIProviderId
    model: string
}

/**
 * Generalized class for communicating with backend LLMs.
 * Supports multiple providers (Anthropic, OpenAI, Gemini, Ollama) with structured output (JSON schema) or plain text.
 */
export class LLMTalk {
    private config: LLMConfig

    constructor(config: LLMConfig) {
        this.config = config
    }

    async complete(options: LLMRequestOptions, signal?: AbortSignal): Promise<LLMResponse<string>> {
        return this.request(options, signal)
    }

    async completeJson<T = any>(options: LLMRequestOptions, parser?: (json: any) => T, signal?: AbortSignal): Promise<LLMResponse<T>> {
        if (!options.jsonSchema) {
            throw new Error("jsonSchema is required for completeJson")
        }

        const response = await this.request(options, signal)

        if (response.error) {
            return response as LLMResponse<T>
        }

        try {
            const parsed = JSON.parse(response.text)
            return {
                ...response,
                parsed: parser ? parser(parsed) : parsed
            }
        } catch (err: any) {
            return {
                text: response.text,
                error: err?.message || "Failed to parse JSON response"
            }
        }
    }

    setConfig(config: Partial<LLMConfig>): void {
        this.config = { ...this.config, ...config }
    }

    getConfig(): LLMConfig {
        return this.config
    }

    private async request(options: LLMRequestOptions, signal?: AbortSignal): Promise<LLMResponse> {
        if (signal?.aborted) {
            throw new Error("Request aborted")
        }

        const response = await requestMain(Main.AI_LLM_COMPLETE, {
            providerId: this.config.providerId,
            model: this.config.model,
            options
        })

        if (signal?.aborted) {
            throw new Error("Request aborted")
        }

        if (!response) {
            throw new Error("IPC request timed out")
        }

        if (response.error) {
            throw new Error(response.error)
        }

        return {
            text: response.text
        }
    }
}

export function createLLMTalk(providerId: AIProviderId, model: string): LLMTalk {
    return new LLMTalk({ providerId, model })
}

export const LLMErrorHandler = {
    isRetryable(error: Error): boolean {
        const msg = error.message.toLowerCase()
        return msg.includes("rate limit") || msg.includes("timeout") || msg.includes("network") || msg.includes("server error") || msg.includes("not running")
    },

    isPermanent(error: Error): boolean {
        const msg = error.message.toLowerCase()
        return msg.includes("invalid") || msg.includes("forbidden") || msg.includes("not found") || msg.includes("refused")
    }
}
