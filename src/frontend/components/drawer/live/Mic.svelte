<script lang="ts">
    import { onDestroy } from "svelte"
    import Icon from "../../helpers/Icon.svelte"
    import Button from "../../inputs/Button.svelte"
    import { MAIN } from "../../../../types/Channels"
    import { volume } from "../../../stores"

    export let mic: any

    // https://dobrian.github.io/cmp/topics/sample-recording-and-playback-with-web-audio-api/1.loading-and-playing-sound-files.html

    // https://developers.google.com/web/fundamentals/media/recording-audio
    // TODO: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet
    //   class MyAudioProcessor extends AudioWorklet {
    //   constructor() {
    //     super();
    //   }

    //   process(inputList, outputList, parameters) {
    //     /* using the inputs (or not, as needed), write the output
    //        into each of the outputs */

    //     return true;
    //   }
    // };

    // registerProcessor("processor", MyAudioProcessor);

    let soundLevel: number = 0

    let audioStream: any
    let context: any
    let source: any
    // let gainNode: any
    let audio: any

    const handleSuccess = function (stream: any) {
        audioStream = stream
        context = new AudioContext()
        source = context.createMediaStreamSource(stream)

        var analyser = context.createAnalyser()
        analyser.smoothingTimeConstant = 0.2
        analyser.fftSize = 1024

        var node = context.createScriptProcessor(2048, 1, 1)

        var values = 0
        var average
        node.onaudioprocess = function () {
            // bitcount is fftsize / 2
            var array = new Uint8Array(analyser.frequencyBinCount)
            analyser.getByteFrequencyData(array)

            var length = array.length
            for (var i = 0; i < length; i++) {
                values += array[i]
            }

            average = values / length
            soundLevel = Math.min(100, average)

            average = values = 0
        }

        source.connect(analyser)
        analyser.connect(node)
        node.connect(context.destination)

        audio = new Audio()
        audio.srcObject = stream
        audio.play()
        audio.volume = 0
        console.log(audio)

        // TODO: add this to audioChannels / audioAnalyzer
    }

    navigator.mediaDevices
        .getUserMedia({
            audio: {
                deviceId: { exact: mic.id },
            },
        })
        .then(handleSuccess)
        .catch((err) => {
            console.log(err)
            if (err.name === "NotReadableError") {
                window.api.send(MAIN, { channel: "ACCESS_MICROPHONE_PERMISSION" })
            }
        })

    onDestroy(() => {
        audioStream?.getAudioTracks().forEach((track: any) => track.stop())
    })

    let muted: boolean = true
    $: if (audio) {
        if (!muted) audio.volume = $volume ?? 1
        else audio.volume = 0
    }
</script>

{#if context}
    <div class="main context #live_card">
        <Button style="width: 100%;" bold={false} on:click={() => (muted = !muted)}>
            <span style="display: flex;gap: 5px;flex: 3;align-items: center;">
                <Icon id={muted ? "muted" : "volume"} white={muted} right />
                <p>{mic.name}</p>
            </span>

            <span class="meter">
                <!-- <p>L</p> -->
                <div style="width: {100 - soundLevel}%" />
            </span>
        </Button>
    </div>
{/if}

<style>
    .main {
        display: flex;
    }
    .main:nth-child(even) {
        background-color: var(--primary-darkest);
    }

    .meter {
        background-image: linear-gradient(to right, rgb(200, 0, 0) 1%, rgb(255, 220, 0) 16%, rgb(0, 220, 0) 45%, rgb(0, 120, 0) 100%);
        /* filter: hue-rotate(250deg); */
        height: 5px;
        flex: 1;

        transform: rotate(180deg);
    }

    .meter div {
        transition: width 0.1s ease 0s;
        background-color: var(--primary);
        height: 100%;
    }
</style>
