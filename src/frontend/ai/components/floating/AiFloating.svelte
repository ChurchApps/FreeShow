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

    // each newly registered word bumps a border confirmation pulse on the floating bubble
    let wordConfirmTick = 0
    let wordConfirmDurationMs = 260
    let previousWordCount = -1
    let burstWords = 0
    let burstTimer: NodeJS.Timeout | null = null
    $: updateWordConfirmation(transcriptLines)

    function updateWordConfirmation(lines: { text: string }[]) {
        const nextCount = countRegisteredWords(lines)

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

    function countRegisteredWords(lines: { text: string }[]) {
        return lines.reduce((total, line) => {
            const words = line.text.match(/\S+/g)
            return total + (words?.length || 0)
        }, 0)
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
    <AiRing {state} {audioLevel} borderRadius={isOpen ? "20px" : "50%"} opacity={isOpen ? 0.8 : 0.4} fill {wordConfirmTick} {wordConfirmDurationMs}>
        {#if !isOpen}
            <button class="floating-trigger" on:click={toggleExpand} aria-label="Expand Speech Recognition Modal">
                {#if state === "inactive" || state === "error"}
                    <svg class="mic-icon" class:error={state === "error"} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                {:else if state === "listening"}
                    <div class="smoky-audio-visualizer" style="--audio-level: {Math.min(audioLevel * 4, 1)}">
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
                        <div class="transcript-box" bind:this={transcriptElem} on:scroll={onTranscriptScroll}>
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

    /* Living cloud / crystal audio visualizer */
    .smoky-audio-visualizer {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        overflow: hidden;
        /* isolation: isolate;
        background: radial-gradient(circle at 42% 38%, rgba(255, 255, 255, 0.18), transparent 24%), radial-gradient(circle at 58% 62%, rgba(88, 210, 255, 0.12), transparent 38%), radial-gradient(circle, rgba(10, 34, 48, 0.78) 0%, rgba(5, 12, 22, 0.94) 74%); */
    }

    /* Slow inner atmosphere: keeps the orb alive even in quiet input. */
    .smoky-audio-visualizer::before {
        content: "";
        position: absolute;
        inset: -22%;
        border-radius: 44% 56% 61% 39% / 46% 42% 58% 54%;
        background: radial-gradient(circle at 30% 35%, rgba(121, 255, 245, 0.24), transparent 34%), radial-gradient(circle at 70% 58%, rgba(132, 112, 255, 0.2), transparent 37%), radial-gradient(circle at 48% 72%, rgba(255, 118, 199, 0.12), transparent 32%);
        filter: blur(10px) saturate(1.15);
        opacity: calc(0.52 + var(--audio-level) * 0.22);
        transform: scale(calc(0.92 + var(--audio-level) * 0.2));
        animation: cloudDrift 8s ease-in-out infinite alternate;
    }

    /* Small glass glint: enough crystal to feel dimensional without becoming a gem icon. */
    .smoky-audio-visualizer::after {
        content: "";
        position: absolute;
        width: 46%;
        height: 28%;
        top: 17%;
        left: 20%;
        border-radius: 50%;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.36), rgba(255, 255, 255, 0));
        filter: blur(2px);
        opacity: calc(0.18 + var(--audio-level) * 0.18);
        transform: rotate(-24deg);
        mix-blend-mode: screen;
    }

    .smoke-layer {
        position: absolute;
        pointer-events: none;
        border-radius: 42% 58% 55% 45% / 48% 43% 57% 52%;
        background: radial-gradient(circle at 34% 28%, rgba(255, 255, 255, 0.38), transparent 25%), linear-gradient(135deg, rgba(80, 246, 235, 0.48), rgba(119, 105, 255, 0.34) 54%, rgba(246, 118, 200, 0.22));
        box-shadow:
            inset 0 0 8px rgba(255, 255, 255, 0.14),
            0 0 14px rgba(58, 225, 224, 0.15);
        mix-blend-mode: screen;
        will-change: transform, rotate, filter, opacity;
        transition:
            transform 150ms cubic-bezier(0.2, 0.8, 0.2, 1),
            opacity 120ms ease-out,
            filter 120ms ease-out;
    }

    /* The layers react with different amplitudes so the center feels fluid, not synchronized. */
    .smoke-layer.layer-1 {
        width: 17px;
        height: 17px;
        z-index: 4;
        opacity: calc(0.62 + var(--audio-level) * 0.28);
        border-radius: 38% 62% 48% 52% / 56% 42% 58% 44%;
        clip-path: polygon(50% 0%, 88% 22%, 100% 62%, 72% 100%, 26% 92%, 0% 54%, 16% 18%);
        filter: blur(0.2px) drop-shadow(0 0 5px rgba(212, 255, 252, 0.34));
        transform: translate(-1px, -1px) scale(calc(1 + var(--audio-level) * 1.05));
        animation: crystalTurn 7s ease-in-out infinite;
    }

    .smoke-layer.layer-2 {
        width: 29px;
        height: 25px;
        z-index: 3;
        opacity: calc(0.42 + var(--audio-level) * 0.28);
        filter: blur(1.4px);
        transform: translate(4px, 2px) scale(calc(0.92 + var(--audio-level) * 0.9));
        animation: cloudTurnReverse 9s ease-in-out infinite alternate;
    }

    .smoke-layer.layer-3 {
        width: 40px;
        height: 34px;
        z-index: 2;
        opacity: calc(0.3 + var(--audio-level) * 0.26);
        border-radius: 62% 38% 57% 43% / 42% 58% 40% 60%;
        filter: blur(3.2px);
        transform: translate(-4px, 4px) scale(calc(0.9 + var(--audio-level) * 0.72));
        animation: cloudTurn 11s ease-in-out infinite alternate;
    }

    .smoke-layer.layer-4 {
        width: 52px;
        height: 45px;
        z-index: 1;
        opacity: calc(0.2 + var(--audio-level) * 0.22);
        border-radius: 48% 52% 36% 64% / 62% 38% 58% 42%;
        filter: blur(6px);
        transform: translate(3px, -2px) scale(calc(0.88 + var(--audio-level) * 0.58));
        animation: cloudTurnReverse 14s ease-in-out infinite alternate;
    }

    /* Rotate independently from transform so audio scaling remains active. */
    @keyframes crystalTurn {
        0%,
        100% {
            rotate: -8deg;
        }
        50% {
            rotate: 22deg;
        }
    }

    @keyframes cloudTurn {
        0% {
            rotate: -12deg;
        }
        100% {
            rotate: 18deg;
        }
    }

    @keyframes cloudTurnReverse {
        0% {
            rotate: 16deg;
        }
        100% {
            rotate: -14deg;
        }
    }

    @keyframes cloudDrift {
        0% {
            rotate: -8deg;
            translate: -2px 1px;
        }
        50% {
            rotate: 8deg;
            translate: 2px -1px;
        }
        100% {
            rotate: 15deg;
            translate: -1px 2px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .smoky-audio-visualizer::before,
        .smoke-layer {
            animation: none;
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
