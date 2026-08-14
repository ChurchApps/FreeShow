export type AIProviderId = "anthropic" | "openai" | "gemini" | "ollama"

// stable LLM error codes (electron ai/llm) -> locale keys (unknown codes pass through as-is)
const AI_ERROR_LANG_KEYS: { [code: string]: string } = {
    invalid_key: "ai.error_invalid_key",
    forbidden: "ai.error_forbidden",
    model_not_found: "ai.error_model_not_found",
    rate_limited: "ai.error_rate_limited",
    invalid_request: "ai.error_invalid_request",
    server_error: "ai.error_server_error",
    timeout: "ai.error_timeout",
    network: "ai.error_network",
    refusal: "ai.error_refusal",
    bad_response: "ai.error_bad_response",
    ollama_not_running: "ai.error_ollama_not_running"
}

export function aiErrorText(code: string): string {
    return AI_ERROR_LANG_KEYS[code] || code
}

export const AI_PROVIDER_MODELS: { [id in AIProviderId]: { models: { id: string; name: string; recommended?: boolean }[]; defaultModel: string } } = {
    anthropic: {
        models: [
            { id: "claude-haiku-4-5", name: "Claude Haiku 4.5 (fast)", recommended: true },
            { id: "claude-opus-5", name: "Claude Opus 5 (best accuracy)" }
        ],
        defaultModel: "claude-haiku-4-5"
    },
    openai: {
        models: [
            { id: "gpt-4o-mini", name: "GPT-4o mini (fast)", recommended: true },
            { id: "gpt-4o", name: "GPT-4o (best accuracy)" }
        ],
        defaultModel: "gpt-4o-mini"
    },
    gemini: {
        // verified against ai.google.dev/gemini-api/docs (2026-08): gemini-2.0-flash was shut down 2026-06-01 and "gemini-2.0-pro" never existed
        models: [
            { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (fast)", recommended: true },
            { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro (best accuracy)" },
            { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite (fastest)" }
        ],
        defaultModel: "gemini-2.5-flash"
    },
    ollama: {
        // local models served by Ollama - ids verified against ollama.com/library (2026-08)
        models: [
            { id: "gemma3:4b", name: "Gemma 3 4B (local, fast)", recommended: true },
            { id: "gemma3:12b", name: "Gemma 3 12B (local, more accurate)" },
            { id: "gemma3:27b", name: "Gemma 3 27B (local, most accurate)" },
            { id: "gemma4:e4b", name: "Gemma 4 E4B (local, fast)" },
            { id: "gemma4:12b", name: "Gemma 4 12B (local, more accurate)" },
            { id: "llama3.2:3b", name: "Llama 3.2 3B (local, fastest)" },
            { id: "llama3.1:8b", name: "Llama 3.1 8B (local, balanced)" },
            { id: "qwen2.5:7b", name: "Qwen 2.5 7B (local, balanced)" },
            { id: "mistral:7b", name: "Mistral 7B (local, balanced)" },
            { id: "phi4:14b", name: "Phi-4 14B (local, more accurate)" }
        ],
        defaultModel: "gemma3:4b"
    }
}
