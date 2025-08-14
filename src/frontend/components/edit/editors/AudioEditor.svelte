<script lang="ts">
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { createWaveform, WAVEFORM_SAMPLES } from "../../../audio/audioWaveform"
    import { activeEdit, activeShow, media } from "../../../stores"

    $: path = $activeEdit.id || $activeShow!.id

    $: if (path) reset()
    function reset() {
        if (!containerElem) return

        const bars = containerElem.querySelectorAll(".wave-bar")
        bars.forEach((bar) => {
            ;(bar as HTMLElement).style.height = "0"
        })
    }

    let containerElem: HTMLElement | undefined
    $: if (containerElem) createWaveform(containerElem, path)

    let duration = 0
    $: if (path) getAudioDuration()
    async function getAudioDuration() {
        duration = await AudioPlayer.getDuration(path)
    }

    let start = 0
    let end = 0
    $: if ($media[path] && duration) {
        start = AudioPlayer.getStartTime(path)
        end = AudioPlayer.getEndTime(path, duration)
    }
    // $: console.log(start, end)

    $: startPercentage = duration && end ? start / duration : 0
    $: endPercentage = 1 - (duration && end ? end / duration : 1)
    $: console.log(startPercentage, endPercentage)
</script>

<div class="center">
    <div class="waveform-container" bind:this={containerElem}>
        {#each { length: WAVEFORM_SAMPLES } as _}
            <div class="wave-bar"></div>
        {/each}
    </div>

    <div class="trim left" style="width: {startPercentage * 100}%;" />
    <div class="trim right" style="width: {endPercentage * 100}%;" />
    <!-- <div class="trim" style="margin-left: {startPercentage * 100}%;width: calc(100% + {(endPercentage - startPercentage) * 100}%);"></div> -->
</div>

<style>
    .center {
        position: relative;

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

    .trim {
        position: absolute;
        height: 250px;

        background-color: var(--primary-darker);
        opacity: 0.7;
    }
    .trim.left {
        left: 0;
    }
    .trim.right {
        right: 0;
    }
</style>
