import { app } from "electron"
import { existsSync } from "fs"
import type { AiScriptureDetectionConfig, AiScriptureStartConfig } from "../../types/ai/AiScripture"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"
import { getLLMProvider } from "./llm/llmProviders"
import { CommandStream } from "./scripture/commands"
import type { AiScriptureAnchor } from "./scripture/detection"
import { DetectionCoordinator } from "./scripture/detection"
import { getAiKey } from "./setup/aiKeys"
import { NemotronDriver } from "./speech/nemotron/driver"
import { getNemotronModelPaths, getVadModelPath, isNemotronSupported } from "./speech/nemotron/manager"
import type { TranscriberSegment, TranscriptionDriver } from "./speech/types"
import { getModelPath, isModelReady, resolveWhisper } from "./speech/whisper/manager"
import { Transcriber } from "./speech/whisper/transcriber"
import { SpeechToText } from "./stt/SpeechToTextManager"

// AI SCRIPTURE DETECTION
// the feature layer on top of the generic speech-to-text stream: while the auto scripture toggle
// is on, a detection coordinator (tier 1 regex + optional LLM) and the voice command matcher
// subscribe to transcript segments - the STT engine itself is managed by SpeechToTextManager

let scriptureCoordinator: DetectionCoordinator | null = null
let scriptureSegmentListener: ((segment: TranscriberSegment) => void) | null = null

export function startScriptureDetection(config: AiScriptureDetectionConfig): boolean {
    stopScriptureDetection()

    // ollama runs locally without any credentials - every other provider needs a saved key
    const llm = config.llm && (config.llm.provider === "ollama" || getAiKey(config.llm.provider)) ? config.llm : null

    const commandStream = new CommandStream()

    const coordinator = new DetectionCoordinator({
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
    scriptureCoordinator = coordinator

    scriptureSegmentListener = (segment: TranscriberSegment) => {
        // music lyrics are hallucination territory - never let them trigger detections or commands
        if (segment.music) return

        const detectable = !config.interpretationMode || !segment.language || !config.listenLanguage || segment.language === config.listenLanguage
        if (!detectable) return

        coordinator.onTranscriptSegment(segment)

        if (!config.voiceCommands) return
        // joined across recent segments: the streaming engine can split a spoken command over utterances ("next" / "verse")
        const command = commandStream.detect({ text: segment.text, endMs: segment.endMs }, config.language || "en", config.translations || [])
        if (!command) return

        const now = Date.now()
        if (now - (commandCooldowns.get(command.type) || 0) < COMMAND_COOLDOWN_MS) return
        commandCooldowns.set(command.type, now)
        sendToMain(ToMain.AI_SCRIPTURE_COMMAND, command)
    }
    SpeechToText.addSegmentListener(scriptureSegmentListener)

    return true
}

export function stopScriptureDetection() {
    if (scriptureSegmentListener) {
        SpeechToText.removeSegmentListener(scriptureSegmentListener)
        scriptureSegmentListener = null
    }

    scriptureCoordinator?.stop()
    scriptureCoordinator = null
    commandCooldowns.clear()
}

// the renderer reports the passage currently live on the output, so bare "verse N" mentions resolve against it
export function updateScriptureDetectionContext(data: AiScriptureAnchor) {
    scriptureCoordinator?.updateContext(data)
}

// DEPRECATED PIPELINE (replaced by SpeechToTextManager + the feature functions above)

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

    // guard the addon before the model: a downloaded model with no loadable addon must not reach require() and
    // surface a raw MODULE_NOT_FOUND stack in the UI
    if (engine === "nemotron" && !isNemotronSupported()) return { started: false, error: "nemotron_unsupported" }

    const nemotronPaths = engine === "nemotron" ? getNemotronModelPaths() : null
    const vadPath = engine === "nemotron" ? getVadModelPath() : null
    if (engine === "nemotron" && (!nemotronPaths || !vadPath)) return { started: false, error: "nemotron_model_missing" }

    // ollama runs locally without any credentials - every other provider needs a saved key
    const llm = config.llm && (config.llm.provider === "ollama" || getAiKey(config.llm.provider)) ? config.llm : null

    const commandStream = new CommandStream()

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
        sendToMain(ToMain.AI_TRANSCRIPT, segment)

        // music lyrics are hallucination territory - never let them trigger detections or commands
        if (segment.music) return

        const detectable = !config.interpretationMode || !segment.language || !config.listenLanguage || segment.language === config.listenLanguage
        if (!detectable) return

        coordinator?.onTranscriptSegment(segment)

        if (!config.voiceCommands) return
        // joined across recent segments: the streaming engine can split a spoken command over utterances ("next" / "verse")
        const command = commandStream.detect({ text: segment.text, endMs: segment.endMs }, config.language, config.translations || [])
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
        // a start failure can carry a raw require/spawn stack - sanitize like every other surfaced error
        return { started: false, error: sanitizeErrorMessage(String((err as Error)?.message || err)) }
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

export async function testAiConnection(data: { provider: string; model: string }): Promise<{ ok: boolean; error?: string }> {
    const key = getAiKey(data.provider)
    if (!key && data.provider !== "ollama") return { ok: false, error: "Invalid API key" }

    return await getLLMProvider(data.provider as any).testConnection(key, data.model)
}

app.on("will-quit", () => {
    stopScriptureDetection()
    stopAiScripture()
})
