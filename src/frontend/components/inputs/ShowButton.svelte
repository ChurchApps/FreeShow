<script lang="ts">
    import { getDocument, GlobalWorkerOptions } from "pdfjs-dist"
    import type { ClickEvent } from "../../../types/Main"
    import { AudioPlayer } from "../../audio/audioPlayer"
    import { activeEdit, activeFocus, activePage, activeProject, activeShow, categories, editingProjectTemplate, effects, focusMode, globalTags, media, notFound, outLocked, outputs, overlayCategories, overlays, playerVideos, playingAudio, projects, projectTemplates, refreshEditSlide, shows, showsCache, special, styles, textCache } from "../../stores"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import { customIconsColors } from "../../values/customIcons"
    import { history, historyAwait } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { encodeFilePath, getExtension, getFileName, getMedia, getMediaLayerType, getMediaStyle, getMediaType, getVideoDuration, mediaSize, removeExtension } from "../helpers/media"
    import { findMatchingOut, getActiveOutputs, setOutput, startFolderTimer } from "../helpers/output"
    import { loadShows } from "../helpers/setShow"
    import { checkName, getLayoutRef } from "../helpers/show"
    import { swichProjectItem, updateOut } from "../helpers/showActions"
    import T from "../helpers/T.svelte"
    import { joinTime, secondsToTime } from "../helpers/time"
    import { clearBackground, clearSlide } from "../output/clear"
    import { getTextSnippet, highlightText } from "../quicksearch/searchHighlight"
    import HiddenInput from "./HiddenInput.svelte"
    import MaterialButton from "./MaterialButton.svelte"

    export let id: string
    export let show: any // ShowList | ShowRef
    export let data: null | string = null
    export let index: null | number = null
    export let isFirst: boolean = false
    export let isProject: boolean = false
    $: type = show.type || "show"
    $: name = type === "show" ? $shows[show.id]?.name : type === "overlay" ? $overlays[show.id]?.name : type === "effect" ? $effects[show.id]?.name : type === "player" ? ($playerVideos[id] || show.data?.id ? $playerVideos[id]?.name || show.data?.name || show.data?.id : setNotFound(id)) : show.name
    // export let page: "side" | "drawer" = "drawer"
    export let match: null | number = null
    export let searchValue = ""
    $: showNumber = isProject ? "" : show?.quickAccess?.number || show?.meta?.number || ""
    $: showDuration = isProject ? $shows[show.id]?.quickAccess?.duration || show?.scheduleLength || 0 : 0

    let profile = getAccess("shows")
    let readOnly = profile.global === "read" || profile[show.category] === "read"

    // search
    $: searchStyle = match !== null ? `width: ${match}%;` : ""
    // excerpt of the matching lyrics
    $: snippet = !isProject && match !== null && searchValue.length > 2 ? getTextSnippet($textCache[id] || "", searchValue) : ""

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
    let subicon = ""
    $: {
        // WIP similar to focus.ts
        if (icon) {
            custom = false
            subicon = ""
            if (type === "show") {
                if ($shows[show.id]?.private) iconID = "private"
                else if ($shows[show.id]?.category && $categories[$shows[show.id].category || ""]) {
                    custom = true
                    iconID = $categories[$shows[show.id].category || ""].icon || null
                } else if ($showsCache[show.id]?.reference?.type === "scripture") {
                    custom = true
                    iconID = "scripture"
                } else if ($showsCache[show.id]?.reference?.type === "calendar") {
                    custom = true
                    iconID = "event"
                } else iconID = "noIcon"
            } else if (type === "audio") {
                iconID = "music"
            } else if (type === "overlay") {
                if ($overlays[show.id]?.category && $overlayCategories[$overlays[show.id].category || ""]) {
                    custom = true
                    iconID = $overlayCategories[$overlays[show.id].category || ""].icon || null
                    subicon = "overlays"
                } else {
                    iconID = "overlays"
                }
                // } else if (type === "image" || type === "video") {
                //     subicon = type
            } else if (type === "effect") {
                iconID = "effects"
            }
            // else if (type === "player") iconID = "live"
            else iconID = type
        }
    }

    $: selectedItem = $focusMode ? $activeFocus : $activeShow
    $: isActive = index !== null ? selectedItem?.index === index : selectedItem?.id === id

    // WIP partly duplicate of openShow() in show.ts
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
                activeFocus.set({ id, index: pos ?? undefined, type })
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
        if (type === "show_placeholder") return
        if (editActive || $outLocked || e.detail.target.closest("input")) return

        let outputId: string = getActiveOutputs($outputs, false, true, true)[0]
        let currentOutput = $outputs[outputId] || {}

        if (type === "show" && $showsCache[id]?.settings && $showsCache[id].layouts[$showsCache[id].settings.activeLayout]?.slides?.length) {
            let layoutRef = getLayoutRef()
            let firstEnabledIndex = layoutRef.findIndex((a) => !a.data.disabled)
            updateOut("active", firstEnabledIndex, layoutRef, !e.detail.alt)

            let slide = currentOutput.out?.slide || null
            if (slide?.id === id && slide?.index === firstEnabledIndex && slide?.layout === $showsCache[id].settings.activeLayout) return

            setOutput("slide", { id, layout: $showsCache[id].settings.activeLayout, index: firstEnabledIndex })
        } else if (type === "image" || type === "video") {
            let outputStyle = $styles[currentOutput.style || ""]
            const mediaData = $media[id] || {}
            const mediaStyle = getMediaStyle(mediaData, outputStyle)

            const videoType = getMediaLayerType(id, mediaStyle)
            const shouldLoop = videoType === "background" ? show.loop || true : false
            const shouldBeMuted = videoType === "background" ? show.muted || true : false

            const located = await getMedia(id)
            if (!located) return

            let out = { path: located.path, muted: shouldBeMuted, loop: shouldLoop, startAt: 0, type, ...mediaStyle }

            // clear slide
            if (videoType === "foreground" || (videoType !== "background" && (type === "image" || !shouldLoop))) clearSlide()

            setOutput("background", out)
        } else if (type === "pdf") {
            // get PDF data
            // WIP duplicate of playPdf in showActions.ts
            GlobalWorkerOptions.workerSrc = "./assets/pdf.worker.min.mjs"
            const loadingTask = getDocument(encodeFilePath(id))
            const pdfDoc = await loadingTask.promise
            const pages = pdfDoc.numPages
            loadingTask.destroy()

            let name = show.name || removeExtension(getFileName(id))
            setOutput("slide", { type: "pdf", id, page: 0, pages, name })
            clearBackground()

            if (show.data?.timer) startFolderTimer(id, { type: "pdf", path: "" })
        } else if (type === "audio") AudioPlayer.start(id, { name: show.name })
        else if (type === "overlay") setOutput("overlays", show.id, false, "", true)
        else if (type === "effect") setOutput("effects", show.id, false, "", true)
        else if (type === "player") setOutput("background", { id, type: "player" })
    }

    function rename(e: any) {
        if (readOnly) return

        const value = e.detail.value.trim()

        if (type === "show_placeholder") {
            const projectId = $editingProjectTemplate
            if (!projectId) return

            const project = $projectTemplates[projectId]
            if (!project?.shows || index === null || !project.shows[index]) return

            const newShows = [...project.shows]
            newShows[index] = { ...newShows[index], name: value }

            history({ id: "UPDATE", newData: { key: "shows", data: newShows }, oldData: { id: projectId }, location: { page: "show", id: "project_template" } })
            return
        }

        const name = checkName(value, id)
        historyAwait([id], { id: "SHOWS", newData: { data: [{ id, show: { name } }], replace: true }, location: { page: "drawer" } })
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

    let thumbnailPath: string | null = null
    let duration = 0
    $: isMedia = type === "image" || type === "video" || type === "player"
    $: mediaStyle = isMedia ? getMediaStyle($media[id], undefined) : {} // , $styles[getFirstActiveOutput($outputs)?.style || ""]
    $: mediaStyleString = `pointer-events: none;filter: ${mediaStyle.filter || ""};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`
    $: if (id && isMedia) getThumbnail()
    else {
        thumbnailPath = ""
        duration = 0
    }
    async function getThumbnail() {
        thumbnailPath = ""
        duration = 0

        if (type === "player") {
            const player = $playerVideos[id] || show.data
            if (player?.type === "youtube") {
                thumbnailPath = `https://i.ytimg.com/vi/${player.id}/sddefault.jpg`
                return
            }
            if (player?.type === "vimeo") {
                thumbnailPath = `https://vumbnail.com/${player.id}_medium.jpg`
                return
            }
            return
        }

        const media = await getMedia(id, mediaSize.small)
        if (media) thumbnailPath = media.thumbnail || media.altPath || media.path

        // online videos (Pixabay) might not have a thumbnail ready
        if (getMediaType(getExtension(thumbnailPath)) === "video") thumbnailPath = ""

        if (type === "video") {
            duration = await getVideoDuration(id)
        }
    }

    // placeholder title with index
    // $: showTemplateName = type === "show_placeholder" ? `${translateText("new.placeholder: formats.show")} ${index !== null ? ($editingProjectTemplate ? $projectTemplates[$editingProjectTemplate] : $projects[$activeProject || ""])?.shows?.reduce((c, show, i) => (show.type === "show_placeholder" && i < index ? c + 1 : c), 1) : ""}` : ""
    $: showTemplateName = type === "show_placeholder" ? (show.name && show.name !== "—" ? show.name : translateText("new.placeholder")) : ""
</script>

<div id="show_{id}" class="main" class:isProject class:played={show.played}>
    <MaterialButton on:click={click} on:dblclick={doubleClick} {isActive} showOutline={outline} class="context {$$props.class}{readOnly ? '_readonly' : ''}" style="font-weight: normal;--outline-color: {activeOutput || 'var(--secondary)'};{$notFound.show?.includes(id) ? 'background-color: rgb(255 0 0 / 0.2);' : ''}{$$props.style || ''}" tab>
        <div class="row" style={type === "show_placeholder" ? "font-style: italic;" : ""}>
            <span class="cell" style={isProject ? `width: 100%;max-width: ${show.layoutInfo?.name || show.scheduleLength ? 92 : 100}%;` : `width: 75%;min-width: 120px;max-width: calc(100% ${showNumber ? "- var(--number-width)" : ""} - var(--modified-width, 0px));`}>
                <div class="icon" class:isMedia style="position: relative;">
                    {#if type === "show_placeholder"}
                        <Icon id="swap" white right />
                    {:else if thumbnailPath}
                        <img class="thumbnail" src={encodeFilePath(thumbnailPath)} alt="thumbnail" style={mediaStyleString} />
                    {:else if icon || show.locked}
                        <Icon id={show.played ? "check" : iconID ? iconID : show.locked ? "locked" : "noIcon"} custom={!show.played && custom} box={iconID === "ppt" ? 50 : 24} color={show.played ? "#97ff95" : customIconsColors[iconID || ""] || ""} white right={!isMedia} boxed={!show.locked} />
                    {/if}

                    {#if duration}
                        <span class="duration">{joinTime(secondsToTime(duration))}</span>
                    {/if}
                    {#if subicon}
                        <Icon id={subicon} size={0.7} white style="position: absolute;bottom: -3px;right: 1px;opacity: 0.8;" />
                    {/if}
                </div>

                <HiddenInput value={type === "show_placeholder" ? showTemplateName : newName} id={index !== null ? "show_" + id + "#" + index : "show_drawer_" + id} on:edit={rename} bind:edit={editActive} allowEmpty={false} allowEdit={!readOnly && ((type === "show_placeholder" && !!$editingProjectTemplate) || !show.type || show.type === "show")} />

                {#if isProject}
                    {#if show.layoutInfo?.name}
                        <span class="layout" style="opacity: 0.6;font-style: italic;font-size: 0.9em;">{show.layoutInfo.name}</span>
                    {/if}

                    {#if showDuration && Number(showDuration)}
                        <span class="layout">{joinTime(secondsToTime(showDuration))}</span>
                    {/if}
                {:else}
                    <!-- shows drawer list -->
                    {#if match !== null && ($activeShow?.data?.searchInput ? $activeShow?.id === id : isFirst)}
                        <span style="opacity: 0.4;font-size: 0.9em;padding: 0 10px;max-width: 40%;"><T id="tips.show_add_project" /></span>
                    {/if}
                {/if}
            </span>

            {#if isProject}
                {#if isActive}
                    <span class="arrow">
                        <Icon id="next" white />
                    </span>
                {/if}
            {:else}
                <span class="cell">
                    <!-- tags -->
                    {#if $special.displayTags}
                        <span class="tags">
                            {#each $shows[show.id]?.quickAccess?.tags || [] as tagId}
                                {@const tag = $globalTags[tagId]}
                                {#if tag}
                                    <span class="tag" style="--color: {tag.color || 'white'};">
                                        <p style="margin: 0;">{tag.name || "—"}</p>
                                    </span>
                                {/if}
                            {/each}
                        </span>
                    {/if}

                    {#if showNumber || $special.displayTags}
                        <span class="number">{showNumber || ""}</span>
                    {/if}

                    <span class="date">{data || ""}</span>
                </span>
            {/if}
        </div>

        {#if snippet}
            <p class="snippet">{@html highlightText(snippet, searchValue)}</p>
        {/if}
    </MaterialButton>

    {#if match !== null}
        <span class="match-indicator" data-title="{match}%">
            <span class="match-fill" style={searchStyle}></span>
        </span>
    {/if}
</div>

<style>
    .main {
        width: 100%;

        display: flex;
        flex-direction: column;
    }

    .main :global(button) {
        width: 100%;
        padding: 0.15em 0.8em;

        /* content under the name, like a search match snippet */
        flex-direction: column;
        align-items: stretch;
        gap: 0;
    }
    .main:not(.isProject) :global(button) {
        border-left: 0 !important;
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
        justify-content: space-between;

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

    .icon {
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .icon.isMedia {
        min-width: 35px;
        min-height: 35px;
        width: 35px;
        height: 35px;
        margin-right: 10px;
    }

    .thumbnail {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 4px;

        /* hide alt text */
        text-indent: 100%;
        white-space: nowrap;
        overflow: hidden;
    }
    .duration {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);

        font-family: monospace;
        font-size: 0.85em;

        padding: 0px 5px;
        border-radius: 2px;

        background-color: rgb(0 0 0 / 0.5);
        color: white;
    }

    .arrow {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);

        opacity: 0.4;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* tags */

    .tags {
        display: flex;
        gap: 5px;
        padding-left: 10px;
    }

    .tag {
        --color: white;

        display: flex;
        padding: 0px 5px;

        color: var(--color);
        font-weight: 600;

        border-radius: 20px;
        border: 2px solid var(--color);
    }

    /* search */

    .main p.snippet {
        font-size: 0.8em;
        opacity: 0.6;
        text-align: left;
        margin: -2px 5px 3px;
    }
    .main p.snippet :global(mark) {
        background: var(--secondary-opacity);
        color: inherit;
        padding: 0 2px;
        border-radius: 4px;
    }

    .match-indicator {
        position: relative;
        display: block;
        width: 100%;
        height: 2px;
        background: rgb(255 255 255 / 0.08);
        overflow: hidden;
    }
    .match-fill {
        display: block;
        height: 100%;
        background: var(--secondary-opacity);
    }
</style>
