<script lang="ts">
    import { onDestroy } from "svelte"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { AudioPlaylist } from "../../../audio/audioPlaylist"
    import { activeFocus, activePlaylist, activeShow, audioPlaylists, dictionary, focusMode, outLocked, playingAudio } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
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
    $: justOneAudio = Object.keys($playingAudio).length === 1
    $: if (justOneAudio && path) getDuration()
    else duration = 0
    async function getDuration() {
        duration = 0
        duration = playing.isMic ? 0 : await AudioPlayer.getDuration(Object.keys($playingAudio)[0])
        currentTime = playing.audio?.currentTime || 0
    }

    $: if (!paused && playing.audio) startUpdater()

    // updater
    let updaterInterval: NodeJS.Timeout | null = null
    function startUpdater() {
        if (updaterInterval) return

        updaterInterval = setInterval(() => {
            if (paused) {
                if (updaterInterval) clearInterval(updaterInterval)
                updaterInterval = null
            }
            if (sliderValue === null) currentTime = playing.audio?.currentTime || 0
        }, 100)
    }

    onDestroy(() => {
        if (updaterInterval) clearInterval(updaterInterval)
    })

    let sliderValue: any = null
    function setSliderValue(e: any) {
        sliderValue = e.target.value
    }

    function setTime(e: any, id: string) {
        sliderValue = null

        playingAudio.update((a) => {
            if (a[id]?.audio?.currentTime === undefined) return a
            a[id].audio.currentTime = e.target.value || 0
            // something (in audio.ts I guess) plays the audio when updating the time, so this will pause it again
            if (paused) setTimeout(() => a[id].audio.pause(), 20)

            return a
        })
    }

    function openAudio(id: string, audio: any) {
        if ($focusMode) activeFocus.set({ id, type: "audio" })
        else activeShow.set({ id, type: "audio", data: { isMic: audio.isMic } })
    }

    let fullLength: boolean = false
</script>

{#if Object.keys($playingAudio).length > 1}
    <span class="name" style="justify-content: space-between;">
        {#each Object.entries($playingAudio) as [id, audio]}
            {@const name = audio.name || getName(id)}
            <Button title={name} on:click={() => openAudio(id, audio)} active={$activeShow?.id === id} style="z-index: 2;" bold={false} center>
                {#if audio.isMic}<Icon id="microphone" size={1.2} right />{/if}
                <p>{name}</p>
            </Button>
        {/each}
    </span>
{:else}
    {@const name = playing.name || getName(path)}

    <Button title={name} on:click={() => openAudio(path, playing)} active={$activeShow?.id === path} style="padding: 5px 10px;opacity: 0.8;width: 100%;z-index: 2;" bold={false} center>
        {#if playing.isMic}<Icon id="microphone" size={1.2} right />{/if}
        <p>{$activePlaylist?.active === path ? `${$audioPlaylists[$activePlaylist.id]?.name}: ` : ""}{name}</p>
    </Button>

    <!-- AUDIO CONTROLS -->
    {#if !playing.isMic}
        <div class="controls">
            <Button
                style="flex: 0"
                disabled={$outLocked}
                center
                title={paused ? $dictionary.media?.play : $dictionary.media?.pause}
                on:click={() => {
                    if ($outLocked) return
                    AudioPlayer.start(path, { name }, { pauseIfPlaying: true, startAt: currentTime })
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
                    {joinTime(secondsToTime(Math.floor(currentTime)))}
                </span>
            {/if}

            <Slider value={currentTime} max={duration} on:input={setSliderValue} on:change={(e) => setTime(e, path)} />

            <span style={fullLength ? "" : "color: var(--secondary)"} on:click={() => (fullLength = !fullLength)}>
                {#if fullLength}
                    {joinTime(secondsToTime(duration))}
                {:else}
                    {joinTime(secondsToTime(duration - Math.floor(currentTime)))}
                {/if}
            </span>

            {#if $activePlaylist?.active === path}
                <Button style="flex: 0" disabled={$outLocked} center title={$dictionary.media?.next} on:click={AudioPlaylist.next}>
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
        margin-inline-end: 0.2em;
    }
    .controls :global(button) {
        padding: 0.3em !important;
    }
    .controls span {
        padding: 0 0.3em;
    }
</style>
