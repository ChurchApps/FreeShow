<script lang="ts">
    import { getDocument, GlobalWorkerOptions } from "pdfjs-dist"
    import type { ClickEvent, MediaStyle } from "../../../types/Main"
    import { AudioPlayer } from "../../audio/audioPlayer"
    import { activeEdit, activeFocus, activePage, activeProject, activeShow, categories, focusMode, media, notFound, outLocked, outputs, overlays, playerVideos, playingAudio, projects, refreshEditSlide, shows, showsCache, styles } from "../../stores"
    import { getAccess } from "../../utils/profile"
    import { historyAwait } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { getFileName, getMediaStyle, removeExtension } from "../helpers/media"
    import { findMatchingOut, getActiveOutputs, setOutput } from "../helpers/output"
    import { loadShows } from "../helpers/setShow"
    import { checkName, getLayoutRef } from "../helpers/show"
    import { swichProjectItem, updateOut } from "../helpers/showActions"
    import { joinTime, secondsToTime } from "../helpers/time"
    import { clearBackground, clearSlide } from "../output/clear"
    import HiddenInput from "./HiddenInput.svelte"
    import MaterialButton from "./MaterialButton.svelte"

    export let id: string
    export let show: any // ShowList | ShowRef
    export let data: null | string = null
    export let index: null | number = null
    export let isFirst: boolean = false
    $: type = show.type || "show"
    $: name = type === "show" ? $shows[show.id]?.name : type === "overlay" ? $overlays[show.id]?.name : type === "player" ? ($playerVideos[id] ? $playerVideos[id].name : setNotFound(id)) : show.name
    // export let page: "side" | "drawer" = "drawer"
    export let match: null | number = null
    $: showNumber = show?.quickAccess?.number || show?.meta?.number || ""

    let profile = getAccess("shows")
    let readOnly = profile.global === "read" || profile[show.category] === "read"

    // search
    $: style = match !== null ? `background: linear-gradient(to right, var(--primary-lighter) ${match}%, transparent ${match}%);` : ""

    function setNotFound(id: string) {
        notFound.update((a) => {
            a.show.push(id)
            return a
        })
        return id
    }

    $: newName = name === null && (type === "image" || type === "video") ? removeExtension(getFileName(id)) : name || ""

    export let icon = false
    let iconID: null | string = null
    let custom = false
    $: {
        // WIP similar to focus.ts
        if (icon) {
            custom = false
            if (type === "show") {
                if ($shows[show.id]?.private) iconID = "private"
                else if ($showsCache[show.id]?.reference?.type === "scripture") {
                    custom = true
                    iconID = "scripture"
                } else if ($showsCache[show.id]?.reference?.type === "calendar") {
                    custom = true
                    iconID = "event"
                } else if ($shows[show.id]?.category && $categories[$shows[show.id].category || ""]) {
                    custom = true
                    iconID = $categories[$shows[show.id].category || ""].icon || null
                } else iconID = "noIcon"
            } else if (type === "audio") iconID = "music"
            else if (type === "overlay") iconID = "overlays"
            // else if (type === "player") iconID = "live"
            else iconID = type
        }
    }

    $: selectedItem = $focusMode ? $activeFocus : $activeShow
    $: isActive = index !== null ? selectedItem?.index === index : selectedItem?.id === id

    let editActive = false
    function click(e: ClickEvent) {
        const { ctrl, shift, target } = e.detail
        if (editActive || ctrl || shift || isActive || target.closest("input")) return

        // set active show
        let pos = index
        if (index === null && $activeProject !== null) {
            let i = $projects[$activeProject]?.shows?.findIndex((p) => p.id === id) ?? -1
            if (i > -1) pos = i
        }

        let newShow: any = { id, type }

        if ($focusMode) {
            let inProject = $projects[$activeProject || ""]?.shows?.find((p) => p.id === id)
            if (inProject) {
                activeFocus.set({ id, index: pos ?? undefined })
                return
            } else {
                focusMode.set(false)
            }
        }

        if (pos !== null) {
            newShow.index = pos
            if (type === "audio") newShow.name = show.name
            else if (type === "show") {
                // async waiting for show to load
                setTimeout(async () => {
                    // preload show (so the layout can be changed)
                    await loadShows([id])
                    if ($showsCache[id]) swichProjectItem(pos, id)
                })
            }
        }

        activeShow.set(newShow)

        if (type === "image" || type === "video") activeEdit.set({ id, type: "media", items: [] })
        else if ($activeEdit.id) activeEdit.set({ type: "show", slide: 0, items: [], showId: $activeShow?.id })

        if ($activePage === "edit") refreshEditSlide.set(true)
    }

    async function doubleClick(e: ClickEvent) {
        if (editActive || $outLocked || e.detail.target.closest("input")) return

        let outputId: string = getActiveOutputs($outputs, false, true, true)[0]
        let currentOutput = $outputs[outputId] || {}

        if (type === "show" && $showsCache[id] && $showsCache[id].layouts[$showsCache[id].settings.activeLayout]?.slides?.length) {
            let layoutRef = getLayoutRef()
            let firstEnabledIndex = layoutRef.findIndex((a) => !a.data.disabled)
            updateOut("active", firstEnabledIndex, layoutRef, !e.detail.alt)

            let slide = currentOutput.out?.slide || null
            if (slide?.id === id && slide?.index === firstEnabledIndex && slide?.layout === $showsCache[id].settings.activeLayout) return

            setOutput("slide", { id, layout: $showsCache[id].settings.activeLayout, index: firstEnabledIndex })
        } else if (type === "image" || type === "video") {
            let outputStyle = $styles[currentOutput.style || ""]
            const mediaData = $media[id] || {}
            let mediaStyle: MediaStyle = getMediaStyle(mediaData, outputStyle)

            const videoType = mediaData.videoType
            const shouldLoop = videoType === "background" ? show.loop || true : false
            const shouldBeMuted = videoType === "background" ? show.muted || true : false

            let out = { path: id, muted: shouldBeMuted, loop: shouldLoop, startAt: 0, type: type, ...mediaStyle }

            // clear slide
            if (videoType === "foreground" || (videoType !== "background" && (type === "image" || !shouldLoop))) clearSlide()

            setOutput("background", out)
        } else if (type === "pdf") {
            // get PDF data
            GlobalWorkerOptions.workerSrc = "./assets/pdf.worker.min.mjs"
            const loadingTask = getDocument(id)
            const pdfDoc = await loadingTask.promise
            const pages = pdfDoc.numPages
            loadingTask.destroy()

            let name = show.name || removeExtension(getFileName(id))
            setOutput("slide", { type: "pdf", id, page: 0, pages, name })
            clearBackground()
        } else if (type === "audio") AudioPlayer.start(id, { name: show.name })
        else if (type === "overlay") setOutput("overlays", show.id, false, "", true)
        else if (type === "player") setOutput("background", { id, type: "player" })
    }

    function rename(e: any) {
        if (readOnly) return

        const name = checkName(e.detail.value, id)
        historyAwait([id], { id: "SHOWS", newData: { data: [{ id, show: { name } }], replace: true }, location: { page: "drawer" } })
        // WIP this does not update in the shows drawer before refresh (if checkName updates the name)
    }

    let activeOutput: string | null = null
    $: if ($outputs) {
        activeOutput = findMatchingOut(id)

        // only highlight if the set layout is outputted
        if (activeOutput && show.layoutInfo?.name) {
            const outputId = getActiveOutputs($outputs, true, true, true)[0]
            const selectedLayoutId = Object.entries($showsCache[id]?.layouts || {}).find(([_id, a]) => a.name === show.layoutInfo.name)?.[0]
            if ($outputs[outputId]?.out?.slide?.layout !== selectedLayoutId) activeOutput = null
        }
    }

    $: outline = activeOutput !== null || !!$playingAudio[id]
</script>

<div id="show_{id}" class="main" class:played={show.played}>
    <MaterialButton
        on:click={click}
        on:dblclick={doubleClick}
        {isActive}
        showOutline={outline}
        class="context {$$props.class}{readOnly ? '_readonly' : ''}"
        style="font-weight: normal;--outline-color: {activeOutput || 'var(--secondary)'};{$notFound.show?.includes(id) ? 'background-color: rgb(255 0 0 / 0.2);' : ''}{style}{$$props.style || ''}"
        tab
    >
        <div class="row">
            <span class="cell" style="max-width: calc(100% {showNumber ? '- var(--number-width)' : ''} - var(--modified-width, 0px));">
                {#if icon || show.locked}
                    <Icon id={show.played ? "check" : iconID ? iconID : show.locked ? "locked" : "noIcon"} custom={!show.played && custom} box={iconID === "ppt" ? 50 : 24} white={show.played} right />
                {/if}

                <HiddenInput value={newName} id={index !== null ? "show_" + id + "#" + index : "show_drawer_" + id} on:edit={rename} bind:edit={editActive} allowEmpty={false} allowEdit={(!show.type || show.type === "show") && !readOnly} />

                {#if match !== null && ($activeShow?.data?.searchInput ? $activeShow?.id === id : isFirst)}
                    <span style="opacity: 0.4;font-size: 0.9em;padding: 0 10px;">Press enter to add to project</span>
                {/if}

                {#if show.layoutInfo?.name}
                    <span class="layout" style="opacity: 0.6;font-style: italic;font-size: 0.9em;">{show.layoutInfo.name}</span>
                {/if}

                {#if show.scheduleLength !== undefined && Number(show.scheduleLength)}
                    <span class="layout">{joinTime(secondsToTime(show.scheduleLength))}</span>
                {/if}
            </span>

            <span class="cell">
                {#if showNumber}
                    <span class="number">{showNumber}</span>
                {/if}

                <span class="date">{data || ""}</span>
            </span>
        </div>
    </MaterialButton>
</div>

<style>
    .main {
        width: 100%;
    }

    .main :global(button) {
        width: 100%;
        padding: 0.15em 0.8em;
    }

    .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 5px;
        width: 100%;
    }

    .cell {
        display: flex;
        align-items: center;

        max-width: 75%;
    }

    .cell .number,
    .cell .date {
        font-size: 0.9em;
        white-space: nowrap;
        text-align: right;
        color: var(--text);
        opacity: 0.75;
    }

    .cell .number {
        font-weight: 600;
        text-align: center;

        min-width: var(--number-width);
    }

    .cell .date {
        font-variant-numeric: tabular-nums;

        /* remove button padding & scrollbar width */
        min-width: calc(var(--modified-width) - 0.8em - 8px);
    }
    .main :global(button p) {
        margin: 3px 5px;
    }

    .main.played :global(button:not(.isActive)) {
        border-left: 4px double rgb(255 255 255 / 0.2) !important;
    }

    .layout {
        opacity: 0.8;
        font-size: 0.8em;
        padding-inline-start: 5px;
        white-space: nowrap;
        max-width: 45%;
    }
</style>
