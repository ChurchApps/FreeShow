<script lang="ts">
    import { onDestroy } from "svelte"
    import { AudioAnalyser } from "../../audio/audioAnalyser"
    import { clearAudio } from "../../audio/audioFading"
    import { AudioPlayer } from "../../audio/audioPlayer"
    import { dictionary, focusMode, media, outLocked, playingAudio } from "../../stores"
    import { triggerClickOnEnterSpace } from "../../utils/clickable"
    import Icon from "../helpers/Icon.svelte"
    import { joinTime, secondsToTime } from "../helpers/time"
    import Button from "../inputs/Button.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import Slider from "../inputs/Slider.svelte"

    export let active: any

    $: path = active?.id || ""
    $: name = active?.name || ""
    $: isMic = active?.data?.isMic
    $: playing = $playingAudio[path] || {}
    $: paused = playing.paused !== false

    let currentTime = 0
    let duration = 0
    $: if (path) getDuration()
    async function getDuration() {
        duration = 0
        // duration = playing.isMic ? 0 : await getAudioDuration(path)
        duration = playing.isMic ? 0 : await AudioPlayer.getDuration(path)
        currentTime = playing.audio?.currentTime || 0
    }

    $: if (!paused && path) startUpdater()

    // updater
    let updaterInterval: NodeJS.Timeout | null = null
    function startUpdater() {
        if (updaterInterval) return

        updaterInterval = setInterval(() => {
            if (paused) {
                if (updaterInterval) clearInterval(updaterInterval)
                updaterInterval = null
            }
            if (sliderValue === null) currentTime = AudioPlayer.getTime(path)
        }, 200)
    }

    onDestroy(() => {
        if (updaterInterval) clearInterval(updaterInterval)
        if (rendering) cancelAnimationFrame(rendering)
    })

    function setTime(e: any, newTime: number | null = null) {
        sliderValue = null

        const time = newTime ?? e?.target?.value
        if (!AudioPlayer.setTime(path, time)) {
            currentTime = time
        }
        // if (playing.audio) {
        //     playing.audio.currentTime = e.target.value

        //     // something (in audio.ts I guess) plays the audio when updating the time, so this will pause it again
        //     if (paused) setTimeout(() => playing.audio.pause(), 20)
        // } else {
        //     currentTime = e.target.value
        // }
    }

    let sliderValue: any = null
    function setSliderValue(e: any) {
        sliderValue = e.target.value
    }

    let mediaElem: HTMLElement | undefined
    let canvas: HTMLCanvasElement | undefined
    $: if ($playingAudio[path]?.paused === false && canvas) renderVisualiser()

    let isRendering = false
    let analysers: AnalyserNode[] = []
    let rendering = 0
    function renderVisualiser() {
        analysers = AudioAnalyser.getAnalysers()
        if (!canvas || !analysers.length) return
        if (isRendering) return

        const WIDTH = mediaElem?.clientWidth || window.innerWidth
        const HEIGHT = 80

        canvas.width = WIDTH
        canvas.height = HEIGHT
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const bufferLength = analysers[0].frequencyBinCount // 128
        const maxHeightValue = analysers[0].fftSize // 256
        if (!bufferLength || !maxHeightValue) return

        const dataArrays: Uint8Array[] = analysers.map(() => new Uint8Array(bufferLength))

        // const padding = -0.5
        // const barWidth = bufferLength ? (WIDTH / bufferLength - padding) * 1.3 : 0

        const padding = -0.5
        const barWidth = (WIDTH / bufferLength - padding) * 1.42 // 1.3

        isRendering = true
        function renderFrame() {
            // || ($playingAudio[path]?.paused !== false && allBars === 0)
            if (!$playingAudio[path]) {
                ctx!.clearRect(0, 0, WIDTH, HEIGHT)
                isRendering = false
                return
            }

            rendering = requestAnimationFrame(renderFrame)

            // update frequency data for all analysers
            analysers.forEach((analyser, i) => analyser.getByteFrequencyData(dataArrays[i]))

            ctx!.clearRect(0, 0, WIDTH, HEIGHT)

            let x = 0

            for (let i = 0; i < bufferLength; i++) {
                // if (i % 10 === 0 || i === bufferLength - 1) {
                //     ctx.fillStyle = `rgb(255, 0, 0)`
                //     ctx.fillRect(x, 0, barWidth, HEIGHT)
                //     x += barWidth + padding
                //     continue
                // }

                // const sum = dataArrays.reduce((total, array) => total + array[i], 0)
                const sum = dataArrays[0][i] + dataArrays[1][i]
                const percentage = Math.round(sum / dataArrays.length) / maxHeightValue
                const barHeight = HEIGHT * percentage

                const r = 255 * percentage
                const g = 5
                const b = 150

                ctx!.fillStyle = `rgb(${r}, ${g}, ${b})`
                ctx!.fillRect(x, HEIGHT - barHeight, barWidth, barHeight)

                x += barWidth + padding
            }
        }

        renderFrame()
    }

    let fullLength = false
</script>

{#if !$focusMode}
    <!-- analyzer -->
    <canvas bind:this={canvas} />
{/if}

<div class="main media context #media_preview" bind:this={mediaElem}>
    <div class="buttons">
        <MaterialButton
            disabled={$outLocked || isMic}
            title={paused ? "media.play" : "media.pause"}
            on:click={() => {
                if ($outLocked) return
                AudioPlayer.start(path, { name }, { pauseIfPlaying: true, startAt: currentTime })
            }}
        >
            <Icon id={paused ? "play" : "pause"} white={paused} size={1.2} />
        </MaterialButton>
        <MaterialButton
            disabled={!playing.audio}
            title="media.stop"
            on:click={() => {
                clearAudio(path)
                currentTime = 0
            }}
        >
            <Icon id={"stop"} white size={1.2} />
        </MaterialButton>

        <div style="display: flex;align-items: center;gap: 10px;flex: 1;margin: 0 10px;">
            {#if sliderValue !== null}
                <span>
                    {joinTime(secondsToTime(sliderValue))}
                </span>
            {:else}
                <span style="color: var(--secondary)">
                    {joinTime(secondsToTime(currentTime))}
                </span>
            {/if}

            <Slider disabled={isMic} value={currentTime} max={duration} on:input={setSliderValue} on:change={setTime} />

            <span style={isMic ? "opacity: 0.5;" : fullLength || !currentTime ? "" : "color: var(--secondary)"} role="button" tabindex="0" on:click={() => (fullLength = !fullLength)} on:keydown={triggerClickOnEnterSpace}>
                {#if !isMic && fullLength}
                    {joinTime(secondsToTime(duration))}
                {:else}
                    {joinTime(secondsToTime(duration - Math.floor(currentTime)))}
                {/if}
            </span>
        </div>

        <MaterialButton
            title="media.back10"
            on:click={() => {
                setTime(null, Math.max(currentTime - 10, 0.01))
            }}
        >
            <Icon id="back_10" white size={1.3} />
        </MaterialButton>
        <MaterialButton
            title="media.forward10"
            on:click={() => {
                setTime(null, Math.min(currentTime + 10, duration - 0.1))
            }}
        >
            <Icon id="forward_10" white size={1.3} />
        </MaterialButton>

        {#if !isMic}
            <MaterialButton
                title="media._loop"
                on:click={() => {
                    let loop = !$media[path]?.loop
                    media.update((a) => {
                        if (!a[path]) a[path] = {}
                        a[path].loop = loop

                        return a
                    })
                }}
            >
                <Icon id="loop" white={!$media[path]?.loop} size={1.2} />
            </MaterialButton>
        {/if}

        {#if $media[path]?.volume !== undefined && $media[path]?.volume < 1}
            <p style="align-self: center;text-align: center;min-width: 50px;padding: 0 5px;opacity: 0.7;font-size: 0.9em;">{Math.floor(($media[path]?.volume || 1) * 100)}%</p>
        {/if}
    </div>
</div>

<style>
    .main {
        width: 100%;
        height: 100%;

        display: flex;
        align-items: center;
    }

    .buttons {
        --size: 40px;

        display: flex;
        width: 100%;
        /* height: fit-content; */
        /* gap: 10px; */
        align-items: center;

        background-color: var(--primary-darker);
        z-index: 1;

        border: 1px solid var(--primary-lighter);
        border-radius: 10px;
        margin: 10px;
        min-height: var(--size);
        overflow: hidden;

        /* position: absolute;
    bottom: 0;
    width: 100%; */
    }

    .buttons :global(button) {
        background-color: transparent !important;
        height: calc(var(--size) - 2px);
        padding: 0 12px !important;
        border-radius: 0;
    }

    div :global(input) {
        background: var(--primary);
    }

    canvas {
        pointer-events: none;
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
    }

    span[role="button"] {
        cursor: pointer;
    }
    span[role="button"]:focus {
        outline: 2px solid var(--secondary);
        outline-offset: 2px;
    }
</style>
