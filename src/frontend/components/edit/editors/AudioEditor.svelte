<script lang="ts">
    import { createWaveform, WAVEFORM_SAMPLES } from "../../../audio/audioWaveform"
    import { activeEdit, activeShow } from "../../../stores"

    $: path = $activeEdit.id || $activeShow!.id

    $: if (path) reset()
    function reset() {
        if (!containerElem) return

        const bars = containerElem.querySelectorAll(".wave-bar")
        bars.forEach((bar) => {
            bar.style.height = "0"
        })
    }

    let containerElem: any
    $: if (containerElem) createWaveform(containerElem, path)
</script>

<div class="center">
    <div class="waveform-container" bind:this={containerElem}>
        {#each { length: WAVEFORM_SAMPLES } as _}
            <div class="wave-bar"></div>
        {/each}
    </div>
</div>

<style>
    .center {
        display: flex;
        align-items: center;
        justify-content: center;

        height: 100%;

        overflow: hidden;
    }

    .waveform-container {
        display: flex;
        align-items: center;
        justify-content: center;

        width: 100%;
        height: 250px;

        overflow: hidden;
        gap: 2px;
    }

    .waveform-container :global(.wave-bar) {
        background-color: var(--secondary);
        background: linear-gradient(0deg, rgb(240, 0, 140) 0%, rgb(169, 0, 240) 100%);

        width: 2%;
        min-height: 5px;

        transition: height 0.2s ease-in-out;
    }
</style>
