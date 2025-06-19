<script lang="ts">
    import { AudioPlayer } from "../../audio/audioPlayer"
    import { activeEdit, activeShow, media } from "../../stores"
    import { clone } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { removeStore, updateStore } from "../helpers/update"
    import Button from "../inputs/Button.svelte"
    import EditValues from "./tools/EditValues.svelte"
    import { audioEdits } from "./values/media"

    // update values
    $: audioId = $activeEdit.id || $activeShow!.id
    $: currentMedia = $media[audioId] || {}

    let edits = clone(audioEdits.media?.edit)!

    // set values
    $: if (currentMedia && edits) {
        edits.default[0].value = currentMedia?.audioType || ""
        edits.default[1].value = (currentMedia?.volume || 1) * 100
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
            value = Math.min(1, Math.max(0, value / 100))
            setTimeout(() => AudioPlayer.updateVolume(audioId))
        }

        updateStore("media", { keys: [audioId, input.id], value })
    }
</script>

<div class="main border editTools">
    <div class="content">
        <EditValues {edits} on:change={(e) => valueChanged(e.detail)} />
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
