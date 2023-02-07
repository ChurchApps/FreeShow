<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import type { MediaFit } from "../../../../types/Main"
    import { activeEdit, activePage, activeShow, media, mediaOptions, outLocked, outputs } from "../../../stores"
    import { findMatchingOut, setOutput } from "../../helpers/output"
    import { getMediaFilter } from "../../helpers/showActions"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"
    import IntersectionObserver from "./IntersectionObserver.svelte"
    import MediaLoader from "./MediaLoader.svelte"

    export let name: string
    export let path: string
    export let type: any
    export let active: string | null

    $: name = name.slice(0, name.lastIndexOf("."))

    export let activeFile: null | number
    export let allFiles: string[]

    let loaded: boolean = true
    let videoElem: any
    let hover: boolean = false
    let duration: number = 0

    function move(e: any) {
        if (loaded && videoElem) {
            let percentage: number = e.offsetX / e.target.offsetWidth
            let steps: number = 10

            let time = duration * ((Math.floor(percentage * steps) * steps + steps) / 100)
            if (Number(time) === time) videoElem.currentTime = time
        }
    }

    $: index = allFiles.findIndex((a) => a === path)

    function click(e: any) {
        if (!e.ctrlKey && !e.metaKey) activeFile = index
    }
    $: if (activeFile !== null && allFiles[activeFile] === path) {
        if ($activePage === "edit" && $activeShow && ($activeShow.type === undefined || $activeShow.type === "show")) activeEdit.set({ id: path, type: "media", items: [] })
        else {
            activeEdit.set({ items: [] })
            activeShow.set({ id: path, name, type })
        }
        activeFile = null
    }

    function dblclick(e: any) {
        if (!e.ctrlKey && !e.metaKey && !$outLocked) {
            setOutput("background", { path, type, loop: true, muted: false, filter, flipped })
            // TODO: get actual data
            // TODO: output/preview control does not always match
            window.api.send(OUTPUT, { channel: "VIDEO_DATA", data: { duration: 0, paused: false, muted: false, loop: true } })
        }
    }

    // TODO: Enter play media
    function keydown(e: any) {
        if (e.key === "Enter") dblclick(e)
    }

    let filter = ""
    let flipped = false
    let fit: MediaFit = "contain"

    $: if (path) {
        filter = getMediaFilter(path)
        flipped = $media[path]?.flipped || false
        fit = $media[path]?.fit || "contain"
    }
</script>

<Card
    {loaded}
    class="context #media_card"
    style="width: {$mediaOptions.mode === 'grid' ? 100 : 100 / $mediaOptions.columns}%;"
    mode={$mediaOptions.mode}
    changed={!!filter.length || flipped}
    preview={$activeShow?.id === path}
    outlineColor={findMatchingOut(path, $outputs)}
    active={findMatchingOut(path, $outputs) !== null}
    label={name}
    title={path}
    icon={active !== "favourites" && $media[path]?.favourite === true ? "star" : type === "video" ? "movie" : "image"}
    white={type === "image"}
    on:click={click}
    on:dblclick={dblclick}
    on:keydown={keydown}
    on:mouseenter={() => (hover = true)}
    on:mouseleave={() => (hover = false)}
    on:mousemove={move}
>
    <SelectElem id="media" data={{ name, path, type }} draggable fill>
        <IntersectionObserver class="observer" once let:intersecting>
            {#if intersecting}
                <MediaLoader bind:loaded bind:hover bind:duration bind:videoElem {type} {path} {name} {filter} {flipped} {fit} />
                <!-- <SyncMedia bind:loaded bind:hover bind:duration bind:videoElem {type} {path} {name} {filter} {flipped} {fit} /> -->
            {/if}
        </IntersectionObserver>
    </SelectElem>
</Card>
