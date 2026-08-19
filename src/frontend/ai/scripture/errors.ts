// AI AUTO SCRIPTURE - ERROR TEXTS

// engine/session error codes -> locale keys (unknown codes pass through as-is)
const ERROR_LANG_KEYS: { [code: string]: string } = {
    no_scripture: "ai_scripture.error_no_scripture",
    start_failed: "ai.error_start_failed",
    microphone_access: "ai.error_microphone",
    whisper_not_installed: "ai.whisper_not_installed",
    whisper_model_missing: "ai.error_model_missing",
    nemotron_model_missing: "ai.nemotron_not_downloaded",
    nemotron_unsupported: "ai.nemotron_unsupported"
}

export function aiScriptureErrorText(code: string): string {
    return ERROR_LANG_KEYS[code] || code
}
