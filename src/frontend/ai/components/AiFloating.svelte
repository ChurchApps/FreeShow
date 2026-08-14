<script lang="ts">
    import { onDestroy } from "svelte"
    import { fade, fly } from "svelte/transition"
    import type { DetectedReference } from "../../../types/ai/AiScripture"
    import { getShortBibleName } from "../../components/drawer/bible/scripture"
    import T from "../../components/helpers/T.svelte"
    import MaterialButton from "../../components/inputs/MaterialButton.svelte"
    import { ai, aiScriptureStatus, aiScriptureSuggestions, aiScriptureTranscript, aiStatus, outLocked, scriptures } from "../../stores"
    import { translateText } from "../../utils/language"
    import { aiScriptureErrorText, dismissSuggestion, projectDetection, showInDrawer, startAiScriptureListening, stopAiScriptureListening } from "../scripture/aiScripture"
    import { audioLevelStore, SpeechToText } from "../stt/stt"
    import AiRing from "./AiRing.svelte"

    let state: "inactive" | "error" | "listening" | "processing" = "inactive"

    let isOpen = false
    function toggleExpand() {
        isOpen = !isOpen
    }

    // STATE

    $: isEnabled = $ai.enabled
    $: micDeviceId = $ai.stt?.micDeviceId
    $: scriptureEnabled = $ai.scripture?.enabled === true

    // SESSION
    // the scripture feature session (STT + detection) runs while its toggle is on -
    // otherwise plain transcription runs when a mic is configured

    let sessionMode: "off" | "stt" | "scripture" = "off"
    let lastMic = ""

    $: syncSession(isEnabled, scriptureEnabled, micDeviceId)
    async function syncSession(enabled: boolean | undefined, scripture: boolean, mic: string | undefined) {
        const mode = enabled && scripture ? "scripture" : enabled && mic ? "stt" : "off"
        const micChanged = mode === "stt" && (mic || "") !== lastMic
        if (mode === sessionMode && !micChanged) return

        const previousMode = sessionMode
        sessionMode = mode
        lastMic = mic || ""

        if (previousMode === "scripture") stopAiScriptureListening()
        else if (previousMode === "stt" && mode !== "stt") SpeechToText.disable()

        if (mode === "scripture") {
            state = "processing"
            const result = await startAiScriptureListening()
            if (sessionMode !== "scripture") return
            state = result.ok ? "listening" : "error"
        } else if (mode === "stt") {
            const result = await SpeechToText.enable()
            if (sessionMode !== "stt") return
            state = result.ok ? "listening" : "error"
        } else {
            state = "inactive"
        }
    }

    // the scripture session state is richer (starting/llm_paused/error) - mirror it onto the bubble
    $: if (sessionMode === "scripture") state = mapScriptureState($aiScriptureStatus.state)
    function mapScriptureState(scriptureState: string): typeof state {
        if (scriptureState === "listening" || scriptureState === "llm_paused") return "listening"
        if (scriptureState === "starting") return "processing"
        if (scriptureState === "error") return "error"
        return "inactive"
    }

    // a runtime engine failure in the electron process ends the plain transcription session
    $: if (sessionMode === "stt" && $aiStatus.state === "error" && state === "listening") {
        state = "error"
        SpeechToText.stopCapture()
    }

    $: audioLevel = $audioLevelStore

    onDestroy(() => {
        if (sessionMode === "scripture") stopAiScriptureListening()
        else if (sessionMode === "stt") SpeechToText.disable()
        sessionMode = "off"
    })

    // SUGGESTIONS
    // confident detections surface here so the operator can present them with one click
    // (auto mode projects on its own - the cards double as a record of what was heard)

    $: suggestions = scriptureEnabled ? $aiScriptureSuggestions : []

    function getReferenceLabel(suggestion: DetectedReference, _updater: any = null) {
        let label = `${suggestion.book} ${suggestion.chapter}:${suggestion.verseStart}`
        if (suggestion.verseEnd > suggestion.verseStart) label += `-${suggestion.verseEnd}`

        const bible = suggestion.matchedBibleId ? $scriptures[suggestion.matchedBibleId] : null
        if (bible) label += ` (${getShortBibleName(bible.customName || bible.name || "")})`

        return label
    }
</script>

<svelte:window on:keydown={(e) => isOpen && e.key === "Escape" && toggleExpand()} />

{#if isOpen}
    <div class="backdrop" on:mousedown|self={toggleExpand} transition:fade={{ duration: 250 }}></div>
{/if}

{#if !isOpen && suggestions.length}
    <div class="ai-suggestions">
        {#each suggestions as suggestion (suggestion.id)}
            <div class="suggestion" transition:fly={{ y: 20, duration: 250 }}>
                <div class="suggestionHeader">
                    <span class="reference">{getReferenceLabel(suggestion, $scriptures)}</span>
                    <span class="confidence {suggestion.confidence}"><T id="ai_scripture.confidence_{suggestion.confidence}" /></span>

                    <div class="fill" />

                    <MaterialButton icon="close" title="ai_scripture.dismiss" on:click={() => dismissSuggestion(suggestion.id)} />
                </div>

                {#if suggestion.quote}
                    <p class="quote">"{suggestion.quote}"</p>
                {/if}

                <div class="suggestionActions">
                    <MaterialButton small icon="play" disabled={$outLocked} title="ai_scripture.project" on:click={() => projectDetection(suggestion, true)}>
                        <T id="ai_scripture.project" />
                    </MaterialButton>
                    <MaterialButton small icon="scripture" title="ai_scripture.show_in_drawer" on:click={() => showInDrawer(suggestion)}>
                        <T id="ai_scripture.show_in_drawer" />
                    </MaterialButton>
                </div>
            </div>
        {/each}
    </div>
{/if}

<div class="speech-widget {isOpen ? 'is-open' : 'is-closed'}">
    <AiRing {state} {audioLevel} borderRadius={isOpen ? "20px" : "50%"} fill>
        {#if !isOpen}
            <button class="floating-trigger" on:click={toggleExpand} aria-label="Expand Speech Recognition Modal">
                {#if state === "inactive" || state === "error"}
                    <svg class="mic-icon" class:error={state === "error"} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                {:else if state === "listening"}
                    <div class="fluid-audio-visualizer" style="--audio-level: {audioLevel}">
                        <div class="wave-ring ring-1"></div>
                        <div class="wave-ring ring-2"></div>
                        <div class="center-core"></div>
                    </div>
                {:else if state === "processing"}
                    <div class="spinner"></div>
                {/if}
            </button>
        {:else}
            <div class="modal-view">
                <div class="card-header">
                    <div class="ai-badge">
                        <p style="font-weight: bold;">{state.replace("_", " ").toUpperCase()}...</p>
                    </div>

                    <MaterialButton class="popup-close" icon="close" iconSize={1.3} title="actions.close" style="padding: 10px;" on:click={toggleExpand} />
                </div>

                <div class="card-body">
                    {#if state === "inactive"}
                        <p class="placeholder"><T id="ai.select_mic" /></p>
                    {:else if state === "error"}
                        <p class="placeholder error">{translateText(aiScriptureErrorText((sessionMode === "scripture" ? $aiScriptureStatus.message : $aiStatus.message) || "start_failed"))}</p>
                    {:else if state === "processing"}
                        <div class="processing-view">
                            <div class="spinner large"></div>
                            <p><T id="ai.processing" /></p>
                        </div>
                    {:else}
                        <div class="transcript-box">
                            {#each $aiScriptureTranscript as segment}
                                <p class:music={segment.music}>
                                    <!-- {#if interpretationMode && segment.language}<span class="langTag">{segment.language.toUpperCase()} ·</span>{/if} -->
                                    {segment.text}
                                </p>
                            {/each}
                        </div>
                    {/if}

                    <!-- WIP options -->
                </div>
            </div>
        {/if}
    </AiRing>
</div>

<style>
    :root {
        --bg-dark: #090d16;
        --card-bg: #111827;
    }

    .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(8px);
        z-index: 9998;
    }

    .speech-widget {
        position: fixed;
        z-index: 9999;
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
        width: 420px;
        height: 300px;
        max-width: 90vw;
    }

    .floating-trigger {
        width: 100%;
        height: 100%;
        border: none;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
    }

    .mic-icon {
        width: 24px;
        height: 24px;
        stroke: #94a3b8;
    }
    .mic-icon.error {
        stroke: #ff2626;
    }

    /* Dynamic Fluid Audio Visualizer */
    .fluid-audio-visualizer {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .center-core {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--ai-gradient);
        transform: scale(calc(1 + var(--audio-level) * 0.6));
        transition: transform 0.08s ease-out;
        z-index: 2;
    }

    .wave-ring {
        position: absolute;
        border-radius: 50%;
        background: var(--ai-gradient);
        opacity: 0.4;
        z-index: 1;
        transition:
            transform 0.08s ease-out,
            opacity 0.08s ease-out;
    }

    .wave-ring.ring-1 {
        width: 24px;
        height: 24px;
        transform: scale(calc(1 + var(--audio-level) * 1.2));
        opacity: calc(0.2 + var(--audio-level) * 0.5);
        filter: blur(2px);
    }

    .wave-ring.ring-2 {
        width: 36px;
        height: 36px;
        transform: scale(calc(1 + var(--audio-level) * 0.8));
        opacity: calc(0.1 + var(--audio-level) * 0.3);
        filter: blur(4px);
    }

    /* Modal Layout Elements */
    .modal-view {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .card-header {
        padding: 10px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #1e293b;
        background: var(--bg-dark);
    }

    .ai-badge {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .card-body {
        flex: 1;
        padding: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--card-bg);
        overflow-y: auto;
    }

    .transcript-box {
        width: 100%;
        max-height: 100%;
        font-size: 0.95rem;
        line-height: 1.5;
    }

    /* whisper's guessed lyrics for music - shown for context, but faded & never used for detection */
    .transcript-box .music {
        opacity: 0.45;
        font-style: italic;
    }

    .placeholder {
        font-style: italic;
        font-size: 0.9rem;
    }
    .placeholder.error {
        color: #ff5050;
        font-style: normal;
    }

    .processing-view {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        color: #00dfd8;
    }

    /* Suggestions */
    .ai-suggestions {
        position: fixed;
        bottom: 120px;
        right: 45px;
        z-index: 9999;
        display: flex;
        flex-direction: column-reverse;
        gap: 8px;
        width: 340px;
        max-width: 90vw;
    }

    .suggestion {
        display: flex;
        flex-direction: column;
        gap: 3px;
        background: var(--card-bg, #111827);
        border: 1px solid #1e293b;
        border-radius: 12px;
        padding: 8px 12px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
    }

    .fill {
        flex: 1;
    }

    .suggestionHeader {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .suggestionHeader .reference {
        font-weight: 600;
        color: var(--secondary);
        white-space: nowrap;
    }

    .confidence {
        font-size: 0.7em;
        text-transform: uppercase;
        padding: 1px 6px;
        border-radius: 10px;
        white-space: nowrap;
    }
    .confidence.high {
        background-color: rgb(39 168 39 / 0.25);
        color: #6fdc6f;
    }
    .confidence.medium {
        background-color: rgb(255 165 0 / 0.25);
        color: #ffc966;
    }
    .confidence.low {
        background-color: rgb(255 80 80 / 0.25);
        color: #ff9090;
    }

    .quote {
        font-style: italic;
        font-size: 0.85em;
        opacity: 0.7;
        white-space: initial;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
    }

    .suggestionActions {
        display: flex;
        gap: 5px;
    }

    /* Animations */
    .spinner {
        width: 22px;
        height: 22px;
        border: 2px solid rgba(255, 255, 255, 0.15);
        border-top-color: #00dfd8;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    .spinner.large {
        width: 32px;
        height: 32px;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
