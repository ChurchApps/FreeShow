<script lang="ts">
    import type { TabsObj } from "../../../types/Tabs"
    import { activeEdit, activeShow, media, outputs } from "../../stores"
    import { clone } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import { getExtension, getMediaType } from "../helpers/media"
    import { getActiveOutputs, setOutput } from "../helpers/output"
    import T from "../helpers/T.svelte"
    import { removeStore, updateStore } from "../helpers/update"
    import Button from "../inputs/Button.svelte"
    import Tabs from "../main/Tabs.svelte"
    import { addFilterString } from "./scripts/textStyle"
    import EditValues2 from "./tools/EditValues2.svelte"
    import { setBoxInputValue2 } from "./values/boxes"
    import { filterSections, mediaBoxes } from "./values/media"

    let tabs: TabsObj = {
        media: { name: "items.media", icon: "image" },
        filters: { name: "edit.filters", icon: "filter" }
        // options: { name: "", icon: "options" },
    }
    let active: string = Object.keys(tabs)[0]

    // update values
    $: mediaId = $activeEdit.id || $activeShow!.id
    $: currentMedia = $media[mediaId] || {}

    $: mediaType = $activeEdit.type === "camera" ? "camera" : getMediaType(getExtension(mediaId))

    $: mediaSections = clone(mediaBoxes[mediaType]?.sections || {})

    // WIP camera / video cropping ??

    $: isVideo = mediaType === "video"
    $: if (mediaId && isVideo) getVideoDuration()
    function getVideoDuration() {
        let video = document.createElement("video")
        video.setAttribute("src", mediaId)
        video.addEventListener("loadedmetadata", loaded)

        function loaded() {
            let videoDuration = video?.duration || 0
            if (!videoDuration) return

            setBoxInputValue2(mediaSections, "video", "toTime", "value", currentMedia?.toTime || videoDuration)
            setBoxInputValue2(mediaSections, "video", "toTime", "default", videoDuration)
            setBoxInputValue2(mediaSections, "video", "fromTime", "values", { max: videoDuration })
            setBoxInputValue2(mediaSections, "video", "toTime", "values", { max: videoDuration })
            mediaSections = mediaSections
        }
    }

    function reset() {
        let deleteKeys: string[] = ["flipped", "flippedY", "fit", "speed", "volume", "fromTime", "toTime", "videoType", "cropping"]

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

        let value = input.value
        if (value?.id !== undefined) value = value.id
        if (input.id === "filter") value = addFilterString(currentMedia?.filter || "", [input.key, value])

        updateStore("media", { keys: [mediaId, ...input.id.split(".")], value })

        // update output filters
        let currentOutput = $outputs[getActiveOutputs()[0]] || {}
        if (!currentOutput.out?.background || currentOutput.out?.background?.path !== mediaId) return

        let bg = currentOutput.out.background
        bg[input.id] = value
        setOutput("background", bg)
    }

    function valueChanged2(e: any) {
        const input = e.detail

        input.value = input.values.value
        input.input = input.type

        valueChanged(input)
    }
</script>

<div class="main border editTools">
    <Tabs {tabs} bind:active />

    <div class="content">
        {#if active === "media"}
            <EditValues2 sections={mediaSections} item={currentMedia} on:change={valueChanged2} />
        {:else if active === "filters"}
            <EditValues2 sections={clone(filterSections)} item={currentMedia} on:change={valueChanged2} />
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
