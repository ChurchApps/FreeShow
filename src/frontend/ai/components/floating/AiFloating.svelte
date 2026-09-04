<script lang="ts">
    import { onDestroy } from "svelte"
    import { fade, fly } from "svelte/transition"
    import Icon from "../../../components/helpers/Icon.svelte"
    import T from "../../../components/helpers/T.svelte"
    import MaterialButton from "../../../components/inputs/MaterialButton.svelte"
    import Center from "../../../components/system/Center.svelte"
    import { activePage, ai, aiInterim, aiSmartAction, aiSttStatus, aiSuggestions, aiTranscript, language, outLocked, settingsTab } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { audioLevelStore, resolveSttEngine, SpeechToText } from "../../stt/stt"
    import AiRing from "./AiRing.svelte"
    import ConfidenceMeter from "./ConfidenceMeter.svelte"
    import { copyTranscript, dismissAiSuggestion, groupTranscriptLines } from "./transcript"

    let state: "inactive" | "error" | "listening" | "processing" = "inactive"

    let isOpen = false
    function toggleExpand() {
        // close any visible actions
        aiSmartAction.set(null)

        setTimeout(() => (isOpen = !isOpen))

        enableListening()
    }

    // the transcript follows the speech while pinned to the bottom - scrolling up to read
    // history stops the auto-jump until the user returns to the bottom
    let transcriptElem: HTMLElement | undefined
    let transcriptPinned = true
    let autoScrollTimer: NodeJS.Timeout | null = null
    $: if (isOpen && transcriptPinned && (transcriptLines.length || $aiInterim) && transcriptElem) scrollToBottom()
    $: if (!isOpen) transcriptPinned = true
    function scrollToBottom() {
        setTimeout(() => {
            if (!transcriptElem) return
            // already at the bottom: no scroll, and crucially no guard window that would swallow
            // a genuine user scroll gesture arriving between updates
            if (transcriptElem.scrollHeight - transcriptElem.scrollTop - transcriptElem.clientHeight < 2) return
            // the jump is instant (no smooth animation), so its single scroll event stays inside
            // this short guard instead of reading as a user unpin
            if (autoScrollTimer) clearTimeout(autoScrollTimer)
            autoScrollTimer = setTimeout(() => (autoScrollTimer = null), 150)
            transcriptElem.scrollTo(0, transcriptElem.scrollHeight)
        })
    }
    function onTranscriptScroll() {
        if (!transcriptElem || autoScrollTimer) return
        transcriptPinned = transcriptElem.scrollHeight - transcriptElem.scrollTop - transcriptElem.clientHeight < 40
    }

    // nemotron emits an utterance in fragments - group them into one line per utterance
    // (whisper sets no utteranceEnd flags, so it falls back to grouping on pause gaps)
    $: transcriptLines = groupTranscriptLines($aiTranscript)

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

    // SUGGESTIONS
    // confident suggestions surface here so the operator can present them with one click

    $: suggestions = $aiSuggestions
    $: smartAction = $aiSmartAction
</script>

<svelte:window on:keydown={(e) => isOpen && e.key === "Escape" && toggleExpand()} />

{#if isOpen}
    <div class="backdrop" on:mousedown|self={toggleExpand} transition:fade={{ duration: 250 }}></div>
{/if}

<!-- this will show the latest transcript segment (& interim) -->
<!-- {#if !isOpen && isListening && (latestSegment || $aiInterim)}
    <div class="ticker-wrap">
        <AiRing {state} {audioLevel} borderRadius="12px" borderWidth="1.5px">
            <button class="ticker" on:click={toggleExpand}>
                {latestSegment}{#if $aiInterim}{" "}<span class="interim">{$aiInterim}</span>{/if}
            </button>
        </AiRing>
    </div>
{/if} -->

{#if !isOpen && smartAction && state !== "inactive"}
    <div class="ticker-wrap" transition:fly={{ x: 45 + 62 / 2, duration: 200 }}>
        <!-- border-radius: 50px 10px 10px 50px; -->
        <MaterialButton
            style="padding: 0;border-radius: 50px;"
            on:click={() => {
                if (smartAction?.trigger) {
                    smartAction.trigger()
                    setTimeout(() => aiSmartAction.set(null), 500)
                } else {
                    aiSmartAction.set(null)
                }
            }}
        >
            <!-- borderRadius="20px 10px 10px 20px" -->
            <AiRing opacity={0.85}>
                <div class="suggestion" style="margin-right: calc((62px / 2) - 4px);">
                    {#if smartAction?.action === "presented"}
                        <Icon id="check" white />
                        <p>Presented:</p>
                        <span style="font-weight: bold;">{smartAction.content}</span>
                    {:else if smartAction?.action === "present"}
                        <Icon id="play" white />
                        <p>Click to present:</p>
                        <span style="font-weight: bold;">{smartAction.content}</span>
                    {/if}

                    {#if smartAction?.confidence}
                        <ConfidenceMeter confidence={smartAction.confidence} />
                    {/if}
                </div>
            </AiRing>
        </MaterialButton>
    </div>
{/if}

<div class="speech-widget {isOpen ? 'is-open' : 'is-closed'}">
    <AiRing {state} {audioLevel} borderRadius={isOpen ? "20px" : "50%"} opacity={isOpen ? 0.8 : 0.4} fill>
        {#if !isOpen}
            <button class="floating-trigger" on:click={toggleExpand} aria-label="Expand Speech Recognition Modal">
                {#if state === "inactive" || state === "error"}
                    <svg class="mic-icon" class:error={state === "error"} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                {:else if state === "listening"}
                    <div class="smoky-audio-visualizer" style="--audio-level: {Math.min(audioLevel * 8, 1)}">
                        <div class="smoke-layer layer-4"></div>
                        <div class="smoke-layer layer-3"></div>
                        <div class="smoke-layer layer-2"></div>
                        <div class="smoke-layer layer-1"></div>
                    </div>
                {:else if state === "processing"}
                    <div class="spinner"></div>
                {/if}
            </button>
        {:else}
            <div class="modal-view">
                <div class="card-header">
                    <div class="ai-badge">
                        <p style="font-weight: bold;">{state.toUpperCase()}</p>
                    </div>

                    <div class="headerActions">
                        {#if transcriptLines.length}
                            <MaterialButton icon="copy" title="ai.copy_transcript" on:click={copyTranscript} />
                        {/if}
                        <MaterialButton icon="settings" title="menu.settings" on:click={openSettings} />

                        <MaterialButton class="popup-close" icon="close" iconSize={1.3} title="actions.close" style="padding: 10px;" on:click={toggleExpand} />
                    </div>
                </div>

                <div class="card-body">
                    {#if state === "inactive"}
                        <Center faded>
                            <T id="remote.loading" />
                        </Center>
                    {:else if state === "error"}
                        <p class="placeholder error">{translateText($aiSttStatus.message || "ai.error_start_failed")}</p>
                    {:else if state === "processing"}
                        <div class="processing-view">
                            <div class="spinner large"></div>
                            <p><T id="ai.processing" /></p>
                        </div>
                    {:else if transcriptLines.length || $aiInterim}
                        <!-- "context #ai_transcript" wires the right-click menu (copy selection / copy transcript) -->
                        <div class="transcript-box context #ai_transcript" bind:this={transcriptElem} on:scroll={onTranscriptScroll}>
                            {#each transcriptLines as line}
                                <p class:music={line.music}>
                                    {line.text}{#if line.open && $aiInterim}{" "}<span class="interim">{$aiInterim}</span>{/if}
                                </p>
                            {/each}
                            {#if $aiInterim && !transcriptLines[transcriptLines.length - 1]?.open}
                                <p><span class="interim">{$aiInterim}</span></p>
                            {/if}
                        </div>
                    {:else}
                        <Center faded>
                            <T id="ai.waiting_for_audio" />
                        </Center>
                    {/if}
                </div>

                {#if suggestions.length}
                    <div class="suggestions-panel">
                        {#each suggestions as suggestion (suggestion.id)}
                            <div class="suggestion compact">
                                <div class="suggestionHeader">
                                    <span class="reference">{suggestion.content}</span>
                                    {#if suggestion.confidence}
                                        <ConfidenceMeter confidence={suggestion.confidence} />
                                    {/if}

                                    <div class="fill" />

                                    {#if suggestion.action === "presented"}
                                        <Icon id="check" size={0.9} color="var(--primary-lighter)" title="ai.presented" />
                                    {:else if suggestion.trigger}
                                        <MaterialButton
                                            small
                                            icon="play"
                                            disabled={$outLocked}
                                            title="menu._title_display"
                                            on:click={() => {
                                                suggestion.trigger?.()
                                                // dismissAiSuggestion(suggestion.id)
                                            }}
                                        />
                                    {/if}
                                    <MaterialButton small icon="close" title="actions.remove" on:click={() => dismissAiSuggestion(suggestion.id)} />
                                </div>
                            </div>
                        {/each}
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

    /* the AI surface floats above the app UI (<= 1001) but stays UNDER the modal tier -
       popup backdrops sit at 4999, popups at 5000 and the context menu at 5001, so
       right-click menus & dialogs always cover the bubble */
    .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(8px);
        z-index: 4997;
    }

    .speech-widget {
        position: fixed;
        z-index: 4998;
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

        /* Clips all burst and smoke transformations to the bubble's circular bounds */
        border-radius: 50%;
        overflow: hidden;
    }

    .mic-icon {
        width: 24px;
        height: 24px;
        stroke: #94a3b8;
    }
    .mic-icon.error {
        stroke: #ff2626;
    }

    /* Dynamic Ambient Smoky Visualizer */
    .smoky-audio-visualizer {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        overflow: hidden;
    }

    .smoke-layer {
        position: absolute;
        /* Soft-edge gradient that bleeds to transparent to eliminate hard circles */
        background: radial-gradient(circle at center, rgba(0, 255, 255, 0.9) 0%, rgba(255, 0, 127, 0.7) 40%, rgba(121, 40, 202, 0.4) 75%, rgba(0, 0, 0, 0) 100%);
        mix-blend-mode: screen;
        pointer-events: none;
        border-radius: 50%;

        /* Fast spring transition for instant reaction to audio peaks */
        transition:
            transform 0.05s cubic-bezier(0, 0.95, 0.1, 1),
            opacity 0.05s ease-out,
            filter 0.05s ease-out;
    }

    /* Layer 1 (Inner soft mist cloud) */
    .smoke-layer.layer-1 {
        width: 14px;
        height: 14px;
        z-index: 4;
        /* Elevated idle opacity from 0.3 -> 0.6 */
        opacity: calc(0.6 + var(--audio-level) * 0.4);
        filter: blur(5px);
        animation: idleFloat1 5s ease-in-out infinite alternate;
        transform: scale(calc(1.8 + var(--audio-level) * 5)) rotate(calc(var(--audio-level) * 200deg));
    }

    /* Layer 2 (Mid blooming cloud) */
    .smoke-layer.layer-2 {
        width: 18px;
        height: 18px;
        z-index: 3;
        /* Elevated idle opacity from 0.2 -> 0.45 */
        opacity: calc(0.45 + var(--audio-level) * 0.5);
        filter: blur(8px);
        animation: idleFloat2 7s ease-in-out infinite alternate;
        transform: scale(calc(2.2 + var(--audio-level) * 7)) rotate(calc(var(--audio-level) * -280deg));
    }

    /* Layer 3 (Outer plume) */
    .smoke-layer.layer-3 {
        width: 22px;
        height: 22px;
        z-index: 2;
        /* Elevated idle opacity from 0.1 -> 0.3 */
        opacity: calc(0.3 + var(--audio-level) * 0.6);
        filter: blur(12px);
        animation: idleFloat1 10s ease-in-out infinite reverse;
        transform: scale(calc(2.6 + var(--audio-level) * 9)) rotate(calc(var(--audio-level) * 360deg));
    }

    /* Layer 4 (Deep dissipation haze) */
    .smoke-layer.layer-4 {
        width: 26px;
        height: 26px;
        z-index: 1;
        /* Elevated idle opacity from 0.05 -> 0.2 */
        opacity: calc(0.2 + var(--audio-level) * 0.7);
        filter: blur(15px);
        animation: idleFloat2 13s ease-in-out infinite reverse;
        transform: scale(calc(3 + var(--audio-level) * 11)) rotate(calc(var(--audio-level) * -440deg));
    }

    /* Gentle ambient idle motion when silent */
    @keyframes idleFloat1 {
        0% {
            border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
            transform: rotate(0deg) scale(0.95);
        }
        50% {
            border-radius: 60% 30% 50% 70% / 50% 60% 30% 60%;
        }
        100% {
            border-radius: 30% 60% 40% 70% / 60% 40% 70% 30%;
            transform: rotate(180deg) scale(1.05);
        }
    }

    @keyframes idleFloat2 {
        0% {
            border-radius: 60% 40% 30% 70% / 50% 30% 70% 50%;
            transform: rotate(0deg) scale(1.05);
        }
        50% {
            border-radius: 30% 60% 70% 40% / 60% 40% 50% 60%;
        }
        100% {
            border-radius: 50% 30% 60% 40% / 40% 70% 30% 60%;
            transform: rotate(-180deg) scale(0.95);
        }
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
        background-color: rgb(0 0 0 / 0.1);
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
        padding: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow-y: auto;
    }

    .transcript-box {
        width: 100%;
        max-height: 100%;
        overflow-y: auto;
        padding: 15px;
        /* no smooth scrolling: the follow-the-speech jump must not animate past its guard
           window, or its trailing scroll events read as the user unpinning the view */
        font-size: 0.95rem;
        line-height: 1.5;
        cursor: text;
    }

    /* the global stylesheet disables selection everywhere - the transcript is one of the few
       places the user genuinely copies text from (the * rule hits every child, so both levels
       need the override) */
    .transcript-box,
    .transcript-box p,
    .transcript-box span {
        user-select: text;
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

    /* the open utterance's unstable tail - visible right away, solidifies once confirmed */
    .interim {
        opacity: 0.45;
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

    /* on the closed bubble's row, to its left (bubble: 62px at 45px/45px) */
    .ticker-wrap {
        display: flex;
        max-width: 60vw;

        position: fixed;
        /* right: 112px; */
        right: calc(45px + (62px / 2));
        bottom: calc(45px + (62px / 2));
        transform: translateY(50%);
        z-index: 4998;

        /* the ring's inner card is opaque; the drop shadow lifts it off whatever panel is behind */
        filter: drop-shadow(0 8px 25px rgba(0, 0, 0, 0.5));
    }

    .suggestion {
        display: flex;
        align-items: center;
        gap: 8px;

        padding: 8px 12px;
    }

    /* the popup shows the whole suggestion list (the closed stack only keeps the newest three) */
    .suggestions-panel {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 200px;
        overflow-y: auto;
        flex-shrink: 0;

        background-color: rgb(0 0 0 / 0.1);
        border-top: 1px solid rgba(0, 0, 0, 0.3);
    }

    .suggestion.compact {
        gap: 1px;
        padding: 5px 10px;
        box-shadow: none;
    }

    .fill {
        flex: 1;
    }

    .suggestionHeader {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
    }
    .suggestionHeader .reference {
        font-weight: 600;
        white-space: nowrap;
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
