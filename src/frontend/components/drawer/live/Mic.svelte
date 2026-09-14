<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { AudioMicrophone } from "../../../audio/audioMicrophone"
    import { sendMain } from "../../../IPC/main"
    import { activeFocus, activeShow, focusMode, playingAudio } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import Button from "../../inputs/Button.svelte"

    export let mic: { id: string; name: string }

    let soundLevel = 0

    let audioStream: MediaStream | undefined
    let context: AudioContext | undefined
    let source: MediaStreamAudioSourceNode | undefined
    let animationFrame: number | null = null

    const handleSuccess = function (stream: MediaStream) {
        audioStream = stream
        context = new AudioContext()
        source = context.createMediaStreamSource(stream)

        const analyser = context.createAnalyser()
        analyser.smoothingTimeConstant = 0.2
        analyser.fftSize = 1024

        source.connect(analyser)

        const array = new Uint8Array(analyser.frequencyBinCount)

        const updateLevel = () => {
            if (!context || context.state === "closed") return
            analyser.getByteFrequencyData(array)

            let values = 0
            const length = array.length
            for (let i = 0; i < length; i++) {
                values += array[i]
            }

            const average = values / length
            soundLevel = Math.min(100, average)

            animationFrame = requestAnimationFrame(updateLevel)
        }

        updateLevel()
    }

    let retryTimeout: NodeJS.Timeout | null = null

    onMount(capture)
    function capture() {
        navigator.mediaDevices
            .getUserMedia({ audio: { deviceId: { exact: mic.id } } })
            .then(handleSuccess)
            .catch((err) => {
                console.error(err)
                if (err.name === "NotReadableError") {
                    sendMain(Main.ACCESS_MICROPHONE_PERMISSION)
                }

                // retry
                retryTimeout = setTimeout(capture, 5000)
            })
    }

    onDestroy(() => {
        if (animationFrame) cancelAnimationFrame(animationFrame)
        audioStream?.getAudioTracks().forEach((track) => track.stop())
        if (retryTimeout) clearTimeout(retryTimeout)
        context?.close().catch(() => {})
    })

    $: micId = "mic_sub_" + mic.id
    $: muted = !$playingAudio[micId]
</script>

<div class="main">
    <Button
        style="width: 100%;"
        bold={false}
        disabled={!context}
        on:click={() => {
            if (!context) return
            AudioMicrophone.start(mic.id, { name: mic.name }, { pauseIfPlaying: true })
        }}
        on:dblclick={(e) => {
            if (e.ctrlKey || e.metaKey) return

            if ($focusMode) activeFocus.set({ id: mic.id, type: "audio" })
            else activeShow.set({ id: mic.id, name: mic.name, type: "audio", data: { isMic: true } })
        }}
    >
        <span style="display: flex;gap: 5px;flex: 3;align-items: center;">
            <Icon id={muted ? "muted" : "volume"} white={muted} right />
            <p>{mic.name}</p>
        </span>

        {#if context}
            <div class="channel-row">
                <span class="signal-dot" class:active={soundLevel > 0}></span>
                <span class="meter">
                    <div style="width: {100 - soundLevel}%;" />
                    <span class="meter" style="position: absolute; opacity: 0.08; right: 0; height: inherit; width: 100%;" />
                </span>
            </div>
        {/if}
    </Button>
</div>

<style>
    .main {
        display: flex;
    }
    .main:nth-child(even) {
        background-color: rgb(0 0 20 / 0.08);
    }

    /* matches AudioMeter.svelte style */

    .channel-row {
        display: flex;
        align-items: center;
        gap: 2px;
        flex: 1;
    }

    .signal-dot {
        width: 3px;
        height: 3px;
        border-radius: 2px;
        background-color: rgba(255, 255, 255, 0.2);
        transition:
            background-color 0.1s ease,
            box-shadow 0.1s ease;
        flex-shrink: 0;
    }

    .signal-dot.active {
        background-color: rgb(0, 200, 200);
    }

    .meter {
        background-image: linear-gradient(90deg, rgb(0, 200, 200) 0%, rgb(0, 255, 50) 55%, rgb(255, 200, 0) 84%, rgb(200, 0, 0) 100%);
        height: 3px;
        position: relative;
        border-radius: 1px;
        flex: 1;
    }

    .meter div {
        transition: width 0.05s ease 0s;
        background-color: var(--primary-darker);
        height: 100%;
        position: absolute;
        right: 0;
    }
</style>
