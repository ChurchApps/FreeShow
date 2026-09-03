import { app } from "electron"
import type { AiScriptureDetectionConfig } from "../../types/ai/AiScripture"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"
import { CommandDispatcher } from "./commands/commandDispatcher"
import { getLLMProvider } from "./llm/llmProviders"
import { scriptureCommandSpec } from "./scripture/commands/matcher"
import type { AiScriptureAnchor } from "./scripture/detection/coordinator"
import { DetectionCoordinator } from "./scripture/detection/coordinator"
import { getAiKey } from "./setup/aiKeys"
import type { TranscriberSegment } from "./speech/types"
import { SpeechToText } from "./stt/SpeechToTextManager"

// AI SCRIPTURE DETECTION
// the feature layer on top of the generic speech-to-text stream: while the auto scripture toggle
// is on, a detection coordinator (tier 1 regex + optional LLM) and the voice command matcher
// subscribe to transcript segments - the STT engine itself is managed by SpeechToTextManager

// voice commands run through the generic dispatcher - features register their matcher & policies
const commandDispatcher = new CommandDispatcher()

let scriptureCoordinator: DetectionCoordinator | null = null
let scriptureConfig: AiScriptureDetectionConfig | null = null
let scriptureSegmentListener: ((segment: TranscriberSegment) => void) | null = null
// when the renderer last reported a live passage - "reading in progress" context for voice commands
let lastAnchorAtMs = 0
const ANCHOR_FRESH_MS = 120000

export function startScriptureDetection(config: AiScriptureDetectionConfig): boolean {
    stopScriptureDetection()

    // ollama runs locally without any credentials - every other provider needs a saved key
    const llm = config.llm && (config.llm.provider === "ollama" || getAiKey(config.llm.provider)) ? config.llm : null

    commandDispatcher.register(scriptureCommandSpec(() => ({ language: config.language || "en", translations: config.translations || [], books: config.books || [] })))

    const coordinator = new DetectionCoordinator({
        books: config.books,
        llm,
        getApiKey: getAiKey,
        onDetection: (ref) => {
            // whisper biases upcoming windows toward the detected book's names (no-op for other engines)
            SpeechToText.setContextBook(ref.bookNumber)
            sendToMain(ToMain.AI_SCRIPTURE_DETECTION, ref)
        },
        onStatus: (state, extra) => {
            if (extra?.message) extra.message = sanitizeErrorMessage(extra.message)
            sendToMain(ToMain.AI_SCRIPTURE_STATUS, { state, ...extra })
        }
    })
    scriptureCoordinator = coordinator
    scriptureConfig = config

    scriptureSegmentListener = (segment: TranscriberSegment) => {
        // music lyrics are hallucination territory - never let them trigger detections or commands
        if (segment.music) return
        // textless utterance-boundary markers only exist for the display's line grouping
        if (!segment.text) return

        const detectable = !config.interpretationMode || !segment.language || !config.listenLanguage || segment.language === config.listenLanguage
        if (!detectable) return

        coordinator.onTranscriptSegment(segment)

        if (!config.voiceCommands) return
        // the dispatcher joins recent segments (the streaming engine can split a spoken command
        // over utterances - "next" / "verse") and enforces scripture's declared cooldowns
        const envelope = commandDispatcher.handleSegment("scripture", { text: segment.text, endMs: segment.endMs }, { anchored: Date.now() - lastAnchorAtMs < ANCHOR_FRESH_MS })
        if (envelope) sendToMain(ToMain.AI_COMMAND, envelope)
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
    scriptureConfig = null
    commandDispatcher.unregister("scripture")
    lastAnchorAtMs = 0
}

// the Search Bibles selection changed mid-session - the spoken book-name index and the
// translation cue table follow the newly indexed set without restarting the session
export function updateScriptureTables(data: { books: AiScriptureDetectionConfig["books"]; translations: AiScriptureDetectionConfig["translations"] }) {
    if (!scriptureConfig || !scriptureCoordinator) return
    scriptureConfig.books = data.books
    scriptureConfig.translations = data.translations // the segment listener reads this per segment
    scriptureCoordinator.updateBooks(data.books)
    console.info(`[AiScripture] Detection tables refreshed: ${data.books.length} book names, ${data.translations?.length || 0} translation cues`)
}

// the AI provider was configured mid-session (key saved, provider/model picked) - arm or update
// tier 2 without restarting the listening session
export function updateScriptureLlm(llm: AiScriptureDetectionConfig["llm"]) {
    scriptureCoordinator?.updateLlm(llm)
}

// the renderer reports the passage currently live on the output, so bare "verse N" mentions resolve against it
export function updateScriptureDetectionContext(data: AiScriptureAnchor) {
    lastAnchorAtMs = Date.now()
    scriptureCoordinator?.updateContext(data)
    // the live passage also covers quote matches the coordinator never saw (they emit in the renderer)
    SpeechToText.setContextBook(data.bookNumber)
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
