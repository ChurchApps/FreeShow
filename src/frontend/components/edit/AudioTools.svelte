<script lang="ts">
    import { AudioPlayer } from "../../audio/audioPlayer"
    import { activeEdit, activeShow, media } from "../../stores"
    import { clone } from "../helpers/array"
    import { removeStore, updateStore } from "../helpers/update"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import EditValues from "./tools/EditValues.svelte"
    import { setBoxInputValue } from "./values/boxes"
    import { audioSections } from "./values/media"

    // update values
    $: audioId = $activeEdit.id || $activeShow!.id
    $: currentMedia = $media[audioId] || {}

    let currentAudioSections = clone(audioSections)

    $: if (audioId) getAudioDuration()
    async function getAudioDuration() {
        const duration = await AudioPlayer.getDuration(audioId)

        setBoxInputValue(currentAudioSections, "default", "toTime", "value", currentMedia?.toTime || duration)
        setBoxInputValue(currentAudioSections, "default", "toTime", "default", duration)
        setBoxInputValue(currentAudioSections, "default", "fromTime", "values", { max: duration })
        setBoxInputValue(currentAudioSections, "default", "toTime", "values", { max: duration })
        currentAudioSections = currentAudioSections

        // WIP set min/max based on each other
    }

    function reset() {
        let deleteKeys: string[] = ["audioType", "volume", "fromTime", "toTime"]

        if (currentMedia.volume) setTimeout(() => AudioPlayer.updateVolume(audioId))

        // reset
        deleteKeys.forEach((key) => removeStore("media", { keys: [audioId, key] }))

        currentAudioSections = clone(audioSections)
        getAudioDuration()
    }

    export function valueChanged(e: any) {
        if (!audioId) return

        const input = e.detail

        input.value = input.values.value
        input.input = input.type

        let value = input.value
        if (value?.id !== undefined) value = value.id
        if (input.id === "volume") {
            // value = Math.min(1, Math.max(0, value / 100))
            setTimeout(() => AudioPlayer.updateVolume(audioId))
        }

        updateStore("media", { keys: [audioId, input.id], value })
    }
</script>

<div class="main border editTools">
    <div class="content">
        <EditValues sections={currentAudioSections} item={currentMedia} on:change={valueChanged} />
    </div>

    <FloatingInputs>
        <MaterialButton icon="reset" title="actions.reset" on:click={reset} />
    </FloatingInputs>
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        height: 100%;
    }

    .content {
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;

        padding-bottom: 50px;
    }
</style>
