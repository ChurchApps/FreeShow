<script lang="ts">
    import { onDestroy } from "svelte"
    import { fade } from "svelte/transition"
    import MaterialButton from "../../../components/inputs/MaterialButton.svelte"
    import Tabs from "../../../components/main/Tabs.svelte"
    import { activePage, ai, aiSmartAction, aiSttStatus, language, settingsTab, sttTranscript } from "../../../stores"
    import { audioLevelStore, resolveSttEngine, SpeechToText } from "../../stt/stt"
    import { Transcript } from "../../stt/transcript"
    import AiChat from "./AiChat.svelte"
    import AiRing from "./AiRing.svelte"
    import AiTranscription from "./AiTranscription.svelte"
    import AiVisual from "./AiVisual.svelte"
    import SmartAction from "./SmartAction.svelte"

    let state: "inactive" | "error" | "listening" | "processing" = "inactive"

    // Active tab state
    let activeTab: "transcription" | "chat" = "transcription"
    $: tabs = {
        transcription: { name: "ai.transcription", icon: "microphone" } // , disabled: !$ai?.stt?.engine
        // chat: { name: "chat.chat", icon: "chat" } // WIP disable for now, I guess more useful to have in the slide/template editor directly
    }

    let isOpen = false
    function toggleExpand() {
        // close any visible actions
        aiSmartAction.set(null)

        setTimeout(() => (isOpen = !isOpen))

        enableListening()
    }

    // each newly registered word bumps a border confirmation pulse on the floating bubble
    let wordConfirmTick = 0
    let wordConfirmDurationMs = 260
    let previousWordCount = -1
    let burstWords = 0
    let burstTimer: NodeJS.Timeout | null = null
    $: updateWordConfirmation($sttTranscript.finalized, $sttTranscript.unprocessed)

    function updateWordConfirmation(finalizedText: string, unprocessedText: string) {
        const fullText = (finalizedText + (finalizedText && unprocessedText ? " " : "") + unprocessedText).trim()
        const nextCount = countRegisteredWords(fullText)

        // first run sets baseline without emitting confirmation
        if (previousWordCount < 0) {
            previousWordCount = nextCount
            return
        }

        const newWords = nextCount - previousWordCount
        previousWordCount = nextCount
        if (newWords <= 0) return

        burstWords += newWords
        if (!burstTimer) {
            // collect nearby words into one visual confirmation instead of rapid pulse spam
            burstTimer = setTimeout(flushWordPulseBurst, 120)
        }
    }

    function flushWordPulseBurst() {
        const wordsInBurst = burstWords
        burstWords = 0
        burstTimer = null
        if (!wordsInBurst) return

        wordConfirmDurationMs = Math.min(800, 260 + Math.max(0, wordsInBurst - 1) * 120)
        wordConfirmTick += 1
    }

    function countRegisteredWords(text: string) {
        const words = text.match(/\S+/g)
        return words?.length || 0
    }

    // STATE

    $: isEnabled = $ai.enabled
    $: micDeviceId = $ai.stt?.micDeviceId

    // SESSION
    // transcription runs when AI is enabled and a mic is configured

    let sessionMode: "off" | "stt" = "off"
    let lastMic = ""
    let lastEngine = ""

    $: engineId = resolveEngineId($ai.stt?.engine, $language)
    // the locale param only makes the default re-resolve when the UI language changes
    function resolveEngineId(explicit: string | undefined, _locale: string): string {
        return explicit || resolveSttEngine()
    }

    $: syncSession(isEnabled, micDeviceId, engineId)
    async function syncSession(enabled: boolean | undefined, mic: string | undefined, engine: string) {
        const mode = enabled && mic ? "stt" : "off"
        const micChanged = (mic || "") !== lastMic
        const engineChanged = engine !== lastEngine

        if (mode === sessionMode) {
            if (mode === "off" || (!micChanged && !engineChanged)) return

            // switching the input or the engine mid-session only swaps that piece
            lastMic = mic || ""
            lastEngine = engine
            const capture = micChanged ? await SpeechToText.restartCapture() : { ok: true }
            const engineResult = engineChanged ? await SpeechToText.restartEngine() : { ok: true }
            if (sessionMode === mode && (!capture.ok || !engineResult.ok)) state = "error"
            return
        }

        const previousMode = sessionMode
        sessionMode = mode
        lastMic = mic || ""
        lastEngine = engine

        if (previousMode === "stt" && mode !== "stt") SpeechToText.disable()

        if (mode === "stt") {
            const result = await SpeechToText.enable()
            if (sessionMode !== "stt") return
            state = result.ok ? "listening" : "error"
        } else {
            state = "inactive"
        }
    }

    // a runtime engine failure in the electron process ends the plain transcription session
    $: if (sessionMode === "stt" && $aiSttStatus.state === "error" && state === "listening") {
        state = "error"
        SpeechToText.stopCapture()
    }

    $: audioLevel = $audioLevelStore

    onDestroy(() => {
        if (burstTimer) clearTimeout(burstTimer)
        if (sessionMode === "stt") SpeechToText.disable()
        sessionMode = "off"
    })

    // LISTEN TOGGLE
    // the session normally follows the settings toggles - this is the manual pause/resume on top

    $: isListening = state === "listening"
    $: isStarting = state === "processing"
    async function enableListening() {
        if (isStarting || sessionMode === "off") return
        if (isListening) return

        const result = await SpeechToText.enable()
        if (sessionMode === "stt") state = result.ok ? "listening" : "error"
    }

    function openSettings() {
        isOpen = false
        settingsTab.set("ai")
        activePage.set("settings")
    }
</script>

<svelte:window on:keydown={(e) => isOpen && e.key === "Escape" && toggleExpand()} />

{#if isOpen}
    <div class="backdrop" on:mousedown|self={toggleExpand} transition:fade={{ duration: 250 }}></div>
{/if}

{#if !isOpen && state !== "inactive"}
    <SmartAction />
{/if}

<div class="speech-widget {isOpen ? 'is-open' : 'is-closed'}">
    <AiRing {state} {audioLevel} borderRadius={isOpen ? "20px" : "50%"} opacity={isOpen ? 0.8 : 0.4} fill {wordConfirmTick} {wordConfirmDurationMs}>
        {#if !isOpen}
            <AiVisual {state} on:click={toggleExpand} />
        {:else}
            <div class="modal-view">
                <div class="card-header">
                    <Tabs {tabs} bind:active={activeTab} />

                    <div class="headerActions">
                        {#if activeTab === "transcription" && $sttTranscript.finalized}
                            <MaterialButton icon="copy" title="actions.copy" style="padding: 10px;" on:click={() => Transcript.copy()} />
                        {/if}
                        <MaterialButton icon="settings" title="menu.settings" style="padding: 10px;" on:click={openSettings} />

                        <MaterialButton class="popup-close" icon="close" iconSize={1.2} title="actions.close" style="padding: 8px;" on:click={toggleExpand} />
                    </div>
                </div>

                {#if activeTab === "transcription"}
                    <AiTranscription {state} />
                {:else if activeTab === "chat"}
                    <AiChat />
                {/if}
            </div>
        {/if}
    </AiRing>
</div>

<style>
    .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(8px);
        z-index: 5000;
    }

    .speech-widget {
        position: fixed;
        z-index: 5000;
        font-family:
            system-ui,
            -apple-system,
            sans-serif;
        transition:
            top 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            left 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            right 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            bottom 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            width 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            height 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .speech-widget.is-closed {
        bottom: 45px;
        right: 45px;
        width: 62px;
        height: 62px;
        transform: translate(0, 0);
    }
    .speech-widget.is-open {
        bottom: 50%;
        right: 50%;
        transform: translate(50%, 50%);
        width: 560px;
        height: 400px;
        max-width: 90vw;
        max-height: 85vh;
    }

    /* Modal Layout Elements */
    .modal-view {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .card-header {
        padding: 5px 10px 5px 15px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #1e293b;
        background-color: rgb(0 0 0 / 0.1);
    }

    .card-header :global(.tabs) {
        background-color: transparent;
    }
    .card-header :global(.tabs button) {
        padding: 8px 12px;
    }
    .card-header :global(.tabs button.isActive) {
        background-color: rgb(0 0 0 / 0.15) !important;
    }

    .headerActions {
        display: flex;
        align-items: center;
        gap: 2px;
    }
</style>
