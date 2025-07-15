<script lang="ts">
    import type { MediaStyle } from "../../../../types/Main"
    import type { ShowType } from "../../../../types/Show"
    import { activeShow, customMessageCredits, dictionary, media, mediaOptions, mediaTags, outLocked, outputs, photoApiCredits, styles } from "../../../stores"
    import { derived } from "svelte/store"
    import { getKey } from "../../../values/keys"
    import Icon from "../../helpers/Icon.svelte"
    import { getMediaStyle } from "../../helpers/media"
    import { findMatchingOut, getActiveOutputs, setOutput } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import { clearBackground, clearSlide } from "../../output/clear"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"
    import MediaLoader from "./MediaLoader.svelte"

    export let name: string
    export let path: string
    export let credits: any = {}
    export let type: ShowType
    export let active: string | null
    export let shiftRange: any[] = []
    export let thumbnailPath = ""
    export let thumbnail = true

    // Memoized name computation
    let displayName = ""
    $: {
        const newName = name.slice(0, name.lastIndexOf("."))
        if (displayName !== newName) {
            displayName = newName
        }
    }

    export let activeFile: null | number
    export let allFiles: string[]

    let loaded = true
    let videoElem: HTMLVideoElement | undefined
    let hover = false
    let duration = 0

    const steps = 10
    function move(e: any) {
        if (!loaded || !videoElem) {
            // if (hover) clearTimeout(enterTimeout)
            hover = false
            return
        }

        let percentage: number = e.offsetX / e.target.offsetWidth

        let time = Math.floor(duration * ((Math.floor(percentage * steps) * steps + steps) / 100))
        if (time && videoElem.currentTime === time) return

        if (Number(time) === time) videoElem.currentTime = time
    }

    // Memoized index calculation
    let cachedIndex = -1
    let cachedPath = ""
    $: {
        if (cachedPath !== path) {
            cachedIndex = allFiles.findIndex((a) => a === path)
            cachedPath = path
        }
    }
    $: index = cachedIndex

    function mousedown(e: any) {
        if (e.ctrlKey || e.metaKey) return

        if (credits) {
            photoApiCredits.set(credits)
        }
    }

    // let enterTimeout = null
    function mouseenter(e: any) {
        const mediaGrid = document.querySelector(".grid")?.querySelector(".grid")
        if (!mediaGrid) return

        // don't load if clicked (probably selecting)
        // WIP return if scrolling & don't load if quickly dragging the mouse across..
        if (e.buttons > 0) return
        hover = true

        // don't load all the videos if scrolling, or selecting
        // const scrollTop = mediaGrid.scrollTop
        // if (enterTimeout) clearTimeout(enterTimeout)
        // enterTimeout = setTimeout(() => {
        //     enterTimeout = null
        //     // return if scrolling or selected
        //     if (scrollTop !== mediaGrid.scrollTop || $selected.data.find((a) => a.path === path)) return
        //     hover = true
        // }, 200)
    }

    let wait = false
    function click(e: any) {
        if (e.ctrlKey || e.metaKey || e.shiftKey || $outLocked || wait || iconClicked) return

        // don't hide again when double clicking
        wait = true
        setTimeout(() => {
            wait = false
        }, 800)

        if (findMatchingOut(path, $outputs)) {
            clearBackground()
            return
        }

        let videoType = mediaStyle.videoType || ""
        let loop = videoType === "foreground" ? false : true
        let muted = videoType === "background" ? true : false
        if (videoType === "foreground") clearSlide()

        // get style per output
        getActiveOutputs().forEach((outputId) => {
            const currentOutputStyle = $styles[$outputs[outputId]?.style || ""]
            const currentMediaStyle = getMediaStyle($media[path], currentOutputStyle)
            setOutput("background", { path, type, loop, muted, startAt: 0, ...currentMediaStyle, ignoreLayer: videoType === "foreground" }, false, outputId)
        })

        // unsplash requires the download to be triggered when using their images
        if (credits && credits.type === "unsplash" && credits.trigger_download) {
            fetch(credits.trigger_download + "?client_id=" + getKey("unsplash"), { method: "GET" }).catch((err) => console.error("Could not trigger download:", err))
            customMessageCredits.set(`Photo by ${credits.artist} on Unsplash`)
        } else {
            customMessageCredits.set("")
        }
    }

    function dblclick(e: any) {
        if (e.ctrlKey || e.metaKey || iconClicked) return

        activeFile = index
    }

    // Memoized output and style computation
    const currentOutput = derived(outputs, ($outputs) => $outputs[getActiveOutputs()[0]])
    const currentStyle = derived([currentOutput, styles], ([$currentOutput, $styles]) => $styles[$currentOutput?.style || ""] || {})

    // Memoized media style computation
    let mediaStyle: MediaStyle = {}
    let cachedMediaPath = ""
    let cachedMediaStyle: MediaStyle = {}
    $: {
        if (path && (cachedMediaPath !== path || JSON.stringify($media[path]) !== JSON.stringify(cachedMediaStyle))) {
            mediaStyle = getMediaStyle($media[path], $currentStyle)
            cachedMediaPath = path
            cachedMediaStyle = $media[path] || {}
        }
    }

    // fixed resolution
    let resolution = { width: 16, height: 9 }
    // $: resolution = getResolution(null, { $outputs, $styles })

    // Memoized computed properties
    let isFavourite = false
    let icon = "image"
    let tags: string[] = []

    $: {
        const mediaData = $media[path]
        isFavourite = mediaData?.favourite === true
        icon = type === "video" ? "movie" : "image"
        tags = mediaData?.tags || []
    }

    let iconClicked: NodeJS.Timeout | null = null
    function removeStyle(key: string) {
        iconClicked = setTimeout(() => (iconClicked = null), 50)

        media.update((a) => {
            if (!a[path]) return a

            if (key === "filters") {
                delete a[path].fit
                delete a[path].flipped
                delete a[path].flippedY
                delete a[path].filter
                delete a[path].cropping
            } else if (key === "tags") {
                a[path].tags = []
            } else {
                delete a[path][key]
            }

            return a
        })
    }
</script>

<SelectElem id="media" class="context #media_card" data={{ name, path, type }} {shiftRange} draggable fill>
    <Card
        resolution={{ width: 16, height: 9 }}
        {loaded}
        style={thumbnail ? `width: ${$mediaOptions.mode === "grid" ? 100 : 100 / $mediaOptions.columns}%;` : ""}
        mode={$mediaOptions.mode}
        width={100}
        preview={$activeShow?.id === path}
        outlineColor={findMatchingOut(path, $outputs)}
        active={findMatchingOut(path, $outputs) !== null}
        label={displayName}
        title={path}
        icon={thumbnail ? icon : null}
        white={type === "image"}
        showPlayOnHover
        checkered={mediaStyle.fit !== "blur"}
        on:mousedown={mousedown}
        on:click={click}
        on:dblclick={dblclick}
        on:mouseenter={mouseenter}
        on:mouseleave={() => (hover = false)}
        on:mousemove={move}
    >
        <!-- icons -->
        <div class="icons">
            {#if isFavourite && active !== "favourites"}
                <div style="max-width: 100%;">
                    <div class="button">
                        <Button style="padding: 3px;" redHover title={$dictionary.actions?.remove} on:click={() => removeStyle("favourite")}>
                            <Icon id="star" size={0.9} white />
                        </Button>
                    </div>
                </div>
            {/if}
            {#if mediaStyle.videoType}
                <div style="max-width: 100%;">
                    <div class="button">
                        <Button style="padding: 3px;" redHover title={$dictionary.actions?.remove} on:click={() => removeStyle("videoType")}>
                            <Icon id={mediaStyle.videoType === "background" ? "muted" : mediaStyle.videoType === "foreground" ? "volume" : ""} size={0.9} white />
                        </Button>
                    </div>
                </div>
            {/if}
            {#if !!mediaStyle.filter?.length || $media[path]?.fit || mediaStyle.flipped || mediaStyle.flippedY || Object.keys(mediaStyle.cropping || {}).length}
                <div style="max-width: 100%;">
                    <div class="button">
                        <Button style="padding: 3px;" redHover title={$dictionary.actions?.remove} on:click={() => removeStyle("filters")}>
                            <Icon id="filter" size={0.9} white />
                        </Button>
                    </div>
                </div>
            {/if}
            {#if tags.length}
                <div style="max-width: 100%;">
                    <div class="button">
                        <Button style="padding: 3px;" redHover title={$dictionary.actions?.remove} on:click={() => removeStyle("tags")}>
                            <Icon id="tag" size={0.9} white />
                        </Button>
                    </div>
                    <span style="max-width: 100%;">
                        <p>{tags.length === 1 ? $mediaTags[tags[0]]?.name || "—" : tags.length}</p>
                    </span>
                </div>
            {/if}
        </div>

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

    /* icons */

    .icons {
        pointer-events: none;
        display: flex;
        flex-direction: column;
        position: absolute;
        inset-inline-start: 0;
        z-index: 1;
        font-size: 0.9em;

        height: 80%;
        flex-wrap: wrap;

        max-width: calc(100% - 21px);
    }
    .icons div {
        opacity: 0.9;
        display: flex;
    }
    .icons .button {
        background-color: rgb(0 0 0 / 0.6);
        pointer-events: all;
    }
    .icons span {
        pointer-events: all;
        background-color: rgb(0 0 0 / 0.6);
        padding: 3px;
        font-size: 0.75em;
        font-weight: bold;
        display: flex;
        align-items: center;
    }
</style>
