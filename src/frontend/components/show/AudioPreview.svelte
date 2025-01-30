<script lang="ts">
    import { onDestroy } from "svelte"
    import { dictionary, focusMode, media, outLocked, playingAudio } from "../../stores"
    import { clearAudio, getAudioDuration, playAudio, updateVolume } from "../helpers/audio"
    import Icon from "../helpers/Icon.svelte"
    import { joinTime, secondsToTime } from "../helpers/time"
    import Button from "../inputs/Button.svelte"
    import Slider from "../inputs/Slider.svelte"

    export let active: any

    $: path = active?.id || ""
    $: name = active?.name || ""
    $: isMic = active?.data?.isMic
    $: playing = $playingAudio[path] || {}
    $: paused = playing.paused !== false

    let currentTime: number = 0
    let duration: any = 0
    $: if (path) getDuration()
    async function getDuration() {
        duration = 0
        duration = playing.mic ? 0 : await getAudioDuration(path)
        currentTime = playing.audio?.currentTime || 0
    }

    $: if (!paused && path) startUpdater()

    // updater
    let updaterInterval: any = null
    function startUpdater() {
        if (updaterInterval) return

        updaterInterval = setInterval(() => {
            if (paused) {
                clearInterval(updaterInterval)
                updaterInterval = null
            }
            if (sliderValue === null) currentTime = playing.audio?.currentTime || 0
        }, 100)
    }

    onDestroy(() => {
        if (updaterInterval) clearInterval(updaterInterval)
    })

    function setTime(e: any) {
        sliderValue = null
        if (playing.audio) {
            playing.audio.currentTime = e.target.value

            // something (in audio.ts I guess) plays the audio when updating the time, so this will pause it again
            if (paused) setTimeout(() => playing.audio.pause(), 20)
        } else {
            currentTime = e.target.value
        }
    }

    let sliderValue: any = null
    function setSliderValue(e: any) {
        sliderValue = e.target.value
    }

    function keydown(e: any) {
        // if (e.target.closest("input") || e.target.closest(".edit")) return
        if ($outLocked || isMic || $focusMode || document.activeElement !== document.body) return

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
                // if (barHeight > 125) b = 120
                // green - yellow - red
                // let r = barHeight * 5 + 5
                // let g = barHeight > 120 ? 10 : 10 * barHeight
                // let b = 20

                ctx.fillStyle = "rgb(" + r + "," + g + "," + b + ")"
                ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight)

                x += barWidth + padding
            }
        }

        renderFrame()
    }

    let fullLength: boolean = false
</script>

<svelte:window on:keydown={keydown} />

{#if !$focusMode}
    <!-- analyzer -->
    <canvas bind:this={canvas} />
{/if}

<div class="main media context #media_preview">
    <div class="buttons">
        <Button
            style="flex: 0"
            disabled={$outLocked || isMic}
            center
            title={paused ? $dictionary.media?.play : $dictionary.media?.pause}
            on:click={() => {
                if ($outLocked) return
                playAudio({ path, name }, true, currentTime)
            }}
        >
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

        <Slider disabled={isMic} value={currentTime} max={duration} on:input={setSliderValue} on:change={setTime} />

        <span style={isMic ? "opacity: 0.5;" : fullLength || !currentTime ? "" : "color: var(--secondary)"} on:click={() => (fullLength = !fullLength)}>
            {#if !isMic && fullLength}
                {joinTime(secondsToTime(duration))}
            {:else}
                {joinTime(secondsToTime(duration - Math.floor(currentTime)))}
            {/if}
        </span>

        <div style="display: flex;">
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
            <!-- LOOP -->
            {#if !isMic}
                <Button
                    center
                    title={$dictionary.media?._loop}
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
                </Button>
            {/if}
            <!-- VOLUME -->
            <Button
                center
                title={$dictionary.actions?.decrease_volume}
                disabled={($media[path]?.volume || 1) < 0.06}
                on:click={() => {
                    let volume = $media[path]?.volume || 1
                    media.update((a) => {
                        if (!a[path]) a[path] = {}
                        a[path].volume = Math.max(0.05, (volume * 100 - 5) / 100)

                        return a
                    })

                    updateVolume("local")
                }}
            >
                <Icon id="volume_down" white size={1.2} />
            </Button>
            <Button
                center
                title={$dictionary.actions?.increase_volume}
                disabled={($media[path]?.volume || 1) >= 1}
                on:click={() => {
                    let volume = $media[path]?.volume || 1
                    media.update((a) => {
                        if (!a[path]) a[path] = {}
                        a[path].volume = Math.min(1, (volume * 100 + 5) / 100)

                        return a
                    })

                    updateVolume("local")
                }}
            >
                <Icon id="volume" white size={1.2} />
            </Button>
            <p style="align-self: center;text-align: center;min-width: 50px;padding: 0 5px;">{Math.floor(($media[path]?.volume || 1) * 100)}%</p>
        </div>
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
        display: flex;
        width: 100%;
        /* height: fit-content; */
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
        pointer-events: none;
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
    }
</style>
