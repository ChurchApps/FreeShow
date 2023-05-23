<script lang="ts">
    import type { TabsObj } from "../../../types/Tabs"
    import { activeEdit, activeShow, media, outputs } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import { getActiveOutputs, setOutput } from "../helpers/output"
    import { getFilters } from "../helpers/style"
    import T from "../helpers/T.svelte"
    import { removeStore, updateStore } from "../helpers/update"
    import Button from "../inputs/Button.svelte"
    import Tabs from "../main/Tabs.svelte"
    import { addFilterString } from "./scripts/textStyle"
    import EditValues from "./tools/EditValues.svelte"
    import { mediaEdits } from "./values/media"

    let tabs: TabsObj = {
        media: { name: "items.media", icon: "image" },
        // filters: { name: "", icon: "filter" },
        // options: { name: "", icon: "options" },
    }
    let active: string = Object.keys(tabs)[0]

    // update values
    $: mediaId = $activeEdit.id || $activeShow!.id
    $: currentMedia = $media[mediaId]
    let edits: any = mediaEdits.media?.edit
    $: if (currentMedia) {
        edits.default[1].value = currentMedia.flipped || false
        edits.default[0].value = currentMedia.fit || "contain"

        // update filters
        let filters = getFilters(currentMedia.filter)
        Object.entries(filters).forEach(([key, value]: any) => {
            let index = edits.filters.findIndex((a: any) => a.key === key)
            edits.filters[index].value = value
        })
    }

    function reset() {
        const deleteKeys: string[] = ["filter", "flipped", "fit"]

        // reset
        if (active !== "media") return
        deleteKeys.forEach((key) => removeStore("media", { keys: [mediaId, key] }))

        // update output
        let currentOutput: any = $outputs[getActiveOutputs()[0]]
        let bg = currentOutput.out.background
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
