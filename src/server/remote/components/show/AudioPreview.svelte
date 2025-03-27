<script lang="ts">
    import { onDestroy } from "svelte"
    import Button from "../../../common/components/Button.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { dictionary, playingAudioData, playingAudioTime } from "../../util/stores"
    import { send } from "../../util/socket"
    import { joinTime, secondsToTime } from "../../../common/util/time"

    export let active: any

    $: path = active?.id || ""
    // $: name = active?.name || ""

    $: isPlaying = $playingAudioData?.id === path
    $: audioData = isPlaying ? $playingAudioData : {}

    $: duration = audioData.duration || 0
    $: isMic = audioData.isMic ?? false
    $: paused = audioData.paused ?? true

    $: currentTime = isPlaying ? $playingAudioTime : 0

    $: if (path) startUpdater()

    // updater
    let updaterInterval: any = null
    function startUpdater() {
        if (updaterInterval) return

        updaterInterval = setInterval(() => {
            // if (paused) {
            //     clearInterval(updaterInterval)
            //     updaterInterval = null
            // }
            // if (sliderValue === null) currentTime = AudioPlayer.getTime(path)

            send("API:get_playing_audio_data")
            send("API:get_playing_audio_time")
        }, 1000)
    }

    onDestroy(() => {
        if (updaterInterval) clearInterval(updaterInterval)
    })

    // function setTime(e: any) {
    //     sliderValue = null

    //     const time = e.target.value
    //     if (!AudioPlayer.setTime(path, time)) {
    //         currentTime = time
    //     }
    //     // if (playing.audio) {
    //     //     playing.audio.currentTime = e.target.value

    //     //     // something (in audio.ts I guess) plays the audio when updating the time, so this will pause it again
    //     //     if (paused) setTimeout(() => playing.audio.pause(), 20)
    //     // } else {
    //     //     currentTime = e.target.value
    //     // }
    // }

    // let sliderValue: any = null
    // function setSliderValue(e: any) {
    //     sliderValue = e.target.value
    // }
</script>

{#if audioData?.id === undefined}
    <div class="center">
        <Button
            style="width: 100%;height: 100%;"
            disabled={isMic}
            center
            title={$dictionary.media?.play}
            on:click={() => {
                send("API:play_audio", { path })
                // audioData.id = path
            }}
        >
            <Icon id={"play"} white size={8} />
        </Button>
    </div>
{:else}
    <div class="main media">
        <div class="buttons">
            <Button
                style="flex: 0"
                disabled={isMic}
                center
                title={paused ? $dictionary.media?.play : $dictionary.media?.pause}
                on:click={() => {
                    if (paused) send("API:play_audio", { path })
                    else send("API:pause_audio", { path })
                    send("API:get_playing_audio_data")
                }}
            >
                <Icon id={paused ? "play" : "pause"} white={paused} size={1.2} />
            </Button>

            <span style="color: var(--secondary)">
                {joinTime(secondsToTime(currentTime))}
            </span>

            <div style="width: 100%;"></div>
            <!-- <Slider disabled={isMic} value={currentTime} max={duration} on:input={setSliderValue} on:change={setTime} /> -->

            <span style={isMic ? "opacity: 0.5;" : !currentTime ? "" : "color: var(--secondary)"}>
                {joinTime(secondsToTime(duration - Math.floor(currentTime)))}
            </span>

            <div style="display: flex;">
                <Button
                    disabled={audioData?.id !== path}
                    style="flex: 0"
                    center
                    title={$dictionary.media?.stop}
                    on:click={() => {
                        send("API:stop_audio", { path })
                        currentTime = 0
                        audioData = {}
                    }}
                >
                    <Icon id={"stop"} white size={1.2} />
                </Button>
            </div>
        </div>
    </div>
{/if}

<style>
    .center {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
    }

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
</style>
