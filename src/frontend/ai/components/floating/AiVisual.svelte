<script lang="ts">
    import { onDestroy } from "svelte"
    import { audioLevelStore } from "../../stt/stt"

    export let state: "loading" | "inactive" | "error" | "listening" | "processing" = "inactive"

    let displayedAudioLevel = 0
    let animationFrameId: number

    // Adjust smoothing factor (0.05 = super smooth/slow, 0.3 = fast/snappy)
    const SMOOTHING_FACTOR = 0.15

    function updateLevel() {
        const target = $audioLevelStore
        // Exponential moving average for smooth transitions
        displayedAudioLevel += (target - displayedAudioLevel) * SMOOTHING_FACTOR

        animationFrameId = requestAnimationFrame(updateLevel)
    }

    // Start/stop frame loop depending on listening state
    $: if (state === "listening") {
        if (!animationFrameId) {
            updateLevel()
        }
    } else {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId)
            animationFrameId = 0
            displayedAudioLevel = 0
        }
    }

    onDestroy(() => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId)
    })
</script>

<button class="floating-trigger" on:click aria-label="Expand Speech Recognition Modal">
    {#if state === "loading" || state === "inactive" || state === "error"}
        <svg class="mic-icon" class:error={state === "error"} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
    {:else if state === "listening"}
        <div class="smoky-audio-visualizer" style="--audio-level: {Math.min(displayedAudioLevel * 2, 1)}">
            <div class="smoke-layer layer-4"></div>
            <div class="smoke-layer layer-3"></div>
            <div class="smoke-layer layer-2"></div>
            <div class="smoke-layer layer-1"></div>
        </div>
    {:else if state === "processing"}
        <div class="spinner"></div>
    {/if}
</button>

<style>
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
    }

    /* Dynamic atmosphere glow scaling with audio level */
    .smoky-audio-visualizer::before {
        content: "";
        position: absolute;
        inset: -22%;
        border-radius: 44% 56% 61% 39% / 46% 42% 58% 54%;
        background: radial-gradient(circle at 30% 35%, rgba(0, 242, 254, calc(0.3 + var(--audio-level) * 0.5)), transparent 40%), radial-gradient(circle at 70% 58%, rgba(138, 43, 226, calc(0.3 + var(--audio-level) * 0.5)), transparent 40%), radial-gradient(circle at 48% 72%, rgba(255, 0, 128, calc(0.2 + var(--audio-level) * 0.6)), transparent 35%);
        filter: blur(8px) saturate(calc(1.2 + var(--audio-level) * 1.5));
        opacity: calc(0.6 + var(--audio-level) * 0.4);
        transform: scale(calc(0.92 + var(--audio-level) * 0.25));
        animation: cloudDrift 8s ease-in-out infinite alternate;
    }

    /* Small glass glint */
    .smoky-audio-visualizer::after {
        content: "";
        position: absolute;
        width: 46%;
        height: 28%;
        top: 17%;
        left: 20%;
        border-radius: 50%;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0));
        filter: blur(1.5px);
        opacity: calc(0.25 + var(--audio-level) * 0.35);
        transform: rotate(-24deg);
        mix-blend-mode: screen;
    }

    .smoke-layer {
        position: absolute;
        pointer-events: none;
        border-radius: 42% 58% 55% 45% / 48% 43% 57% 52%;
        /* Vivid neon cyan -> rich purple -> hyper magenta gradient */
        background: radial-gradient(circle at 34% 28%, rgba(255, 255, 255, calc(0.4 + var(--audio-level) * 0.4)), transparent 30%), linear-gradient(135deg, rgba(0, 242, 254, calc(0.6 + var(--audio-level) * 0.4)), rgba(112, 0, 255, calc(0.5 + var(--audio-level) * 0.45)) 54%, rgba(255, 0, 110, calc(0.4 + var(--audio-level) * 0.55)));
        box-shadow:
            inset 0 0 10px rgba(255, 255, 255, calc(0.2 + var(--audio-level) * 0.4)),
            0 0 calc(10px + var(--audio-level) * 16px) rgba(0, 242, 254, calc(0.3 + var(--audio-level) * 0.5));
        mix-blend-mode: screen;
        will-change: transform, rotate, filter, opacity;
        transition:
            transform 60ms linear,
            opacity 60ms linear,
            filter 60ms linear;
    }

    .smoke-layer.layer-1 {
        width: 17px;
        height: 17px;
        z-index: 4;
        opacity: calc(0.7 + var(--audio-level) * 0.3);
        border-radius: 38% 62% 48% 52% / 56% 42% 58% 44%;
        clip-path: polygon(50% 0%, 88% 22%, 100% 62%, 72% 100%, 26% 92%, 0% 54%, 16% 18%);
        filter: blur(0.1px) drop-shadow(0 0 calc(4px + var(--audio-level) * 8px) rgba(0, 242, 254, calc(0.5 + var(--audio-level) * 0.5)));
        transform: translate(-1px, -1px) scale(calc(1 + var(--audio-level) * 1.05));
        animation: crystalTurn 7s ease-in-out infinite;
    }

    .smoke-layer.layer-2 {
        width: 29px;
        height: 25px;
        z-index: 3;
        opacity: calc(0.5 + var(--audio-level) * 0.4);
        filter: blur(1px);
        transform: translate(4px, 2px) scale(calc(0.92 + var(--audio-level) * 0.9));
        animation: cloudTurnReverse 9s ease-in-out infinite alternate;
    }

    .smoke-layer.layer-3 {
        width: 40px;
        height: 34px;
        z-index: 2;
        opacity: calc(0.4 + var(--audio-level) * 0.4);
        border-radius: 62% 38% 57% 43% / 42% 58% 40% 60%;
        filter: blur(2.5px);
        transform: translate(-4px, 4px) scale(calc(0.9 + var(--audio-level) * 0.72));
        animation: cloudTurn 11s ease-in-out infinite alternate;
    }

    .smoke-layer.layer-4 {
        width: 52px;
        height: 45px;
        z-index: 1;
        opacity: calc(0.3 + var(--audio-level) * 0.4);
        border-radius: 48% 52% 36% 64% / 62% 38% 58% 42%;
        filter: blur(4.5px);
        transform: translate(3px, -2px) scale(calc(0.88 + var(--audio-level) * 0.58));
        animation: cloudTurnReverse 14s ease-in-out infinite alternate;
    }

    /* Keyframes remain unchanged */
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

    .spinner {
        width: 22px;
        height: 22px;
        border: 2px solid rgba(255, 255, 255, 0.15);
        border-top-color: #00dfd8;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
