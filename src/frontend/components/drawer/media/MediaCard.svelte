<script lang="ts">
    import type { MediaStyle } from "../../../../types/Main"
    import { activeShow, media, mediaOptions, outLocked, outputs, styles } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import { getMediaStyle } from "../../helpers/media"
    import { findMatchingOut, getActiveOutputs, setOutput } from "../../helpers/output"
    import { clearBackground } from "../../output/clear"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"
    import MediaLoader from "./MediaLoader.svelte"

    export let name: string
    export let path: string
    export let type: any
    export let active: string | null
    export let thumbnailPath: string = ""
    export let thumbnail: boolean = true

    $: name = name.slice(0, name.lastIndexOf("."))

    export let activeFile: null | number
    export let allFiles: string[]

    let loaded: boolean = true
    let videoElem: any
    let hover: boolean = false
    let duration: number = 0

    const steps: number = 10
    function move(e: any) {
        if (!loaded || !videoElem) return

        let percentage: number = e.offsetX / e.target.offsetWidth

        let time = Math.floor(duration * ((Math.floor(percentage * steps) * steps + steps) / 100))
        if (time && videoElem.currentTime === time) return

        if (Number(time) === time) videoElem.currentTime = time
    }

    $: index = allFiles.findIndex((a) => a === path)

    let wait = false
    function click(e: any) {
        if (e.ctrlKey || e.metaKey || $outLocked || wait) return

        // don't hide again when double clicking
        wait = true
        setTimeout(() => {
            wait = false
        }, 800)

        if (findMatchingOut(path, $outputs)) {
            clearBackground()
            // window.api.send(OUTPUT, { channel: "VIDEO_DATA", data: { duration: 0, paused: false, muted: false, loop: true } })

            return
        }

        setOutput("background", { path, type, loop: true, muted: false, startAt: 0, ...mediaStyle })
        // TODO: get actual data
        // TODO: output/preview control does not always match
        // window.api.send(OUTPUT, { channel: "VIDEO_DATA", data: { duration: 0, paused: false, muted: false, loop: true } })
    }

    function dblclick(e: any) {
        if (e.ctrlKey || e.metaKey) return

        activeFile = index
    }

    // TODO: Enter play media
    function keydown(e: any) {
        if (e.key === "Enter") dblclick(e)
    }

    $: currentOutput = $outputs[getActiveOutputs()[0]]
    $: currentStyle = $styles[currentOutput?.style || ""] || {}

    let mediaStyle: MediaStyle = {}
    $: if (path) mediaStyle = getMediaStyle($media[path], currentStyle)

    // fixed resolution
    let resolution = { width: 1920, height: 1080 }

    $: icon = active !== "favourites" && $media[path]?.favourite === true ? "star" : type === "video" ? "movie" : "image"
</script>

<Card
    {loaded}
    class="context #media_card"
    style={thumbnail ? `width: ${$mediaOptions.mode === "grid" ? 100 : 100 / $mediaOptions.columns}%;` : ""}
    mode={$mediaOptions.mode}
    width={100}
    changed={!!mediaStyle.filter?.length || mediaStyle.flipped || mediaStyle.flippedY}
    preview={$activeShow?.id === path}
    outlineColor={findMatchingOut(path, $outputs)}
    active={findMatchingOut(path, $outputs) !== null}
    label={name}
    title={path}
    icon={thumbnail ? icon : null}
    white={type === "image"}
    on:click={click}
    on:dblclick={dblclick}
    on:keydown={keydown}
    on:mouseenter={() => (hover = true)}
    on:mouseleave={() => (hover = false)}
    on:mousemove={move}
>
    <SelectElem id="media" data={{ name, path, type }} draggable fill>
        {#if thumbnail}
            <MediaLoader bind:loaded bind:hover bind:duration bind:videoElem {resolution} {type} {path} {thumbnailPath} {name} {mediaStyle} />
        {:else}
            <div class="icon">
                <Icon size={2.5} id={icon} white={type === "image"} />
            </div>
        {/if}
    </SelectElem>
</Card>

<style>
    .icon {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        /* overflow: hidden; */
        height: 100%;
    }
    .icon :global(svg) {
        height: 100%;
    }
</style>
