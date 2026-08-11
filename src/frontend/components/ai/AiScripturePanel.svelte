<script lang="ts">
    import type { DetectedReference } from "../../../types/ai/AiScripture"
    import { aiScriptureErrorText, dismissSuggestion, projectDetection, restorePrevious, resumeAutoProjection, showInDrawer, startAiScriptureListening, stopAiScriptureListening } from "../../ai/aiScripture"
    import { activePage, ai, aiScriptureAutoPaused, aiScriptureHasProjected, aiScriptureStatus, aiScriptureSuggestions, aiScriptureTranscript, outLocked, scriptures, settingsTab } from "../../stores"
    import { translateText } from "../../utils/language"
    import { getShortBibleName } from "../drawer/bible/scripture"
    import T from "../helpers/T.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"

    $: state = $aiScriptureStatus.state
    $: isListening = state === "listening" || state === "llm_paused"
    $: isStarting = state === "starting"
    $: errorText = state === "error" && $aiScriptureStatus.message ? translateText(aiScriptureErrorText($aiScriptureStatus.message)) : ""

    async function toggleListening() {
        if (isStarting) return

        if (isListening) {
            stopAiScriptureListening()
            return
        }

        const result = await startAiScriptureListening()
        // something is missing (whisper binary/model, mic access etc.) - open the setup popup
        if (!result.ok) openSetup()
    }

    function openSetup() {
        settingsTab.set("ai")
        activePage.set("settings")
    }

    // PROJECTION

    function project(suggestion: DetectedReference) {
        projectDetection(suggestion, true)
    }

    function restore() {
        restorePrevious()
    }

    function getReferenceLabel(suggestion: DetectedReference, _updater: any = null) {
        let label = `${suggestion.book} ${suggestion.chapter}:${suggestion.verseStart}`
        if (suggestion.verseEnd > suggestion.verseStart) label += `-${suggestion.verseEnd}`

        const bible = suggestion.matchedBibleId ? $scriptures[suggestion.matchedBibleId] : null
        if (bible) label += ` (${getShortBibleName(bible.customName || bible.name || "")})`

        return label
    }

    // TRANSCRIPT

    // interpretation mode: multiple languages flow through the transcript - label each segment with its detected language
    $: interpretationMode = $ai.scripture?.interpretationMode === true
    $: latestTranscript = $aiScriptureTranscript[$aiScriptureTranscript.length - 1]
    $: latestSegment = latestTranscript?.text || ""

    let transcriptExpanded = false
    let transcriptElem: HTMLElement | undefined
    $: if (transcriptExpanded && $aiScriptureTranscript.length && transcriptElem) scrollToBottom()
    function scrollToBottom() {
        setTimeout(() => transcriptElem?.scrollTo(0, transcriptElem.scrollHeight))
    }
</script>

<div class="aiPanel">
    <div class="statusRow">
        <span class="dot {state}" />
        <span class="stateLabel"><T id="ai_scripture.state_{state}" /></span>

        {#if errorText}
            <span class="errorMessage" data-title={errorText}>{errorText}</span>
        {/if}

        {#if isListening && $aiScriptureStatus.keyless}
            {#if $ai.scripture?.quoteMatching !== false}
                <span class="badge" data-title={translateText("ai_scripture.on_device_tip")}><T id="ai_scripture.on_device_only" /></span>
            {:else}
                <span class="badge" data-title={translateText("ai_scripture.keyless_tip")}><T id="ai_scripture.explicit_only" /></span>
            {/if}
        {/if}

        {#if $aiScriptureAutoPaused}
            <span class="badge paused"><T id="ai_scripture.auto_paused" /></span>
            <MaterialButton icon="play" title="ai_scripture.resume_auto" on:click={() => resumeAutoProjection()} />
        {/if}

        <div class="fill" />

        {#if $aiScriptureHasProjected}
            <MaterialButton icon="undo" title="ai_scripture.restore_previous" disabled={$outLocked} on:click={restore} />
        {/if}

        <MaterialButton icon="settings" title="ai_scripture.setup" on:click={openSetup} />
        <MaterialButton icon={isListening ? "stop" : "microphone"} title={isListening ? "ai_scripture.stop_listening" : "ai_scripture.start_listening"} isActive={isListening} disabled={isStarting} on:click={toggleListening} />
    </div>

    {#if isListening || $aiScriptureTranscript.length}
        <div class="transcript">
            {#if transcriptExpanded}
                <div class="transcriptFull" bind:this={transcriptElem}>
                    {#each $aiScriptureTranscript as segment}
                        <p class:music={segment.music}>
                            {#if interpretationMode && segment.language}<span class="langTag">{segment.language.toUpperCase()} ·</span>
                            {/if}{segment.text}
                        </p>
                    {/each}
                </div>
            {:else if latestSegment}
                <p class="ticker" on:click={() => (transcriptExpanded = true)} role="none">
                    {#if interpretationMode && latestTranscript?.language}<span class="langTag">{latestTranscript.language.toUpperCase()} ·</span>
                    {/if}{latestSegment}
                </p>
            {:else}
                <p class="ticker faded"><T id="ai_scripture.waiting_for_audio" /></p>
            {/if}

            <MaterialButton icon={transcriptExpanded ? "arrow_up" : "arrow_down"} title="ai_scripture.transcript" on:click={() => (transcriptExpanded = !transcriptExpanded)} />
        </div>
    {/if}

    {#if $aiScriptureSuggestions.length}
        <div class="suggestions">
            {#each $aiScriptureSuggestions as suggestion (suggestion.id)}
                <div class="suggestion">
                    <div class="suggestionHeader">
                        <span class="reference">{getReferenceLabel(suggestion, $scriptures)}</span>
                        <span class="confidence {suggestion.confidence}"><T id="ai_scripture.confidence_{suggestion.confidence}" /></span>

                        <div class="fill" />

                        <MaterialButton small icon="play" disabled={$outLocked} title="ai_scripture.project" on:click={() => project(suggestion)}>
                            <T id="ai_scripture.project" />
                        </MaterialButton>
                        <MaterialButton small icon="scripture" title="ai_scripture.show_in_drawer" on:click={() => showInDrawer(suggestion)}>
                            <T id="ai_scripture.show_in_drawer" />
                        </MaterialButton>

                        <MaterialButton icon="close" title="ai_scripture.dismiss" on:click={() => dismissSuggestion(suggestion.id)} />
                    </div>

                    {#if suggestion.quote}
                        <p class="quote">"{suggestion.quote}"</p>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .aiPanel {
        display: flex;
        flex-direction: column;
        background-color: var(--primary-darker);
        border-bottom: 2px solid var(--primary-lighter);
        font-size: 0.9em;
    }

    .fill {
        flex: 1;
    }

    .statusRow {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 2px 10px;
    }

    .dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background-color: var(--text);
        opacity: 0.4;
        flex-shrink: 0;
    }
    .dot.listening {
        background-color: var(--connected);
        opacity: 1;
    }
    .dot.starting {
        background-color: #ffa500;
        opacity: 1;
        animation: pulse 1.2s infinite;
    }
    .dot.llm_paused {
        background-color: #f0c800;
        opacity: 1;
    }
    .dot.error {
        background-color: #ff5050;
        opacity: 1;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.3;
        }
    }

    .stateLabel {
        text-transform: uppercase;
        font-size: 0.75em;
        font-weight: 600;
        opacity: 0.8;
        white-space: nowrap;
    }

    .errorMessage {
        font-size: 0.75em;
        color: #ff5050;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        max-width: 40%;
    }

    .badge {
        background-color: var(--primary-darkest);
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

    .transcript {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 0 5px 0 10px;
        border-top: 1px solid var(--primary-lighter);
    }
    .transcript .ticker {
        flex: 1;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        opacity: 0.7;
        cursor: pointer;
    }
    .transcript .ticker.faded {
        opacity: 0.4;
        cursor: default;
    }
    .transcriptFull {
        flex: 1;
        max-height: 150px;
        overflow-y: auto;
        padding: 5px 0;
        scroll-behavior: smooth;
    }
    .transcriptFull p {
        white-space: initial;
        opacity: 0.7;
        margin: 2px 0;
    }

    .langTag {
        opacity: 0.5;
        font-size: 0.75em;
        font-weight: 600;
        letter-spacing: 0.05em;
    }

    /* whisper's guessed lyrics for music - shown for context, but faded & never used for detection */
    .music {
        opacity: 0.45;
        font-style: italic;
    }

    .suggestions {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 5px 10px;
        border-top: 1px solid var(--primary-lighter);
        max-height: 220px;
        overflow-y: auto;
    }

    .suggestion {
        display: flex;
        flex-direction: column;
        gap: 3px;
        background-color: var(--primary-darkest);
        border-radius: 4px;
        padding: 5px 8px;
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
        -webkit-box-orient: vertical;
    }
</style>
