<script lang="ts">
    import { activePlaylist, activeShow, audioPlaylists, dictionary, outLocked, playingAudio } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import { getAudioDuration, playAudio, playlistNext } from "../../helpers/audio"
    import { getFileName, removeExtension } from "../../helpers/media"
    import { joinTime, secondsToTime } from "../../helpers/time"
    import Button from "../../inputs/Button.svelte"
    import Slider from "../../inputs/Slider.svelte"

    function getName(id: string) {
        return removeExtension(getFileName(id)) || id
    }

    // AUDIO CONTROLS

    $: path = Object.keys($playingAudio)[0] || ""
    $: playing = Object.values($playingAudio)[0] || {}
    $: currentTime = playing.audio?.currentTime || 0
    $: paused = playing.paused !== false

    let duration = 0
    $: if (Object.keys($playingAudio).length === 1) getDuration()
    async function getDuration() {
        duration = 0
        duration = await getAudioDuration(Object.keys($playingAudio)[0])
        currentTime = playing.audio?.currentTime || 0
    }

    $: if (!paused && playing.audio) startUpdater()

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

    let sliderValue: any = null
    function setSliderValue(e: any) {
        sliderValue = e.target.value
    }

    function setTime(e: any, id: string) {
        sliderValue = null

        playingAudio.update((a) => {
            if (a[id]?.audio?.currentTime === undefined) return a
            a[id].audio.currentTime = e.target.value

            return a
        })
    }
</script>

{#if Object.keys($playingAudio).length > 1}
    <span class="name" style="justify-content: space-between;">
        {#each Object.entries($playingAudio) as [id, audio]}
            {@const name = audio.name || getName(id)}
            <Button title={name} on:click={() => activeShow.set({ id, type: "audio", data: { isMic: audio.mic } })} active={$activeShow?.id === id} bold={false} center>
                {#if audio.mic}<Icon id="microphone" size={1.2} right />{/if}
                <p>{name}</p>
            </Button>
        {/each}
    </span>
{:else}
    {@const name = playing.name || getName(path)}

    <Button title={name} on:click={() => activeShow.set({ id: path, type: "audio", data: { isMic: playing.mic } })} active={$activeShow?.id === path} style="padding: 5px 10px;opacity: 0.8;width: 100%;" bold={false} center>
        {#if playing.mic}<Icon id="microphone" size={1.2} right />{/if}
        <p>{$activePlaylist?.active === path ? `${$audioPlaylists[$activePlaylist.id]?.name}: ` : ""}{name}</p>
    </Button>

    <!-- AUDIO CONTROLS -->
    {#if !playing.mic}
        <div class="controls">
            <Button
                style="flex: 0"
                disabled={$outLocked}
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

            <Slider value={currentTime} max={duration} on:input={setSliderValue} on:change={(e) => setTime(e, path)} />

            <span>
                {joinTime(secondsToTime(duration))}
            </span>

            {#if $activePlaylist?.active === path}
                <Button
                    style="flex: 0"
                    disabled={$outLocked}
                    center
                    title={$dictionary.media?.next}
                    on:click={() => {
                        if ($outLocked) return
                        playlistNext(path)
                    }}
                >
                    <Icon id="audio_forward" size={1.2} />
                </Button>
            {/if}
        </div>
    {/if}
{/if}

<style>
    .name {
        display: flex;
        flex-direction: column;
        justify-content: center;
        max-height: 50px;
        overflow-y: auto;
    }

    .controls {
        display: flex;
        /* flex-wrap: wrap; */
        align-items: center;
        gap: 5px;
        margin-right: 0.2em;
    }
    .controls :global(button) {
        padding: 0.3em !important;
    }
    .controls span {
        padding: 0 0.3em;
    }
</style>
