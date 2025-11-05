<script lang="ts">
    import { onDestroy } from "svelte"
    import type { ContentProviderId } from "../../../../electron/contentProviders/base/types"
    import { Main } from "../../../../types/IPC/Main"
    import type { ClickEvent } from "../../../../types/Main"
    import { destroyMain, receiveMain, requestMain, sendMain } from "../../../IPC/main"
    import {
        activeEdit,
        activeFocus,
        activeMediaTagFilter,
        activePopup,
        activeShow,
        drawerTabsData,
        focusMode,
        labelsDisabled,
        media,
        mediaFolders,
        mediaOptions,
        outLocked,
        outputs,
        popupData,
        providerConnections,
        selectAllMedia,
        selected,
        sorted
    } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, sortByName, sortFilenames } from "../../helpers/array"
    import { splitPath } from "../../helpers/get"
    import { getExtension, getFileName, getMediaType, isMediaExtension, removeExtension } from "../../helpers/media"
    import { getActiveOutputs, setOutput } from "../../helpers/output"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialZoom from "../../inputs/MaterialZoom.svelte"
    import { clearBackground } from "../../output/clear"
    import Center from "../../system/Center.svelte"
    import VirtualList from "../VirtualList.svelte"
    import BMDStreams from "../live/BMDStreams.svelte"
    import Cameras from "../live/Cameras.svelte"
    import NDIStreams from "../live/NDIStreams.svelte"
    import Screens from "../live/Screens.svelte"
    import Windows from "../live/Windows.svelte"
    import PlayerVideos from "../player/PlayerVideos.svelte"
    import ContentLibraryBrowser from "./ContentLibraryBrowser.svelte"
    import Folder from "./Folder.svelte"
    import Media from "./MediaCard.svelte"
    import MediaGrid from "./MediaGrid.svelte"
    import { loadFromPixabay } from "./pixabay"
    import { loadFromUnsplash } from "./unsplash"

    export let active: string | null
    export let searchValue = ""
    export let streams: MediaStream[] = []

    type File = { path: string; favourite: boolean; name: string; extension: string; audio: boolean; folder?: boolean; stat?: any }
    let files: File[] = []

    let specialTabs = ["online", "screens", "cameras"]
    $: isProviderSection = contentProviders.some((p) => p.providerId === active)
    $: notFolders = ["all", ...specialTabs, ...contentProviders.map((p) => p.providerId)]
    $: rootPath = notFolders.includes(active || "") ? "" : active !== null ? $mediaFolders[active]?.path || "" : ""
    $: path = notFolders.includes(active || "") ? "" : rootPath

    $: folderName = active === "all" ? "category.all" : active === "favourites" ? "category.favourites" : rootPath === path ? (active !== null ? $mediaFolders[active]?.name || "" : "") : splitPath(path).name

    async function loadFilesAsync() {
        fullFilteredFiles = []
        if ((onlineTab !== "pixabay" && onlineTab !== "unsplash") || activeView === "folder") return

        if (onlineTab === "pixabay") {
            fullFilteredFiles = await loadFromPixabay(searchValue || "landscape", activeView === "video")
        } else if (onlineTab === "unsplash") {
            fullFilteredFiles = await loadFromUnsplash(searchValue || "landscape")
        }
        loadAllFiles(fullFilteredFiles)
    }

    function setSubSubTab(id: string) {
        if (!active) return

        drawerTabsData.update((a) => {
            if (!a.media) a.media = { enabled: true, activeSubTab: active }
            if (!a.media.openedSubSubTab) a.media.openedSubSubTab = {}
            a.media.openedSubSubTab[active] = id
            return a
        })

        if (active === "screens") screenTab = id
        else if (active === "online") onlineTab = id
    }

    // Content providers with libraries, and are currently connected
    let contentProviders: { providerId: ContentProviderId; displayName: string; hasContentLibrary: boolean }[] = []
    $: if ($providerConnections) getProviders()
    function getProviders() {
        requestMain(Main.GET_CONTENT_PROVIDERS).then((allProviders) => {
            contentProviders = allProviders.filter((p) => p.hasContentLibrary && $providerConnections[p.providerId])
        })
    }

    let screenTab = $drawerTabsData.media?.openedSubSubTab?.screens || "screens"
    let onlineTab = $drawerTabsData.media?.openedSubSubTab?.online || "youtube"
    $: if (active === "online" && onlineTab === "pixabay" && (searchValue !== null || activeView)) loadFilesAsync()
    $: if (active === "online" && onlineTab === "unsplash" && (searchValue !== null || activeView)) loadFilesAsync()

    // get list of files & folders
    let prevActive: null | string = null
    let prevTab = ""
    $: {
        if (prevActive === "online" && active !== "online") activeView = "all"
        if (active !== "online") prevTab = ""

        if (active === "online") {
            if (onlineTab !== prevTab) activeView = "image"
            prevTab = onlineTab

            prevActive = active
        } else if (active === "favourites") {
            prevActive = active
            files = sortByName(
                Object.entries($media)
                    .map(([path, a]) => {
                        let p = splitPath(path)
                        let name = p.name
                        return { path, favourite: a.favourite === true, name, extension: p.extension, audio: a.audio === true }
                    })
                    .filter((a) => a.favourite === true && a.audio !== true)
            )

            filterFiles()
        } else if (active === "all") {
            if (active !== prevActive) {
                prevActive = active
                files = []
                fullFilteredFiles = []

                for (const data of Object.values($mediaFolders)) {
                    sendMain(Main.READ_FOLDER, { path: data.path!, disableThumbnails: $mediaOptions.mode === "list" })
                }
            }
        } else if (path?.length) {
            if (path !== prevActive) {
                prevActive = path
                files = []
                fullFilteredFiles = []
                sendMain(Main.READ_FOLDER, { path, listFilesInFolders: true, disableThumbnails: $mediaOptions.mode === "list" })
            }
        } else {
            // screens && cameras
            prevActive = active
        }
    }

    let filesInFolders: File[] = []
    let folderFiles: { [key: string]: string[] } = {}

    let listenerId = receiveMain(Main.READ_FOLDER, (data) => {
        filesInFolders = sortFilenames(data.filesInFolders || [])

        if (active !== "all" && data.path !== path) return

        files.push(...(data.files.filter((file) => file.folder || isMediaExtension(file.extension)) as any))
        files = sortFilenames(files).sort((a, b) => (a.folder === b.folder ? 0 : a.folder ? -1 : 1))

        files = files.map((a) => ({ ...a, path: a.folder ? a.path : a.path }))

        // set valid files in folder
        folderFiles = {}
        Object.keys(data.folderFiles).forEach((path) => {
            folderFiles[path] = data.folderFiles[path].filter((file) => file.folder || isMediaExtension(file.extension))
        })

        filterFiles()
    })
    onDestroy(() => destroyMain(listenerId))

    let scrollElem: HTMLElement | undefined

    // arrow selector
    let activeFile: null | number = null
    let allFiles: string[] = []
    let content = allFiles.length

    $: showUpdate($activeShow)
    function showUpdate(a) {
        if (a?.type !== "video" && a?.type !== "image") activeFile = null
    }

    // filter files
    let activeView = "all" // keyof typeof nextActiveView
    let filteredFiles: File[] = []
    $: if (activeView || $activeMediaTagFilter) filterFiles()
    $: if (searchValue !== undefined) filterSearch()

    function filterFiles() {
        if (active === "online" || active === "screens" || active === "cameras" || isProviderSection) return

        // filter files
        if (activeView === "all") filteredFiles = files.filter((a) => active !== "all" || !a.folder)
        else filteredFiles = files.filter((a) => (activeView === "folder" && active !== "all" && a.folder) || (!a.folder && activeView === getMediaType(a.extension)))

        // filter by tag
        if ($activeMediaTagFilter.length) {
            filteredFiles = filteredFiles.filter((a) => !a.folder && $media[a.path]?.tags?.length && !$activeMediaTagFilter.find((tagId) => !$media[a.path].tags!.includes(tagId)))
        }

        // remove folders with no content
        filteredFiles = filteredFiles.filter((a) => !a.folder || !folderFiles[a.path] || folderFiles[a.path].length > 0)

        // reset arrow selector
        loadAllFiles(filteredFiles)

        filterSearch()

        // scroll to top
        scrollElem?.scrollTo(0, 0)
    }

    function loadAllFiles(f: File[]) {
        allFiles = [...f.filter((a) => !a.folder).map((a) => a.path)]
        if ($activeShow !== null && allFiles.includes($activeShow.id)) activeFile = allFiles.findIndex((a) => a === $activeShow!.id)
        else activeFile = null
        content = allFiles.length
    }

    // search
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
    let fullFilteredFiles: File[] = []
    function filterSearch() {
        fullFilteredFiles = clone(filteredFiles)
        if (searchValue.length > 1) fullFilteredFiles = [...fullFilteredFiles, ...filesInFolders].filter((a) => filter(a.name).includes(filter(searchValue)))

        // scroll to top
        document.querySelector("svelte-virtual-list-viewport")?.scrollTo(0, 0)
    }

    let sortedFiles: File[] = []
    $: if (fullFilteredFiles && $sorted) sortFiles()
    function sortFiles() {
        let type = $sorted.media?.type || "name"

        let files = clone(fullFilteredFiles)

        if (searchValue.length > 1 || type === "name") files = files
        else if (type === "name_des") files = files.reverse()
        else if (type === "created") files = files.sort((a, b) => b.stat?.birthtimeMs - a.stat?.birthtimeMs)
        else if (type === "modified") files = files.sort((a, b) => b.stat?.mtimeMs - a.stat?.mtimeMs)

        sortedFiles = files.sort((a, b) => (a.folder === b.folder ? 0 : a.folder ? -1 : 1))
    }

    const shortcuts = {
        ArrowRight: () => {
            if ($activeEdit.items.length) return
            if (activeFile === null || activeFile < content - 1) activeFile = activeFile === null ? 0 : activeFile + 1
        },
        ArrowLeft: () => {
            if ($activeEdit.items.length) return
            if (activeFile === null || activeFile > 0) activeFile = activeFile === null ? content - 1 : activeFile - 1
        },
        Backspace: () => {
            if (rootPath === path) return
            goBack()
        }
    }

    $: if (activeFile !== null) selectMedia()
    function selectMedia() {
        if (activeFile === null) return

        let path = allFiles[activeFile] || ""
        if (!path) return

        activeEdit.set({ id: path, type: "media", items: [] })
        let name = removeExtension(getFileName(path))
        let type = getMediaType(getExtension(path))

        if ($focusMode) activeFocus.set({ id: path, type })
        else activeShow.set({ id: path, name, type })
    }

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter" && searchValue.length > 1 && e.target?.closest(".search")) {
            if (fullFilteredFiles.length) {
                let file = fullFilteredFiles[0]

                if ($focusMode) activeFocus.set({ id: file.path, type: getMediaType(file.extension) })
                else activeShow.set({ id: file.path, name: file.name, type: getMediaType(file.extension) })

                activeFile = filteredFiles.findIndex((a) => a.path === file.path)
                if (activeFile < 0) activeFile = null
            }
        }

        if (e.target?.closest("input") || e.target?.closest(".edit") || !allFiles.length) return

        if ((e.ctrlKey || e.metaKey) && shortcuts[e.key]) {
            // e.preventDefault()
            shortcuts[e.key]()
        }
    }

    function mousepress(e: MouseEvent) {
        if (e.button === 3) goBack()
        else if (e.button === 4) goForward()
    }

    let lastPaths: string[] = []
    function goForward() {
        if (lastPaths.length) {
            path = lastPaths.pop() || rootPath
            lastPaths = lastPaths.filter((a) => a.includes(path))
        }
    }

    function goBack(e?: ClickEvent) {
        if (e?.detail.ctrl) {
            lastPaths.push(path)
            path = rootPath
            return
        }

        const lastSlash = path.lastIndexOf("\\") > -1 ? path.lastIndexOf("\\") : path.lastIndexOf("/")
        const folder = path.slice(0, lastSlash)

        lastPaths.push(path)

        path = folder.length > rootPath.length ? folder || rootPath : rootPath
    }

    const slidesViews: any = { grid: "list", list: "grid" }
    const nextActiveView = { all: "image", folder: "image", image: "video", video: "all" } // all: "folder"
    $: if (notFolders.includes(active || "") && activeView === "folder") activeView = "image"

    $: currentOutput = $outputs[getActiveOutputs()[0]] || {}

    // select all
    $: if ($selectAllMedia) selectAll()
    function selectAll() {
        let data = sortedFiles
            .filter((a) => a.extension)
            .map((file) => {
                let type = getMediaType(file.extension)
                return { name: file.name, path: file.path, type }
            })

        selected.set({ id: "media", data })
        selectAllMedia.set(false)
    }

    $: pathString = path.replace(rootPath, "").replace(folderName, "").replaceAll("\\", "/").split("/").filter(Boolean).join("/")
</script>

<!-- TODO: download pixabay images!!! -->
<!-- TODO: pexels images ? -->

<svelte:window on:keydown={keydown} on:mouseup={mousepress} />

<!-- TABS -->

{#if active === "screens"}
    <div class="tabs">
        <MaterialButton style="flex: 1;" isActive={screenTab === "screens"} on:click={() => setSubSubTab("screens")}>
            <Icon size={1.2} id="screen" white />
            <p><T id="live.screens" /></p>
        </MaterialButton>
        <MaterialButton style="flex: 1;" isActive={screenTab === "windows"} on:click={() => setSubSubTab("windows")}>
            <Icon size={1.2} id="window" white />
            <p><T id="live.windows" /></p>
        </MaterialButton>
        <MaterialButton style="flex: 1;" isActive={screenTab === "ndi"} on:click={() => setSubSubTab("ndi")}>
            <Icon size={1.1} id="ndi" white />
            <p>NDI</p>
        </MaterialButton>
        <!-- BLACKMAGIC CURRENTLY NOT WORKING -->
        <!-- <MaterialButton style="flex: 1;" isActive={screenTab === "blackmagic"} on:click={() => setSubSubTab("blackmagic")}>
            <Icon size={1.2} id="blackmagic" white />
            <p>Blackmagic</p>
        </MaterialButton> -->
    </div>
{:else if active === "online"}
    <div class="tabs">
        <MaterialButton style="flex: 1;" isActive={onlineTab === "youtube"} on:click={() => setSubSubTab("youtube")}>
            <Icon style={onlineTab === "youtube" ? "fill: #ff0000" : ""} size={1.2} id="youtube" white />
            <p>YouTube</p>
        </MaterialButton>
        <MaterialButton style="flex: 1;" isActive={onlineTab === "vimeo"} on:click={() => setSubSubTab("vimeo")}>
            <Icon style={onlineTab === "vimeo" ? "fill: #17d5ff" : ""} size={1.2} id="vimeo" white />
            <p>Vimeo</p>
        </MaterialButton>
        <MaterialButton style="flex: 1;" isActive={onlineTab === "pixabay"} on:click={() => setSubSubTab("pixabay")}>
            <Icon style={onlineTab === "pixabay" ? "fill: #00ab6b" : ""} size={1.2} id="pixabay" box={48} white />
            <p>Pixabay</p>
        </MaterialButton>
        <MaterialButton style="flex: 1;" isActive={onlineTab === "unsplash"} on:click={() => setSubSubTab("unsplash")}>
            <!-- #111111 -->
            <Icon style={onlineTab === "unsplash" ? "fill: #bbbbbb" : ""} size={1.2} id="unsplash" white />
            <p>Unsplash</p>
        </MaterialButton>
    </div>
{/if}

<!-- MAIN -->

<div class="scroll" style="flex: 1;overflow-y: auto;" bind:this={scrollElem}>
    <div class="grid" class:list={$mediaOptions.mode === "list"} style="height: 100%;">
        {#if isProviderSection}
            <ContentLibraryBrowser providerId={active} columns={$mediaOptions.columns} />
        {:else if active === "online" && (onlineTab === "youtube" || onlineTab === "vimeo")}
            <div class="gridgap">
                <PlayerVideos active={onlineTab} {searchValue} />
            </div>
        {:else if active === "screens"}
            <div class="gridgap">
                {#if screenTab === "screens"}
                    <Screens bind:streams />
                {:else if screenTab === "ndi"}
                    <NDIStreams />
                {:else if screenTab === "blackmagic"}
                    <BMDStreams />
                {:else}
                    <Windows bind:streams {searchValue} />
                {/if}
            </div>
        {:else if active === "cameras"}
            <div class="gridgap">
                <Cameras
                    on:click={({ detail }) => {
                        let e = detail.event
                        let cam = detail.cam

                        if ($outLocked || e.ctrlKey || e.metaKey) return
                        if (currentOutput.out?.background?.id === cam.id) clearBackground()
                        else setOutput("background", { name: cam.name, id: cam.id, cameraGroup: cam.cameraGroup, type: "camera" })
                    }}
                />
            </div>
        {:else if sortedFiles.length}
            <div class="context #media" style="display: contents;">
                {#key sortedFiles}
                    {#if $mediaOptions.mode === "grid"}
                        <MediaGrid items={sortedFiles} columns={$mediaOptions.columns} let:item>
                            {#if item.folder}
                                <Folder name={item.name} path={item.path} mode={$mediaOptions.mode} folderPreview={sortedFiles.length < 20} on:open={(e) => (path = e.detail)} />
                            {:else}
                                <Media
                                    credits={item.credits || {}}
                                    name={item.name || ""}
                                    path={item.path}
                                    thumbnailPath={item.previewUrl || ($mediaOptions.columns < 3 ? "" : item.thumbnailPath)}
                                    type={getMediaType(item.extension)}
                                    shiftRange={sortedFiles.map((a) => ({ ...a, type: getMediaType(a.extension), name: removeExtension(a.name) }))}
                                    bind:activeFile
                                    {allFiles}
                                    {active}
                                />
                            {/if}
                        </MediaGrid>
                    {:else}
                        <VirtualList items={sortedFiles} let:item={file}>
                            {#if file.folder}
                                <Folder name={file.name} path={file.path} mode={$mediaOptions.mode} on:open={(e) => (path = e.detail)} />
                            {:else}
                                <Media
                                    credits={file.credits || {}}
                                    thumbnail={$mediaOptions.mode !== "list"}
                                    name={file.name || ""}
                                    path={file.path}
                                    type={getMediaType(file.extension)}
                                    shiftRange={sortedFiles.map((a) => ({ ...a, type: getMediaType(a.extension), name: removeExtension(a.name) }))}
                                    bind:activeFile
                                    {allFiles}
                                    {active}
                                />
                            {/if}
                        </VirtualList>
                    {/if}
                {/key}
            </div>
        {:else}
            <div class={specialTabs.includes(active || "") ? "" : "context #media"} style="display: contents;">
                <Center style="opacity: 0.2;">
                    <Icon id="noImage" size={5} white />
                </Center>
            </div>
        {/if}
    </div>
</div>

<!-- NAV -->

{#if isProviderSection}
    <FloatingInputs onlyOne>
        <MaterialZoom columns={$mediaOptions.columns} defaultValue={5} on:change={(e) => mediaOptions.set({ ...$mediaOptions, columns: e.detail })} />
    </FloatingInputs>
{:else if active === "online"}
    {#if onlineTab === "youtube" || onlineTab === "vimeo"}
        <FloatingInputs onlyOne>
            <MaterialButton
                title="groups.toggle_global_group"
                on:click={() => {
                    popupData.set({ active: onlineTab })
                    activePopup.set("player")
                }}
            >
                <Icon id="add" />
                {#if !$labelsDisabled}<T id="settings.add" />{/if}
            </MaterialButton>
        </FloatingInputs>
    {:else}
        <FloatingInputs>
            {#if onlineTab === "pixabay"}
                <MaterialButton title="media.image" on:click={() => (activeView = "image")}>
                    <Icon size={1.2} id="image" white={activeView !== "image"} />
                </MaterialButton>
                <MaterialButton title="media.video" on:click={() => (activeView = "video")}>
                    <Icon size={1.2} id="video" white={activeView !== "video"} />
                </MaterialButton>

                <div class="divider"></div>
            {/if}

            <MaterialButton
                on:click={() =>
                    mediaOptions.update((a) => {
                        a.mode = slidesViews[$mediaOptions.mode]
                        return a
                    })}
                title="show.{$mediaOptions.mode}"
            >
                <Icon size={1.3} id={$mediaOptions.mode} white />
            </MaterialButton>
        </FloatingInputs>
    {/if}

    <MaterialZoom hidden columns={$mediaOptions.columns} defaultValue={5} on:change={(e) => mediaOptions.set({ ...$mediaOptions, columns: e.detail })} />
{:else if active === "screens" || active === "cameras"}
    <!-- nothing -->

    <MaterialZoom hidden columns={$mediaOptions.columns} defaultValue={5} on:change={(e) => mediaOptions.set({ ...$mediaOptions, columns: e.detail })} />
{:else}
    {#if active !== "all" && active !== "favourites" && rootPath !== path}
        <FloatingInputs side="left">
            <MaterialButton disabled={rootPath === path} title="actions.back" on:click={goBack}>
                <Icon id="back" white />
            </MaterialButton>

            <div class="divider"></div>

            <p style="opacity: 0.8;display: flex;align-items: center;padding: 0 15px;">
                <span style="opacity: 0.3;font-size: 0.9em;max-width: 500px;overflow: hidden;direction: rtl;">{pathString ? "/" : ""}{pathString}</span>
                {folderName}

                {#if content && rootPath !== path}
                    <span style="opacity: 0.5;font-size: 0.9em;margin-inline-start: 10px;">{content}</span>
                {/if}
            </p>
        </FloatingInputs>
    {/if}

    <FloatingInputs arrow let:open>
        {#if open}
            <MaterialButton title="media.all" on:click={() => (activeView = "all")}>
                <Icon size={1.2} id="media" white={activeView !== "all"} />
            </MaterialButton>
            <MaterialButton title="media.image" on:click={() => (activeView = "image")}>
                <Icon size={1.2} id="image" white={activeView !== "image"} />
            </MaterialButton>
            <MaterialButton title="media.video" on:click={() => (activeView = "video")}>
                <Icon size={1.2} id="video" white={activeView !== "video"} />
            </MaterialButton>

            <div class="divider"></div>
        {:else}
            <MaterialButton title="media.{activeView}" on:click={() => (activeView = nextActiveView[activeView])}>
                <Icon size={1.2} id={activeView === "all" ? "media" : activeView} white={activeView === "all"} />
            </MaterialButton>
        {/if}

        <MaterialZoom hidden={!open} columns={$mediaOptions.columns} defaultValue={5} on:change={(e) => mediaOptions.set({ ...$mediaOptions, columns: e.detail })} />

        <MaterialButton
            on:click={() =>
                mediaOptions.update((a) => {
                    a.mode = slidesViews[$mediaOptions.mode]
                    return a
                })}
            title="show.{$mediaOptions.mode}"
        >
            <Icon size={1.3} id={$mediaOptions.mode} white />
        </MaterialButton>
    </FloatingInputs>
{/if}

<style>
    .tabs {
        display: flex;
        position: relative;
        background-color: var(--primary-darkest);
        align-items: center;
    }

    .tabs :global(button) {
        border-radius: 0;
        border: none !important;
        border-bottom: 1px solid var(--primary-lighter) !important;
        padding: 8px;
    }
    .tabs :global(button.isActive) {
        border-bottom: 1px solid var(--secondary) !important;
    }

    .grid {
        display: flex;
        flex-wrap: wrap;
        flex: 1;
        place-content: flex-start;
    }

    .grid :global(.selectElem) {
        outline-offset: -3px;
    }
    .grid :global(.isSelected) {
        border-radius: 0 !important;
    }
    /* .grid :global(#media.isSelected .main) {
        z-index: -1;
    } */

    .grid :global(svelte-virtual-list-viewport) {
        width: 100%;
        padding: 5px;
    }

    .gridgap {
        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
        padding: 5px;

        width: 100%;
        height: 100%;

        overflow-y: auto;
        overflow-x: hidden;

        padding-bottom: 60px;
    }
</style>
