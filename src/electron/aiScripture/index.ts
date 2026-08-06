import { app } from "electron"
import { existsSync } from "fs"
import type { AiScriptureStartConfig, AIError, AIProviderId } from "../../types/AiScripture"
import { ToMain } from "../../types/IPC/ToMain"
import { getStoreValue, setStoreValue } from "../data/store"
import { sendToMain } from "../IPC/main"
import { detectScriptureCommand } from "./commands"
import type { AiScriptureAnchor } from "./detection"
import { DetectionCoordinator } from "./detection"
import { getProvider } from "./providers"
import { Transcriber } from "./transcriber"
import { NemotronDriver } from "./drivers/nemotron"
import type { TranscriberSegment, TranscriptionDriver } from "./drivers/types"
import { getNemotronModelPaths, getVadModelPath } from "./nemotronManager"
import { cancelWhisperDownload, downloadWhisperBinary, downloadWhisperModel, getModelPath, getWhisperStatus, isModelReady, resolveWhisper, verifyWhisperBinary } from "./whisperManager"

let transcriber: TranscriptionDriver | null = null
let coordinator: DetectionCoordinator | null = null
// bumped on every start/stop so a slow start that got superseded can tell it no longer owns the session
let sessionToken = 0

// voice commands: whisper segments can overlap, so the same spoken command may be detected twice - cooldown per command type
const COMMAND_COOLDOWN_MS = 3000
const commandCooldowns = new Map<string, number>()

export async function startAiScripture(config: AiScriptureStartConfig): Promise<{ started: boolean; error?: string }> {
    stopAiScripture()
    const token = ++sessionToken

    const engine = config.engine || "whisper"

    // interpretation mode needs per-window language detection, which only the whisper cli's -oj output provides
    const binary = engine === "whisper" ? await resolveWhisper(config.whisperCustomPath, { preferCli: !!config.interpretationMode }) : null
    if (engine === "whisper" && !binary) return { started: false, error: "whisper_not_installed" }

    const customModel = config.whisperCustomModelPath && existsSync(config.whisperCustomModelPath) ? config.whisperCustomModelPath : ""
    if (engine === "whisper" && !customModel && !isModelReady(config.whisperModel)) return { started: false, error: "whisper_model_missing" }

    const nemotronPaths = engine === "nemotron" ? getNemotronModelPaths() : null
    const vadPath = engine === "nemotron" ? getVadModelPath() : null
    if (engine === "nemotron" && (!nemotronPaths || !vadPath)) return { started: false, error: "nemotron_model_missing" }

    // ollama runs locally without any credentials - every other provider needs a saved key
    const llm = config.llm && (config.llm.provider === "ollama" || getAiKey(config.llm.provider)) ? config.llm : null

    coordinator = new DetectionCoordinator({
        books: config.books,
        llm,
        getApiKey: getAiKey,
        cooldownSeconds: config.refCooldownSeconds,
        onDetection: (ref) => sendToMain(ToMain.AI_SCRIPTURE_DETECTION, ref),
        onStatus: (state, extra) => {
            if (extra?.message) extra.message = sanitizeErrorMessage(extra.message)
            sendToMain(ToMain.AI_SCRIPTURE_STATUS, { state, ...extra })
        }
    })

    const onSegment = (segment: TranscriberSegment) => {
        // the full transcript always reaches the renderer - detection only listens to the selected language
        sendToMain(ToMain.AI_SCRIPTURE_TRANSCRIPT, segment)

        // music lyrics are hallucination territory - never let them trigger detections or commands
        if (segment.music) return

        const detectable = !config.interpretationMode || !segment.language || !config.listenLanguage || segment.language === config.listenLanguage
        if (!detectable) return

        coordinator?.onTranscriptSegment(segment)

        if (!config.voiceCommands) return
        const command = detectScriptureCommand(segment.text, config.language, config.translations || [])
        if (!command) return

        const now = Date.now()
        if (now - (commandCooldowns.get(command.type) || 0) < COMMAND_COOLDOWN_MS) return
        commandCooldowns.set(command.type, now)
        sendToMain(ToMain.AI_SCRIPTURE_COMMAND, command)
    }
    const onError = (message: string) => {
        if (token !== sessionToken) return
        // a fatal transcriber error ends the whole session - stop everything so nothing keeps processing (the renderer stops mic capture on "error")
        stopAiScripture()
        sendToMain(ToMain.AI_SCRIPTURE_STATUS, { state: "error", message: sanitizeErrorMessage(message) })
    }

    transcriber =
        engine === "nemotron"
            ? new NemotronDriver({ paths: nemotronPaths!, vadModelPath: vadPath!, language: config.language, onSegment, onError })
            : new Transcriber({
                  binary: binary!,
                  modelPath: customModel || getModelPath(config.whisperModel),
                  // interpretation mode: a multilingual model detects the language of each window on its own
                  language: config.interpretationMode ? "auto" : config.language,
                  // ...but the free guess is constrained to the languages the user declared - anything else gets re-checked against the listen language
                  declaredLanguages: config.interpretationMode ? config.spokenLanguages : undefined,
                  primaryLanguage: config.listenLanguage,
                  onSegment,
                  onError
              })

    try {
        await transcriber.start()
    } catch (err) {
        // only tear down if this call still owns the session - a newer start/stop may have superseded it during the slow await
        if (token === sessionToken) stopAiScripture()
        return { started: false, error: String((err as Error)?.message || err) }
    }

    if (token !== sessionToken) return { started: false, error: "superseded" }

    sendToMain(ToMain.AI_SCRIPTURE_STATUS, { state: "listening", keyless: !llm })
    return { started: true }
}

export function stopAiScripture() {
    sessionToken++
    commandCooldowns.clear()

    coordinator?.stop()
    coordinator = null

    const active = transcriber
    transcriber = null
    if (active) {
        active.stop().catch((err) => console.error("Error stopping AI scripture transcriber:", err))
        sendToMain(ToMain.AI_SCRIPTURE_STATUS, { state: "stopped" })
    }
}

// audio arriving before START or after STOP is a safe no-op: the transcriber is null outside a session
export function receiveAiScriptureAudio(data: { buffer: Uint8Array }) {
    transcriber?.pushAudio(data.buffer)
}

// the renderer reports the passage currently live on the output, so bare "verse N" mentions resolve against it
export function updateAiScriptureContext(data: AiScriptureAnchor) {
    coordinator?.updateContext(data)
}

// error messages can contain provider response bodies / whisper stderr - never pass those to the renderer verbatim
function sanitizeErrorMessage(message: string): string {
    return message.replace(/\s+/g, " ").trim().slice(0, 200)
}

// API KEYS
// stored in the ACCESS store (plaintext userData JSON, non portable, never cloud synced) like other user entered secrets
// raw keys never leave the electron process - the renderer only gets booleans

function getAiKey(provider: AIProviderId): string {
    const secrets = getStoreValue({ file: "ACCESS", key: "secrets" }) || {}
    return secrets.aiProviders?.[provider] || ""
}

export function setAiKey(data: { provider: AIProviderId; key: string }) {
    const secrets = getStoreValue({ file: "ACCESS", key: "secrets" }) || {}
    const aiProviders = { ...(secrets.aiProviders || {}) }

    if (data.key) aiProviders[data.provider] = data.key
    else delete aiProviders[data.provider]

    setStoreValue({ file: "ACCESS", key: "secrets", value: { ...secrets, aiProviders } })
}

export async function getAiScriptureStatus() {
    return {
        keys: {
            anthropic: !!getAiKey("anthropic"),
            openai: !!getAiKey("openai"),
            gemini: !!getAiKey("gemini"),
            ollama: true // local server, no key needed
        },
        whisper: await getWhisperStatus()
    }
}

export async function testAiConnection(data: { provider: AIProviderId; model: string }): Promise<{ ok: boolean; error?: AIError }> {
    const key = getAiKey(data.provider)
    if (!key && data.provider !== "ollama") return { ok: false, error: { code: "invalid_key" } }

    const result = await getProvider(data.provider).testConnection(key, data.model)
    if (result.ok) return { ok: true }

    const error = { ...result.error }
    if (error.message) error.message = sanitizeErrorMessage(error.message)
    return { ok: false, error }
}

// WHISPER

export const aiScriptureWhisper = {
    downloadBinary: () => downloadWhisperBinary(),
    downloadModel: (data: { modelId: Parameters<typeof downloadWhisperModel>[0] }) => downloadWhisperModel(data.modelId),
    cancel: () => cancelWhisperDownload(),
    verifyPath: async (data: { path: string }) => ({ valid: await verifyWhisperBinary(data.path) })
}

app.on("will-quit", () => stopAiScripture())
