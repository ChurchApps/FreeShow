<script lang="ts">
    import { onDestroy } from "svelte"
    import { fade } from "svelte/transition"
    import MaterialButton from "../../components/inputs/MaterialButton.svelte"
    import { ai, aiScriptureTranscript } from "../../stores"
    import { audioLevelStore, SpeechToText } from "../stt/stt"

    let state: "inactive" | "error" | "listening" | "processing" = "inactive"

    let isOpen = false
    function toggleExpand() {
        isOpen = !isOpen
    }

    // STATE

    $: isEnabled = $ai.enabled
    $: micDeviceId = $ai.stt?.micDeviceId

    // auto enable mic input
    $: if (isEnabled && micDeviceId) enable()
    else {
        state = "inactive"
        SpeechToText.disable()
    }
    async function enable() {
        if (await SpeechToText.enable()) state = "listening"
        else state = "error"
    }

    $: audioLevel = $audioLevelStore

    onDestroy(() => {
        SpeechToText.disable()
    })
</script>

<!-- NOTE: This is supposed to popup with suggestions for scripture, or songs, or the UI -->
<!-- Either show buttons where the user can confirm, or do it automatically! -->

{#if isOpen}
    <div class="backdrop" on:click|self={toggleExpand} transition:fade={{ duration: 250 }}></div>
{/if}

<div class="speech-widget {isOpen ? 'is-open' : 'is-closed'}" style="--audio-level: {audioLevel}">
    <div class="card-border-wrapper state-{state}">
        <div class="inner-content">
            {#if !isOpen}
                <button class="floating-trigger" on:click={toggleExpand} aria-label="Expand Speech Recognition Modal">
                    {#if state === "inactive" || state === "error"}
                        <svg class="mic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="22" />
                        </svg>
                    {:else if state === "listening"}
                        <div class="fluid-audio-visualizer">
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
                            <p class="placeholder">Select a microphone input...</p>
                        {:else if state === "processing"}
                            <div class="processing-view">
                                <div class="spinner large"></div>
                                <p>Processing speech...</p>
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
        </div>
    </div>
</div>

<style>
    :root {
        --ai-gradient: linear-gradient(135deg, #ff007f, #7928ca, #4ed6ff, #00dfd8);
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

    .card-border-wrapper {
        width: 100%;
        height: 100%;
        position: relative;
        border-radius: inherit;
        padding: 3px; /* Exactly 3px border width */
        background: var(--ai-gradient);
        background-size: 200% 200%;
        box-shadow: 0 12px 35px rgba(0, 0, 0, 0.6);
        transition:
            border-radius 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            box-shadow 0.3s ease;
        animation: rotateGradient 10s ease infinite;
    }

    .speech-widget.is-closed .card-border-wrapper {
        border-radius: 50%;
    }
    .speech-widget.is-open .card-border-wrapper {
        border-radius: 20px;
    }

    .card-border-wrapper.state-inactive {
        opacity: 0.75;
    }

    .card-border-wrapper.state-listening_silent,
    .card-border-wrapper.state-listening_active {
        box-shadow: 0 0 calc(8px + var(--audio-level) * 16px) rgba(255, 0, 127, calc(0.3 + var(--audio-level) * 0.4));
    }

    .inner-content {
        width: 100%;
        height: 100%;
        background: var(--card-bg);
        border-radius: inherit;
        overflow: hidden;
        position: relative;
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
    .state-error .mic-icon {
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

    .close-btn {
        background: none;
        border: none;
        color: #94a3b8;
        font-size: 1.4rem;
        cursor: pointer;
    }

    .card-body {
        flex: 1;
        padding: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--card-bg);
    }

    .transcript-box {
        width: 100%;
        font-size: 0.95rem;
        line-height: 1.5;
    }

    .placeholder {
        font-style: italic;
        font-size: 0.9rem;
    }

    .processing-view {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        color: #00dfd8;
    }

    .card-footer {
        padding: 16px;
        border-top: 1px solid #1e293b;
        background: var(--bg-dark);
    }

    .audio-meter {
        height: 4px;
        width: 100%;
        background: #1e293b;
        border-radius: 2px;
        margin-bottom: 14px;
        overflow: hidden;
    }

    .meter-bar {
        height: 100%;
        background: var(--ai-gradient);
        transition: width 0.08s ease;
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

    @keyframes rotateGradient {
        0% {
            background-position: 50% 50%;
        }
        25% {
            background-position: 100% 50%;
        }
        25% {
            background-position: 50% 50%;
        }
        55% {
            background-position: 50% 50%;
        }
        75% {
            background-position: 0% 50%;
        }
        100% {
            background-position: 50% 50%;
        }
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
