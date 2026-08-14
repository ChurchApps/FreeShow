import { app } from "electron"
import type { AiScriptureDetectionConfig } from "../../types/ai/AiScripture"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"
import { getLLMProvider } from "./llm/llmProviders"
import { CommandStream } from "./scripture/commands"
import type { AiScriptureAnchor } from "./scripture/detection"
import { DetectionCoordinator } from "./scripture/detection"
import { getAiKey } from "./setup/aiKeys"
import type { TranscriberSegment } from "./speech/types"
import { SpeechToText } from "./stt/SpeechToTextManager"

// AI SCRIPTURE DETECTION
// the feature layer on top of the generic speech-to-text stream: while the auto scripture toggle
// is on, a detection coordinator (tier 1 regex + optional LLM) and the voice command matcher
// subscribe to transcript segments - the STT engine itself is managed by SpeechToTextManager

// voice commands: whisper segments can overlap, so the same spoken command may be detected twice - cooldown per command type
const COMMAND_COOLDOWN_MS = 3000
const commandCooldowns = new Map<string, number>()

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

// error messages can contain provider response bodies / whisper stderr - never pass those to the renderer verbatim
function sanitizeErrorMessage(message: string): string {
    return message.replace(/\s+/g, " ").trim().slice(0, 200)
}

export async function testAiConnection(data: { providerId: string; model: string }): Promise<{ ok: boolean; error?: string }> {
    const key = getAiKey(data.providerId)
    if (!key && data.providerId !== "ollama") return { ok: false, error: "Invalid API key" }

    return await getLLMProvider(data.providerId as any).testConnection(key, data.model)
}

app.on("will-quit", () => {
    stopScriptureDetection()
    SpeechToText.stop()
})
