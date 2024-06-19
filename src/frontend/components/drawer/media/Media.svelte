<script lang="ts">
    import VirtualList from "@sveltejs/svelte-virtual-list"
    import { onDestroy } from "svelte"
    import { slide } from "svelte/transition"
    import { uid } from "uid"
    import { MAIN, READ_FOLDER } from "../../../../types/Channels"
    import { activeDrawerOnlineTab, activeEdit, activePopup, activeShow, dictionary, labelsDisabled, media, mediaFolders, mediaOptions, outLocked, outputs, popupData, selectAllMedia, selected } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"
    import { splitPath } from "../../helpers/get"
    import { encodeFilePath, getExtension, getFileName, getMediaType, isMediaExtension, removeExtension } from "../../helpers/media"
    import { getActiveOutputs, setOutput } from "../../helpers/output"
    import { clearBackground } from "../../helpers/showActions"
    import Button from "../../inputs/Button.svelte"
    import Center from "../../system/Center.svelte"
    import Cameras from "../live/Cameras.svelte"
    import NDIStreams from "../live/NDIStreams.svelte"
    import Screens from "../live/Screens.svelte"
    import Windows from "../live/Windows.svelte"
    import PlayerVideos from "../player/PlayerVideos.svelte"
    import Folder from "./Folder.svelte"
    import Media from "./MediaCard.svelte"
    import MediaGrid from "./MediaGrid.svelte"
    import { loadFromPixabay } from "./pixabay"
    import { send } from "../../../utils/request"

    export let active: string | null
    export let searchValue: string = ""
    export let streams: any[] = []

    let files: any[] = []

    let notFolders = ["all", "favourites", "online", "screens", "cameras"]
    $: rootPath = notFolders.includes(active || "") ? "" : active !== null ? $mediaFolders[active]?.path! || "" : ""
    $: path = notFolders.includes(active || "") ? "" : rootPath

    $: folderName = active === "all" ? "category.all" : active === "favourites" ? "category.favourites" : rootPath === path ? (active !== null ? $mediaFolders[active]?.name || "" : "") : splitPath(path).name

    async function loadFilesAsync() {
        fullFilteredFiles = []
        if (onlineTab !== "pixabay" || activeView === "folder") return

        fullFilteredFiles = await loadFromPixabay(searchValue || "landscape", activeView === "video")
        loadAllFiles(fullFilteredFiles)
    }

    let screenTab = "screens"

    let onlineTab = "youtube"
    $: if (active === "online" && onlineTab === "pixabay" && (searchValue !== null || activeView)) loadFilesAsync()
    // only for info!
    $: if (onlineTab) activeDrawerOnlineTab.set(onlineTab)

    // get list of files & folders
    let prevActive: null | string = null
    $: {
        if (prevActive === "online") activeView = "all"

        if (active === "online") {
            activeView = "image"

            prevActive = active
        } else if (active === "favourites") {
            prevActive = active
            files = Object.entries($media)
                .map(([path, a]: any) => {
                    let p = splitPath(path)
                    let name = p.name
                    return { path, favourite: a.favourite === true, name, extension: p.extension, audio: a.audio === true }
                })
                .filter((a) => a.favourite === true && a.audio !== true)
                .sort((a: any, b: any) => a.name.localeCompare(b.name))

            filterFiles()
        } else if (active === "all") {
            if (active !== prevActive) {
                prevActive = active
                files = []
                fullFilteredFiles = []
                Object.values($mediaFolders).forEach((data) => send(MAIN, ["READ_FOLDER"], { path: data.path }))
            }
        } else if (path?.length) {
            if (path !== prevActive) {
                prevActive = path
                files = []
                fullFilteredFiles = []
                send(MAIN, ["READ_FOLDER"], { path, listFilesInFolders: true })
            }
        } else {
            // screens && cameras
            prevActive = active
        }
    }

    let filesInFolders: string[] = []

    let listenerId = uid()
    onDestroy(() => window.api.removeListener(READ_FOLDER, listenerId))

    // receive files
    window.api.receive(READ_FOLDER, receiveContent, listenerId)
    function receiveContent(msg: any) {
        filesInFolders = (msg.filesInFolders || []).sort((a: any, b: any) => a.name.localeCompare(b.name))

        if (active !== "all" && msg.path !== path) return

        files.push(...msg.files.filter((file: any) => isMediaExtension(file.extension) || file.folder))
        files.sort((a: any, b: any) => a.name.localeCompare(b.name)).sort((a: any, b: any) => (a.folder === b.folder ? 0 : a.folder ? -1 : 1))

        files = files.map((a) => ({ ...a, path: a.folder ? a.path : encodeFilePath(a.path) }))

        filterFiles()
    }

    let scrollElem: any

    // arrow selector
    let activeFile: null | number = null
    let allFiles: string[] = []
    let content = allFiles.length

    activeShow.subscribe((a) => {
        if (a?.type !== "video" && a?.type !== "image") activeFile = null
    })

    // filter files
    let activeView: "all" | "folder" | "image" | "video" = "all"
    let filteredFiles: any[] = []
    $: if (activeView) filterFiles()
    $: if (searchValue !== undefined) filterSearch()

    function filterFiles() {
        if (active === "online" || active === "screens" || active === "cameras") return

        // filter files
        if (activeView === "all") filteredFiles = files.filter((a) => active !== "all" || !a.folder)
        else filteredFiles = files.filter((a) => (activeView === "folder" && active !== "all" && a.folder) || (!a.folder && activeView === getMediaType(a.extension)))

        // reset arrow selector
        loadAllFiles(filteredFiles)

        filterSearch()

        // scroll to top
        scrollElem?.scrollTo(0, 0)
    }

    function loadAllFiles(f: any[]) {
        allFiles = [...f.filter((a) => !a.folder).map((a) => a.path)]
        if ($activeShow !== null && allFiles.includes($activeShow.id)) activeFile = allFiles.findIndex((a) => a === $activeShow!.id)
        else activeFile = null
        content = allFiles.length
    }

    // search
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
    let fullFilteredFiles: any[] = []
    function filterSearch() {
        fullFilteredFiles = clone(filteredFiles)
        if (searchValue.length > 1) fullFilteredFiles = [...fullFilteredFiles, ...filesInFolders].filter((a) => filter(a.name).includes(filter(searchValue)))

        // scroll to top
        document.querySelector("svelte-virtual-list-viewport")?.scrollTo(0, 0)
    }

    let nextScrollTimeout: any = null
    function wheel(e: any) {
        if (!e.ctrlKey && !e.metaKey) return
        if (nextScrollTimeout) return

        mediaOptions.set({ ...$mediaOptions, columns: Math.max(2, Math.min(10, $mediaOptions.columns + (e.deltaY < 0 ? -100 : 100) / 100)) })

        // don't start timeout if scrolling with mouse
        if (e.deltaY > 100 || e.deltaY < -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    const shortcuts: any = {
        ArrowRight: () => {
            if (activeFile === null || activeFile < content - 1) activeFile = activeFile === null ? 0 : activeFile + 1
        },
        ArrowLeft: () => {
            if (activeFile === null || activeFile > 0) activeFile = activeFile === null ? content - 1 : activeFile - 1
        },
        Backspace: () => {
            if (rootPath === path) return
            goBack()
        },
    }

    $: if (activeFile !== null) selectMedia()
    function selectMedia() {
        if (activeFile === null) return

        let path = allFiles[activeFile]
        if (!path) return

        activeEdit.set({ id: path, type: "media", items: [] })
        let name = removeExtension(getFileName(path))
        let type = getMediaType(getExtension(path))
        activeShow.set({ id: path, name, type })
    }

    function keydown(e: any) {
        if (e.key === "Enter" && searchValue.length > 1 && e.target.closest(".search")) {
            if (fullFilteredFiles.length) {
                let file = fullFilteredFiles[0]
                activeShow.set({ id: file.path, name: file.name, type: getMediaType(file.extension) })
                activeFile = filteredFiles.findIndex((a) => a.path === file.path)
                if (activeFile < 0) activeFile = null
            }
        }

        if (e.target.closest("input") || e.target.closest(".edit") || !allFiles.length) return

        if ((e.ctrlKey || e.metaKey) && shortcuts[e.key]) {
            // e.preventDefault()
            shortcuts[e.key]()
        }
    }

    function goBack() {
        const lastSlash = path.lastIndexOf("\\") > -1 ? path.lastIndexOf("\\") : path.lastIndexOf("/")
        const folder = path.slice(0, lastSlash)
        path = folder.length > rootPath.length ? folder : rootPath
    }

    const slidesViews: any = { grid: "list", list: "grid" }
    const nextActiveView: any = { all: "folder", folder: "image", image: "video", video: "all" }

    let zoomOpened: boolean = false
    function mousedown(e: any) {
        if (e.target.closest(".zoom_container") || e.target.closest("button")) return

        zoomOpened = false
    }

    $: currentOutput = $outputs[getActiveOutputs()[0]]

    // select all
    $: if ($selectAllMedia) selectAll()
    function selectAll() {
        let data = fullFilteredFiles
            .filter((a) => a.extension)
            .map((file) => {
                let type = getMediaType(file.extension)
                let name = file.name.slice(0, file.name.lastIndexOf("."))
                return { name, path: file.path, type }
            })

        selected.set({ id: "media", data })
        selectAllMedia.set(false)
    }
</script>

<!-- TODO: download pixabay images!!! -->
<!-- TODO: pexels images ? -->

<svelte:window on:keydown={keydown} on:mousedown={mousedown} />

<!-- TODO: autoscroll -->
<div class="scroll" style="flex: 1;overflow-y: auto;" bind:this={scrollElem} on:wheel|passive={wheel}>
    <div class="grid" class:list={$mediaOptions.mode === "list"} style="height: 100%;">
        {#if active === "online" && (onlineTab === "youtube" || onlineTab === "vimeo")}
            <PlayerVideos active={onlineTab} {searchValue} />
        {:else if active === "screens"}
            {#if screenTab === "screens"}
                <Screens bind:streams />
            {:else if screenTab === "ndi"}
                <NDIStreams />
            {:else}
                <Windows bind:streams {searchValue} />
            {/if}
        {:else if active === "cameras"}
            <Cameras
                on:click={({ detail }) => {
                    let e = detail.event
                    let cam = detail.cam

                    if ($outLocked || e.ctrlKey || e.metaKey) return
                    if (currentOutput.out?.background?.id === cam.id) clearBackground()
                    else setOutput("background", { name: cam.name, id: cam.id, cameraGroup: cam.cameraGroup, type: "camera" })
                }}
            />
        {:else if fullFilteredFiles.length}
            {#key fullFilteredFiles}
                {#if $mediaOptions.mode === "grid"}
                    <MediaGrid items={fullFilteredFiles} columns={$mediaOptions.columns} let:item>
                        {#if item.folder}
                            <Folder bind:rootPath={path} name={item.name} path={item.path} mode={$mediaOptions.mode} />
                        {:else}
                            <Media name={item.name} path={item.path} thumbnailPath={$mediaOptions.columns < 3 ? "" : item.thumbnailPath} type={getMediaType(item.extension)} bind:activeFile {allFiles} {active} />
                        {/if}
                    </MediaGrid>
                {:else}
                    <VirtualList items={fullFilteredFiles} let:item={file}>
                        {#if file.folder}
                            <Folder bind:rootPath={path} name={file.name} path={file.path} mode={$mediaOptions.mode} />
                        {:else}
                            <Media thumbnail={$mediaOptions.mode !== "list"} name={file.name} path={file.path} type={getMediaType(file.extension)} bind:activeFile {allFiles} {active} />
                        {/if}
                    </VirtualList>
                {/if}
            {/key}
        {:else}
            <Center>
                <Icon id="noImage" size={5} white />
            </Center>
        {/if}
    </div>
</div>

{#if active !== "cameras"}
    <div class="tabs">
        {#if active === "screens"}
            <Button style="flex: 1;" active={screenTab === "screens"} on:click={() => (screenTab = "screens")} center>
                <Icon size={1.2} id="screen" right />
                <p><T id="live.screens" /></p>
            </Button>
            <Button style="flex: 1;" active={screenTab === "windows"} on:click={() => (screenTab = "windows")} center>
                <Icon size={1.2} id="window" right />
                <p><T id="live.windows" /></p>
            </Button>
            <!-- WIP ndi inputs: -->
            <!-- <Button style="flex: 1;" active={screenTab === "ndi"} on:click={() => (screenTab = "ndi")} center>
                <Icon size={1.2} id="ndi" right />
                <p>NDI</p>
            </Button> -->
        {:else if active === "online"}
            <Button style="flex: 1;" active={onlineTab === "youtube"} on:click={() => (onlineTab = "youtube")} center>
                <Icon style="fill: {onlineTab !== 'youtube' ? 'white' : '#ff0000'};" size={1.2} id="youtube" right />
                <p>YouTube</p>
            </Button>
            <Button style="flex: 1;" active={onlineTab === "vimeo"} on:click={() => (onlineTab = "vimeo")} center>
                <Icon style="fill: {onlineTab !== 'vimeo' ? 'white' : '#17d5ff'};" size={1.2} id="vimeo" right />
                <p>Vimeo</p>
            </Button>
            <Button style="flex: 1;" active={onlineTab === "pixabay"} on:click={() => (onlineTab = "pixabay")} center>
                <Icon style="fill: {onlineTab !== 'pixabay' ? 'white' : '#00ab6b'};" size={1.2} id="pixabay" box={48} right />
                <p>Pixabay</p>
            </Button>
        {:else}
            <Button disabled={rootPath === path} title={$dictionary.actions?.back} on:click={goBack}>
                <Icon size={1.3} id="back" />
            </Button>
            <!-- <Button disabled={rootPath === path} title={$dictionary.actions?.home} on:click={() => (path = rootPath)}>
            <Icon size={1.3} id="home" />
        </Button> -->
            <span style="flex: 1;text-align: center;">
                {#key folderName}
                    {#if folderName.includes(".")}
                        <T id={folderName} />
                    {:else}
                        {folderName}
                    {/if}
                {/key}
            </span>

            <div class="seperator" />

            <Button disabled={!allFiles.length || activeFile === 0} on:click={() => (activeFile = activeFile === null ? content - 1 : activeFile - 1)}>
                <Icon size={1.3} id="previous" />
            </Button>
            <p style="opacity: 0.8;">{activeFile === null ? "" : activeFile + 1 + "/"}{content}</p>
            <Button disabled={!allFiles.length || activeFile === content - 1} on:click={() => (activeFile = activeFile === null ? 0 : activeFile + 1)}>
                <Icon size={1.3} id="next" />
            </Button>
        {/if}

        {#if active !== "screens"}
            <div class="seperator" />

            {#if active === "online" && (onlineTab === "youtube" || onlineTab === "vimeo")}
                <Button
                    style="min-width: 170px;"
                    on:click={() => {
                        popupData.set({ active: onlineTab })
                        activePopup.set("player")
                    }}
                    center
                >
                    <Icon id="add" right={!$labelsDisabled} />
                    {#if !$labelsDisabled}<T id="settings.add" />{/if}
                </Button>
            {:else}
                {#if active === "online"}
                    <Button title={$dictionary.media?.image} on:click={() => (activeView = "image")}>
                        <Icon size={1.3} id="image" white={activeView !== "image"} />
                    </Button>
                    <Button title={$dictionary.media?.video} on:click={() => (activeView = "video")}>
                        <Icon size={1.3} id="video" white={activeView !== "video"} />
                    </Button>
                {:else}
                    <Button title={$dictionary.media?.[activeView]} on:click={() => (activeView = nextActiveView[activeView])}>
                        <Icon size={1.3} id={activeView} white={activeView === "all"} />
                    </Button>
                {/if}

                <Button
                    on:click={() =>
                        mediaOptions.update((a) => {
                            a.mode = slidesViews[$mediaOptions.mode]
                            return a
                        })}
                    title={$dictionary.show?.[$mediaOptions.mode]}
                >
                    <Icon size={1.3} id={$mediaOptions.mode} white />
                </Button>

                <Button on:click={() => (zoomOpened = !zoomOpened)} disabled={$mediaOptions.mode === "list"} title={$dictionary.actions?.zoom}>
                    <Icon size={1.3} id="zoomIn" white />
                </Button>
                {#if zoomOpened}
                    <div class="zoom_container" transition:slide>
                        <Button style="padding: 0 !important;width: 100%;" on:click={() => mediaOptions.set({ ...$mediaOptions, columns: 5 })} bold={false} center>
                            <p class="text" title={$dictionary.actions?.resetZoom}>{(100 / $mediaOptions.columns).toFixed()}%</p>
                        </Button>
                        <Button disabled={$mediaOptions.columns <= 2} on:click={() => mediaOptions.set({ ...$mediaOptions, columns: Math.max(2, $mediaOptions.columns - 1) })} title={$dictionary.actions?.zoomIn} center>
                            <Icon size={1.3} id="add" white />
                        </Button>
                        <Button disabled={$mediaOptions.columns >= 10} on:click={() => mediaOptions.set({ ...$mediaOptions, columns: Math.min(10, $mediaOptions.columns + 1) })} title={$dictionary.actions?.zoomOut} center>
                            <Icon size={1.3} id="remove" white />
                        </Button>
                    </div>
                {/if}
            {/if}
        {/if}
    </div>
{/if}

<style>
    .tabs {
        display: flex;
        position: relative;
        background-color: var(--primary-darkest);
        align-items: center;
    }

    .grid {
        display: flex;
        flex-wrap: wrap;
        flex: 1;
        /* gap: 10px;
    padding: 10px; */
        /* padding: 5px; */
        place-content: flex-start;
    }

    .grid :global(.selectElem) {
        outline-offset: -2px;
    }
    .grid :global(#media.isSelected .main) {
        z-index: -1;
    }

    /* WIP padding in virtual grid - scrolling */
    /* .grid :global(div:first-child) {
        padding: 5px;
    } */

    .grid :global(svelte-virtual-list-viewport) {
        width: 100%;
        padding: 5px;
    }

    /* .grid :global(svelte-virtual-list-viewport) {
        height: initial;
        width: 100%;
    }
    .grid :global(svelte-virtual-list-contents) {
        display: flex;
        flex-wrap: wrap;
        flex: 1;
        padding: 5px;
        place-content: flex-start;
    } */

    .text {
        opacity: 0.8;
        text-align: center;
        padding: 0.5em 0;
    }

    .seperator {
        width: 2px;
        height: 100%;
        background-color: var(--primary);
    }

    .zoom_container {
        position: absolute;
        right: 0;
        top: 0;
        transform: translateY(-100%);
        overflow: hidden;

        flex-direction: column;
        width: auto;
        background-color: inherit;
    }
</style>
