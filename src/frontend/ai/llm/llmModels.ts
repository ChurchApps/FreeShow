export const AI_PROVIDER_MODELS = {
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
        // verified against ai.google.dev/gemini-api/docs availability table (2026-08): the 2.5
        // generation retires 2026-10-20, so only 3.x models are offered - 3.1 Flash-Lite carries
        // the longest runway (May 2027+) and is fast enough for live detection
        models: [
            { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite (fast)", recommended: true },
            { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash" },
            { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite" },
            { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash" },
            { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash (best accuracy)" }
        ],
        defaultModel: "gemini-3.1-flash-lite"
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
export type AIProviderId = keyof typeof AI_PROVIDER_MODELS
