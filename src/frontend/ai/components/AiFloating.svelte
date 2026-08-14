<script lang="ts">
    import { onDestroy } from "svelte"
    import { fade, fly } from "svelte/transition"
    import type { DetectedReference } from "../../../types/ai/AiScripture"
    import { getShortBibleName } from "../../components/drawer/bible/scripture"
    import T from "../../components/helpers/T.svelte"
    import MaterialButton from "../../components/inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../components/inputs/MaterialDropdown.svelte"
    import MaterialToggleSwitch from "../../components/inputs/MaterialToggleSwitch.svelte"
    import { activePage, ai, aiScriptureAutoPaused, aiScriptureHasProjected, aiScriptureStatus, aiScriptureSuggestions, aiScriptureTranscript, aiStatus, outLocked, scriptures, settingsTab } from "../../stores"
    import { translateText } from "../../utils/language"
    import { aiScriptureErrorText, dismissSuggestion, projectDetection, restorePrevious, resumeAutoProjection, showInDrawer, startAiScriptureListening, stopAiScriptureListening } from "../scripture/aiScripture"
    import { audioLevelStore, SpeechToText } from "../stt/stt"
    import AiRing from "./AiRing.svelte"

    let state: "inactive" | "error" | "listening" | "processing" = "inactive"

    let isOpen = false
    function toggleExpand() {
        isOpen = !isOpen
    }

    // the transcript follows the speech - newest segment stays in view
    let transcriptElem: HTMLElement | undefined
    $: if (isOpen && $aiScriptureTranscript.length && transcriptElem) scrollToBottom()
    function scrollToBottom() {
        setTimeout(() => transcriptElem?.scrollTo(0, transcriptElem.scrollHeight))
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
    let lastEngine = ""

    $: engineId = $ai.stt?.engine || "whisper"

    $: syncSession(isEnabled, scriptureEnabled, micDeviceId, engineId)
    async function syncSession(enabled: boolean | undefined, scripture: boolean, mic: string | undefined, engine: string) {
        const mode = enabled && scripture ? "scripture" : enabled && mic ? "stt" : "off"
        const micChanged = (mic || "") !== lastMic
        const engineChanged = engine !== lastEngine

        if (mode === sessionMode) {
            if (mode === "off" || (!micChanged && !engineChanged)) return

            // switching the input or the engine mid-session only swaps that piece -
            // the rest of the pipeline (and scripture detection) keeps running
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
    $: scriptureState = $aiScriptureStatus.state
    $: if (sessionMode === "scripture") state = mapScriptureState(scriptureState)
    function mapScriptureState(currentState: string): typeof state {
        if (currentState === "listening" || currentState === "llm_paused") return "listening"
        if (currentState === "starting") return "processing"
        if (currentState === "error") return "error"
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

    // LISTEN TOGGLE
    // the session normally follows the settings toggles - this is the manual pause/resume on top

    $: isListening = state === "listening"
    $: isStarting = state === "processing"
    async function toggleListening() {
        if (isStarting || sessionMode === "off") return

        if (sessionMode === "scripture") {
            if (isListening) {
                stopAiScriptureListening()
                return
            }
            state = "processing"
            await startAiScriptureListening()
            return
        }

        if (isListening) {
            SpeechToText.disable()
            state = "inactive"
        } else {
            const result = await SpeechToText.enable()
            if (sessionMode === "stt") state = result.ok ? "listening" : "error"
        }
    }

    function openSetup() {
        isOpen = false
        settingsTab.set("ai")
        activePage.set("settings")
    }

    // QUICK SETTINGS (inside the popup)

    function updateScripture(key: string, value: any) {
        ai.update((a) => {
            if (!a.scripture) a.scripture = {}
            a.scripture[key] = value
            return a
        })
    }

    const modeOptions = [
        { value: "confirm", label: translateText("ai_scripture.mode_confirm") },
        { value: "auto", label: translateText("ai_scripture.mode_auto") }
    ]

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

    // TICKER - the latest transcript line, visible without opening the bubble

    $: latestSegment = $aiScriptureTranscript[$aiScriptureTranscript.length - 1]?.text || ""
</script>

<svelte:window on:keydown={(e) => isOpen && e.key === "Escape" && toggleExpand()} />

{#if isOpen}
    <div class="backdrop" on:mousedown|self={toggleExpand} transition:fade={{ duration: 250 }}></div>
{/if}

{#if !isOpen && (suggestions.length || $aiScriptureAutoPaused || $aiScriptureHasProjected || (isListening && latestSegment))}
    <div class="ai-stack">
        {#if isListening && latestSegment}
            <button class="ticker" title={translateText("ai_scripture.transcript")} on:click={toggleExpand}>{latestSegment}</button>
        {/if}

        {#if $aiScriptureAutoPaused || $aiScriptureHasProjected}
            <div class="chips" transition:fly={{ y: 20, duration: 250 }}>
                {#if $aiScriptureAutoPaused}
                    <span class="badge paused"><T id="ai_scripture.auto_paused" /></span>
                    <MaterialButton icon="play" title="ai_scripture.resume_auto" on:click={() => resumeAutoProjection()} />
                {/if}

                <div class="fill" />

                {#if $aiScriptureHasProjected}
                    <MaterialButton icon="undo" title="ai_scripture.restore_previous" disabled={$outLocked} on:click={() => restorePrevious()} />
                {/if}
            </div>
        {/if}

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
                        {#if sessionMode === "scripture"}
                            <p style="font-weight: bold;"><T id="ai_scripture.state_{scriptureState}" /></p>
                        {:else}
                            <p style="font-weight: bold;">{state.toUpperCase()}</p>
                        {/if}

                        {#if sessionMode === "scripture" && isListening && $aiScriptureStatus.keyless}
                            <span class="badge" data-title={translateText($ai.scripture?.quoteMatching !== false ? "ai_scripture.on_device_tip" : "ai_scripture.keyless_tip")}>
                                <T id={$ai.scripture?.quoteMatching !== false ? "ai_scripture.on_device_only" : "ai_scripture.explicit_only"} />
                            </span>
                        {/if}
                    </div>

                    <div class="headerActions">
                        {#if $aiScriptureAutoPaused}
                            <MaterialButton icon="play" title="ai_scripture.resume_auto" on:click={() => resumeAutoProjection()} />
                        {/if}
                        {#if $aiScriptureHasProjected}
                            <MaterialButton icon="undo" title="ai_scripture.restore_previous" disabled={$outLocked} on:click={() => restorePrevious()} />
                        {/if}
                        <MaterialButton icon={isListening ? "stop" : "microphone"} title={isListening ? "ai_scripture.stop_listening" : "ai_scripture.start_listening"} isActive={isListening} disabled={isStarting || sessionMode === "off"} on:click={toggleListening} />
                        <MaterialButton class="popup-close" icon="close" iconSize={1.3} title="actions.close" style="padding: 10px;" on:click={toggleExpand} />
                    </div>
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
                    {:else if $aiScriptureTranscript.length}
                        <div class="transcript-box" bind:this={transcriptElem}>
                            {#each $aiScriptureTranscript as segment}
                                <p class:music={segment.music}>{segment.text}</p>
                            {/each}
                        </div>
                    {:else}
                        <p class="placeholder"><T id="ai_scripture.waiting_for_audio" /></p>
                    {/if}
                </div>

                {#if sessionMode === "scripture"}
                    <div class="card-footer">
                        <MaterialDropdown label="ai_scripture.mode" options={modeOptions} value={$ai.scripture?.mode || "confirm"} defaultValue="confirm" on:change={(e) => updateScripture("mode", e.detail)} />
                        <MaterialToggleSwitch label="ai_scripture.voice_commands" checked={$ai.scripture?.voiceCommands === true} defaultValue={false} on:change={(e) => updateScripture("voiceCommands", e.detail)} />
                        <MaterialButton icon="settings" title="ai_scripture.setup" on:click={openSetup} />
                    </div>
                {/if}
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
        width: 440px;
        height: 360px;
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
        padding: 5px 10px 5px 20px;
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
        text-transform: uppercase;
        font-weight: bold;
    }

    .headerActions {
        display: flex;
        align-items: center;
        gap: 2px;
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

    .card-footer {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-top: 1px solid #1e293b;
        background: var(--bg-dark);
    }

    .transcript-box {
        width: 100%;
        max-height: 100%;
        overflow-y: auto;
        scroll-behavior: smooth;
        font-size: 0.95rem;
        line-height: 1.5;
    }

    /* the app's global styles ellipsize paragraphs - transcript lines must wrap instead */
    .transcript-box p {
        white-space: initial;
        overflow-wrap: anywhere;
        margin: 2px 0;
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
        white-space: initial;
    }

    .processing-view {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        color: #00dfd8;
    }

    /* Floating stack above the closed bubble: ticker, action chips & suggestion cards */
    .ai-stack {
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

    .ticker {
        border: none;
        text-align: end;
        background: rgba(17, 24, 39, 0.85);
        color: inherit;
        border-radius: 12px;
        padding: 6px 12px;
        font-size: 0.85em;
        opacity: 0.8;
        cursor: pointer;
        white-space: initial;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        align-self: flex-end;
        max-width: 100%;
    }

    .chips {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--card-bg, #111827);
        border: 1px solid #1e293b;
        border-radius: 12px;
        padding: 4px 8px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
    }

    .badge {
        background-color: rgba(9, 13, 22, 0.9);
        border-radius: 12px;
        padding: 1px 8px;
        font-size: 0.7em;
        text-transform: uppercase;
        white-space: nowrap;
        opacity: 0.9;
    }
    .badge.paused {
        color: #ffa500;
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
