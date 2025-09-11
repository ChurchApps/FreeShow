<script lang="ts">
    import { AudioPlayer } from "../../audio/audioPlayer"
    import { activeEdit, activeShow, media } from "../../stores"
    import { clone } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { removeStore, updateStore } from "../helpers/update"
    import Button from "../inputs/Button.svelte"
    import EditValues from "./tools/EditValues.svelte"
    import { setBoxInputValue2 } from "./values/boxes"
    import { audioSections } from "./values/media"

    // update values
    $: audioId = $activeEdit.id || $activeShow!.id
    $: currentMedia = $media[audioId] || {}

    let currentAudioSections = clone(audioSections)

    $: if (audioId) getAudioDuration()
    async function getAudioDuration() {
        const duration = await AudioPlayer.getDuration(audioId)

        setBoxInputValue2(currentAudioSections, "default", "toTime", "value", currentMedia?.toTime || duration)
        setBoxInputValue2(currentAudioSections, "default", "toTime", "default", duration)
        setBoxInputValue2(currentAudioSections, "default", "fromTime", "values", { max: duration })
        setBoxInputValue2(currentAudioSections, "default", "toTime", "values", { max: duration })
        currentAudioSections = currentAudioSections

        // WIP set min/max based on each other
    }

    function reset() {
        let deleteKeys: string[] = ["audioType", "volume"]

        if (currentMedia.volume) setTimeout(() => AudioPlayer.updateVolume(audioId))

        // reset
        deleteKeys.forEach((key) => removeStore("media", { keys: [audioId, key] }))
    }

    export function valueChanged(input: any) {
        if (!audioId) return

        let value = input.value
        if (value?.id !== undefined) value = value.id
        if (input.id === "volume") {
            // value = Math.min(1, Math.max(0, value / 100))
            setTimeout(() => AudioPlayer.updateVolume(audioId))
        }

        updateStore("media", { keys: [audioId, input.id], value })
    }

    function valueChanged2(e: any) {
        const input = e.detail

        input.value = input.values.value
        input.input = input.type

        valueChanged(input)
    }
</script>

<div class="main border editTools">
    <div class="content">
        <EditValues sections={currentAudioSections} item={currentMedia} on:change={valueChanged2} />
    </div>

    <span style="display: flex;">
        <Button style="flex: 1;" on:click={reset} dark center>
            <Icon id="reset" right />
            <T id={"actions.reset"} />
        </Button>
    </span>
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
    }
</style>
