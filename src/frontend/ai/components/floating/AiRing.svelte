<script lang="ts">
    // animated AI gradient ring - wraps any content to visually mark it as an AI feature area
    export let state: "inactive" | "error" | "listening" | "processing" = "listening"
    export let audioLevel = 0.0
    export let borderRadius = "20px"
    export let borderWidth = "3px"
    export let opacity = 1
    export let fill = false // stretch to the parent's size (the floating bubble) instead of the content's natural height
</script>

<div class="card-border-wrapper state-{state}" class:fill style="{$$props.style};--audio-level: {audioLevel};--ring-radius: {borderRadius};--ring-width: {borderWidth};--opacity: {opacity};">
    <div class="inner-content">
        <slot />
    </div>
</div>

<style>
    :root {
        --ai-gradient: linear-gradient(135deg, #ff007f, #7928ca, #4ed6ff, #00dfd8);
    }

    .card-border-wrapper {
        width: 100%;
        position: relative;
        border-radius: var(--ring-radius);
        padding: var(--ring-width);
        background: var(--ai-gradient);
        background-size: 200% 200%;
        transition:
            border-radius 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            box-shadow 0.3s ease;
        animation: rotateGradient 10s ease infinite;
    }

    .card-border-wrapper.fill {
        height: 100%;
        box-shadow: 0 12px 35px rgba(0, 0, 0, 0.6);
    }

    .card-border-wrapper.state-inactive {
        opacity: 0.75;
    }

    .card-border-wrapper.state-listening {
        /* box-shadow: 0 0 calc(8px + var(--audio-level) * 16px) rgba(255, 0, 127, calc(0.3 + var(--audio-level) * 0.4)); */
        box-shadow: 0 0 calc(20px + var(--audio-level) * 30px) rgba(255, 0, 127, calc(0.2 + var(--audio-level) * 0.4));
    }

    .inner-content {
        width: 100%;
        height: 100%;
        background: rgb(17 24 39 / var(--opacity, 1));
        border-radius: inherit;
        overflow: hidden;
        position: relative;
    }

    @keyframes rotateGradient {
        0% {
            background-position: 50% 50%;
        }
        25% {
            background-position: 100% 50%;
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
</style>
