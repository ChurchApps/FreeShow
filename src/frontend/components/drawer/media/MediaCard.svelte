<script lang="ts">
    import type { MediaStyle } from "../../../../types/Main"
    import { activeShow, customMessageCredits, media, mediaOptions, outLocked, outputs, photoApiCredits, selected, styles } from "../../../stores"
    import { getKey } from "../../../values/keys"
    import Icon from "../../helpers/Icon.svelte"
    import { getMediaStyle } from "../../helpers/media"
    import { findMatchingOut, getActiveOutputs, setOutput } from "../../helpers/output"
    import { clearBackground } from "../../output/clear"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"
    import MediaLoader from "./MediaLoader.svelte"

    export let name: string
    export let path: string
    export let credits: any = {}
    export let type: any
    export let active: string | null
    export let shiftRange: any[] = []
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

    function mousedown(e: any) {
        if (e.ctrlKey || e.metaKey) return

        if (credits) {
            photoApiCredits.set(credits)
        }
    }

    function mouseenter() {
        const mediaGrid = document.querySelector(".grid")?.querySelector(".grid")
        if (!mediaGrid) return

        const scrollTop = mediaGrid.scrollTop
        setTimeout(() => {
            // return if scrolling or selected
            if (scrollTop !== mediaGrid.scrollTop || $selected.data.find((a) => a.path === path)) return
            hover = true
        }, 200)
    }

    let wait = false
    function click(e: any) {
        if (e.ctrlKey || e.metaKey || e.shiftKey || $outLocked || wait) return

        // don't hide again when double clicking
        wait = true
        setTimeout(() => {
            wait = false
        }, 800)

        if (findMatchingOut(path, $outputs)) {
            clearBackground()
            return
        }

        setOutput("background", { path, type, loop: true, muted: false, startAt: 0, ...mediaStyle })

        // unsplash requires the download to be triggered when using their images
        if (credits.type === "unsplash" && credits.trigger_download) {
            fetch(credits.trigger_download + "?client_id=" + getKey("unsplash"), { method: "GET" }).catch((err) => console.error("Could not trigger download:", err))
            customMessageCredits.set(`Photo by ${credits.artist} on Unsplash`)
        }
    }

    function dblclick(e: any) {
        if (e.ctrlKey || e.metaKey) return

        activeFile = index
    }

    $: currentOutput = $outputs[getActiveOutputs()[0]]
    $: currentStyle = $styles[currentOutput?.style || ""] || {}

    let mediaStyle: MediaStyle = {}
    $: if (path) mediaStyle = getMediaStyle($media[path], currentStyle)

    // fixed resolution
    let resolution = { width: 1920, height: 1080 }

    $: icon = active !== "favourites" && $media[path]?.favourite === true ? "star" : type === "video" ? "movie" : "image"
</script>

<SelectElem id="media" class="context #media_card" data={{ name, path, type }} {shiftRange} draggable fill>
    <Card
        {loaded}
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
        showPlayOnHover
        on:mousedown={mousedown}
        on:click={click}
        on:dblclick={dblclick}
        on:mouseenter={mouseenter}
        on:mouseleave={() => (hover = false)}
        on:mousemove={move}
    >
        {#if thumbnail}
            <MediaLoader bind:loaded bind:hover bind:duration bind:videoElem {resolution} {type} {path} {thumbnailPath} {name} {mediaStyle} />
        {:else}
            <div class="icon">
                <Icon size={2.5} id={icon} white={type === "image"} />
            </div>
        {/if}
    </Card>
</SelectElem>

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
