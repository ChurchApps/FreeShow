<script lang="ts">
    import type { TabsObj } from "../../../types/Tabs"
    import { activeEdit, activeShow, media, outputs } from "../../stores"
    import { clone } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import { getExtension, getMediaType } from "../helpers/media"
    import { getActiveOutputs, setOutput } from "../helpers/output"
    import { getFilters } from "../helpers/style"
    import T from "../helpers/T.svelte"
    import { removeStore, updateStore } from "../helpers/update"
    import Button from "../inputs/Button.svelte"
    import Tabs from "../main/Tabs.svelte"
    import { addFilterString } from "./scripts/textStyle"
    import EditValues from "./tools/EditValues.svelte"
    import { mediaEdits, mediaFilters, videoEdit } from "./values/media"

    let tabs: TabsObj = {
        media: { name: "items.media", icon: "image" },
        filters: { name: "edit.filters", icon: "filter" },
        // options: { name: "", icon: "options" },
    }
    let active: string = Object.keys(tabs)[0]

    // update values
    $: mediaId = $activeEdit.id || $activeShow!.id
    $: currentMedia = $media[mediaId]

    let edits: any = clone(mediaEdits.media?.edit)
    let filterEdits: any = clone(mediaFilters.media?.edit)

    $: if (getMediaType(getExtension(mediaId)) === "video") addVideoOptions()
    else edits = clone(mediaEdits.media?.edit)
    function addVideoOptions() {
        if (!edits) return

        edits.video = clone(videoEdit)
    }

    // set values
    $: if (currentMedia) {
        edits.default[1].value = currentMedia.flipped || false
        edits.default[0].value = currentMedia.fit || "contain"
        if (edits.video) edits.video[0].value = currentMedia.speed || "1"

        // update filters
        let filters = getFilters(currentMedia.filter)
        let defaultFilters = mediaFilters.media?.edit?.default || []
        filterEdits.default.forEach((filter: any) => {
            let value = filters[filter.key] ?? defaultFilters.find((a) => a.key === filter.key)?.value
            let index = filterEdits.default.findIndex((a: any) => a.key === filter.key)
            filterEdits.default[index].value = value
        })
    }

    function reset() {
        let deleteKeys: string[] = ["flipped", "fit", "speed"]

        // reset
        if (active === "filters") deleteKeys = ["filter"]
        else if (active !== "media") return
        deleteKeys.forEach((key) => removeStore("media", { keys: [mediaId, key] }))

        // update output
        let currentOutput: any = $outputs[getActiveOutputs()[0]]
        let bg = currentOutput?.out?.background
        if (!bg) return
        deleteKeys.forEach((key) => delete bg[key])
        setOutput("background", bg)
    }

    export function valueChanged(input: any) {
        if (!mediaId) return

        let value: any = input.value
        if (input.id === "filter") value = addFilterString(currentMedia?.filter || "", [input.key, value])

        updateStore("media", { keys: [mediaId, input.id], value })

        // update output filters
        let currentOutput: any = $outputs[getActiveOutputs()[0]]
        if (!currentOutput.out?.background || currentOutput.out?.background?.path !== mediaId) return
        let bg = currentOutput.out.background
        bg[input.id] = value
        setOutput("background", bg)
    }
</script>

<div class="main border editTools">
    <Tabs {tabs} bind:active />
    <div class="content">
        {#if active === "media"}
            <EditValues {edits} on:change={(e) => valueChanged(e.detail)} />
        {:else if active === "filters"}
            <EditValues edits={filterEdits} on:change={(e) => valueChanged(e.detail)} />
        {/if}
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
