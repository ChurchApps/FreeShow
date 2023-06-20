<script lang="ts">
    import { activeShow, dictionary, playingAudio } from "../../stores"
    import { clearAudio, getAudioDuration, playAudio } from "../helpers/audio"
    import Icon from "../helpers/Icon.svelte"
    import { joinTime, secondsToTime } from "../helpers/time"
    import Button from "../inputs/Button.svelte"
    import Slider from "../inputs/Slider.svelte"

    $: path = $activeShow?.id || ""
    $: name = $activeShow?.name || ""
    $: playing = $playingAudio[path] || {}
    $: paused = playing.paused !== false

    let currentTime: number = 0
    let duration: any = 0
    $: if (path) getDuration()
    async function getDuration() {
        duration = await getAudioDuration(path)
        currentTime = playing.audio?.currentTime || 0
    }

    $: if (!paused && path) startUpdater()

    // updater
    let interval: any = null
    function startUpdater() {
        if (interval) return

        interval = setInterval(() => {
            if (paused) {
                clearInterval(interval)
                interval = null
            }
            if (sliderValue === null) currentTime = playing.audio?.currentTime || 0
        }, 100)
    }

    function setTime(e: any) {
        sliderValue = null
        if (playing.audio) playing.audio.currentTime = e.target.value
        else currentTime = e.target.value
    }

    let sliderValue: any = null
    function setSliderValue(e: any) {
        sliderValue = e.target.value
    }

    function keydown(e: any) {
        if (e.key === " ") playAudio({ path, name }, true, currentTime)
    }

    // visualizer
    let analyser: any = null
    $: if (path) analyser = $playingAudio[path]?.analyser || null
    $: console.log(analyser)
    let canvas: any = null
    $: if (analyser && canvas) visualizer()

    function visualizer() {
        let leftChannel = analyser.left
        let rightChannel = analyser.right

        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
        let ctx = canvas.getContext("2d")

        let bufferLengthLeft = leftChannel.frequencyBinCount
        let bufferLengthRight = rightChannel.frequencyBinCount

        let dataArrayLeft = new Uint8Array(bufferLengthLeft)
        let dataArrayRight = new Uint8Array(bufferLengthRight)

        let WIDTH = canvas.width
        let HEIGHT = canvas.height

        let padding = -0.5
        let barWidth = (WIDTH / bufferLengthLeft - padding) * 1.3
        let barHeight
        let x = 0

        function renderFrame() {
            if (analyser) {
                requestAnimationFrame(renderFrame)
            } else {
                ctx.clearRect(0, 0, WIDTH, HEIGHT)
                return
            }

            x = 0

            leftChannel.getByteFrequencyData(dataArrayLeft)
            rightChannel.getByteFrequencyData(dataArrayRight)

            ctx.clearRect(0, 0, WIDTH, HEIGHT)
            // ctx.fillStyle = "transparent"
            // ctx.fillRect(0, 0, WIDTH, HEIGHT)

            for (let i = 0; i < bufferLengthLeft; i++) {
                let mid = Math.round((dataArrayLeft[i] + dataArrayRight[i]) / 2)
                barHeight = mid * 0.5

                let r = barHeight * 1.5 + 5 // * (i / bufferLengthLeft)
                let g = 5 // 250 * (i / bufferLengthLeft)
                let b = 150

                ctx.fillStyle = "rgb(" + r + "," + g + "," + b + ")"
                ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight)

                x += barWidth + padding
            }
        }

        renderFrame()
    }
</script>

<svelte:window on:keydown={keydown} />

<canvas bind:this={canvas} />

<div class="buttons">
    <Button style="flex: 0" center title={paused ? $dictionary.media?.play : $dictionary.media?.pause} on:click={() => playAudio({ path, name }, true, currentTime)}>
        <Icon id={paused ? "play" : "pause"} white={paused} size={1.2} />
    </Button>
    {#if sliderValue !== null}
        <span>
            {joinTime(secondsToTime(sliderValue))}
        </span>
    {:else}
        <span style="color: var(--secondary)">
            {joinTime(secondsToTime(currentTime))}
        </span>
    {/if}
    <Slider value={currentTime} max={duration} on:input={setSliderValue} on:change={setTime} />
    <span>
        {joinTime(secondsToTime(duration))}
    </span>
    <Button
        disabled={!playing.audio}
        style="flex: 0"
        center
        title={$dictionary.media?.stop}
        on:click={() => {
            clearAudio(path)
            currentTime = 0
        }}
    >
        <Icon id={"stop"} white size={1.2} />
    </Button>

    <!-- TODO: individual volume -->
</div>

<style>
    .buttons {
        display: flex;
        gap: 10px;
        align-items: center;

        background-color: var(--primary-darker);
        z-index: 1;

        /* position: absolute;
    bottom: 0;
    width: 100%; */
    }

    div :global(input) {
        background: var(--primary);
    }

    canvas {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
    }
</style>
