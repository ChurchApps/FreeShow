<script lang="ts">
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { audioChannelsData, gain, volume } from "../../../stores"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import Slider from "../../inputs/Slider.svelte"
    import AudioMeter from "./AudioMeter.svelte"

    export let channelId: string
    export let label: string

    $: channelData = $audioChannelsData[channelId] || {}

    function updateData(key: string, value: any) {
        audioChannelsData.update(a => {
            if (!a[channelId]) a[channelId] = {}
            a[channelId][key] = value
            return a
        })

        if (channelId === "main") AudioPlayer.updateVolume()
    }

    const allowGaining = false // $special.allowGaining || false
    function setVolume(e: any) {
        let value = e.target?.value || e

        if (channelId !== "main") {
            updateData("volume", value)
            return
        }

        // "snap" to 100%
        // && !e.altKey
        if (allowGaining && value > 0.95 && value < 1.05) value = 1

        let newGain = 1
        let newVolume = 1

        if (value > 1) newGain = (value - 1) / 0.125 + 1
        else newVolume = value

        volume.set(newVolume)
        gain.set(newGain)

        AudioPlayer.updateVolume()
    }

    // 25% / 200 = 0.125
    $: gainValue = (Number($gain || 0) - 1) * 0.125
    $: mainVolume = allowGaining ? Number($volume ?? 1) + gainValue : Number($volume ?? 1)

    $: volumeValue = channelId === "main" ? mainVolume : Number(channelData.volume ?? 1)

    $: muted = !!channelData.isMuted
</script>

<section>
    <!-- <MaterialNumberInput style="width: 100px;" label="media.volume (%)" value={volumeValue * 100} min={0} max={allowGaining ? 125 : 100} on:change={(e) => setVolume(e.detail / 100)} showSlider /> -->

    <div class="output">
        <div class="label" style="margin-right: 7px;">
            <!-- {translateText("media.volume")} -->
            <p style="opacity: 0.9;">{label || ""}</p>
            <Slider disabled={muted} value={volumeValue} step={0.01} max={allowGaining ? 1.25 : 1} on:input={setVolume} />
        </div>

        <div class="input" style="position: relative;">
            <NumberInput style="width: 60px;" disabled={muted} value={volumeValue * 100} min={0} max={allowGaining ? 125 : 100} on:change={e => setVolume(e.detail / 100)} buttons={false} />
            <span style="position: absolute;right: 0;bottom: 5px;transform: translateX(-7px);pointer-events: none;color: var(--secondary);font-weight: bold;font-size: 0.7em;">%</span>
        </div>

        <MaterialButton variant="outlined" style="padding: 8px;" icon={muted ? "muted" : "volume"} title="actions.{muted ? 'unmute' : 'mute'}" red={muted} on:click={() => updateData("isMuted", !muted)} />
    </div>

    <!-- <p style="font-size: 1em;margin: 10px;{volumeValue === 1 || volumeValue === 0 ? 'color: var(--secondary);' : ''}">{(volumeValue * 100).toFixed()}<span style="color: var(--text);">%</span></p> -->

    <AudioMeter {channelId} />
</section>

<style>
    section {
        padding: 10px;

        /* background-color: var(--primary-darker); */
        background-color: rgb(0 0 0 / 0.15);

        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
    }

    .output {
        display: flex;
        align-items: center;
        gap: 3px;
        margin-bottom: 10px;
    }

    .label {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 5px;

        font-size: 0.7em;
        flex: 1;
    }

    .input :global(input) {
        padding-right: 14px;
    }
</style>
