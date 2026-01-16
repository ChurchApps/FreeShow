<script lang="ts">
    import { uid } from "uid"
    import type { ContentProviderId } from "../../../../electron/contentProviders/base/types"
    import { Main } from "../../../../types/IPC/Main"
    import type { ClickEvent, FileFolder } from "../../../../types/Main"
    import { requestMain } from "../../../IPC/main"
    import { activeDrawerTab, activeEdit, activeFocus, activeMediaTagFilter, activePopup, activeShow, audioFolders, drawerTabsData, focusMode, labelsDisabled, media, mediaFolders, mediaOptions, outLocked, outputs, popupData, providerConnections, selectAllMedia, selected, sorted, special } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, keysToID, sortFilenames } from "../../helpers/array"
    import { splitPath } from "../../helpers/get"
    import { countFolderMediaItems, getExtension, getFileName, getMediaType, isMediaExtension, removeExtension } from "../../helpers/media"
    import { getFirstActiveOutput, setOutput } from "../../helpers/output"
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

    // type File = { path: string; favourite: boolean; name: string; extension: string; audio: boolean; folder?: boolean; stat?: any }
    // let files: File[] = []

    let specialTabs = ["online", "screens", "cameras"]
    $: isProviderSection = contentProviders.some((p) => p.providerId === active)
    $: notFolders = ["all", ...specialTabs, ...contentProviders.map((p) => p.providerId)]
    $: rootPath = notFolders.includes(active || "") ? "" : active !== null ? $mediaFolders[active]?.path || "" : ""
    $: path = notFolders.includes(active || "") ? "" : rootPath

    $: folderName = active === "all" ? "category.all" : active === "favourites" ? "category.favourites" : rootPath === path ? (active !== null ? $mediaFolders[active]?.name || "" : "") : splitPath(path).name

    async function loadFilesAsync() {
        if ((onlineTab !== "pixabay" && onlineTab !== "unsplash") || activeView === "folder") return

        let onlineFiles: any[] = []
        if (onlineTab === "pixabay") {
            onlineFiles = await loadFromPixabay(searchValue || "landscape", activeView === "video")
        } else if (onlineTab === "unsplash") {
            onlineFiles = await loadFromUnsplash(searchValue || "landscape")
        }

        hightlightActive()

        filteredFiles = clone(onlineFiles)
        if (searchValue.length < 2) searchedFiles = clone(filteredFiles)
        else filterSearch()
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

    $: if ($providerConnections) {
        requestMain(Main.GET_CONTENT_PROVIDERS).then((allProviders) => {
            contentProviders = allProviders.filter((p) => p.hasContentLibrary && $providerConnections[p.providerId])
        })
    }

    let screenTab = $drawerTabsData.media?.openedSubSubTab?.screens || "screens"
    let onlineTab = $drawerTabsData.media?.openedSubSubTab?.online || "youtube"
    $: if (active === "online" && onlineTab === "pixabay" && (searchValue !== null || activeView)) loadFilesAsync()
    $: if (active === "online" && onlineTab === "unsplash" && (searchValue !== null || activeView)) loadFilesAsync()

    let prevActive: null | string = null
    let prevTab = ""
    $: if (active || path) updateContent()
    async function updateContent() {
        if (prevActive === "online" && active !== "online") activeView = "all"
        if (active !== "online") prevTab = ""

        if (active === "online") {
            if (onlineTab !== prevTab) activeView = "image"
            prevTab = onlineTab

            prevActive = active
        } else if (active === "favourites") {
            prevActive = active

            allRelevantFiles = keysToID($media)
                .filter((a) => a.favourite === true && a.audio !== true)
                .map((a) => {
                    return { isFolder: false, path: a.id, name: getFileName(a.id), stats: {} as any }
                })

            openFolder("favourites")
        } else if (active === "all") {
            if (active === prevActive) return
            prevActive = active

            requestFiles(Object.values($mediaFolders).map((a) => a.path!))
        } else if (path?.length) {
            if (path === prevActive) return
            prevActive = path

            requestFiles(path, 0, true)
        } else {
            // screens && cameras
            prevActive = active
        }
    }

    let hasAudio = { count: 0, exists: false }
    function openAudioFolder() {
        const tabId = keysToID($audioFolders).find((a) => a.path === path)?.id
        if (!tabId) return

        drawerTabsData.update((a) => {
            if (!a.audio) a.audio = { enabled: true, activeSubTab: tabId }
            else a.audio.activeSubTab = tabId
            return a
        })
        activeDrawerTab.set("audio")
    }
    function createAudioFolder() {
        audioFolders.update((a) => {
            a[uid()] = { name: getFileName(path), icon: "folder", path }
            return a
        })

        openAudioFolder()
    }

    let foldersList: FileFolder[] = []
    let filesList: FileFolder[] = []
    let allRelevantFiles: FileFolder[] = []

    let requesting = 0
    let currentDepth = 0
    async function requestFiles(path: string | string[], depth: number = 0, captureFolderContent: boolean = false) {
        if (!path) return

        currentDepth = depth

        if ($special.optimizedMode || $mediaOptions.mode !== "grid") {
            // depth = 0
            captureFolderContent = false
        }

        // WIP generateThumbnails - might be better to generate dynamically, instead of full folder at once
        // WIP only list folders with any recursive media content?

        requesting++
        let currentRequest = requesting
        const data = await requestMain(Main.READ_FOLDER, { path, depth, generateThumbnails: $mediaOptions.mode === "grid", captureFolderContent })
        if (requesting !== currentRequest) return

        // check if there's any audio files that the user might want to find
        if (!Array.isArray(path)) {
            const count = countFolderMediaItems(path, Object.values(data))
            const audioFolderExists = !!Object.values($audioFolders).find((a) => a.path === path)
            // only show if existing or more than half are audio files
            if (count.audio && (audioFolderExists || count.audio * 2 > count.video + count.image)) {
                hasAudio = { count: count.audio, exists: audioFolderExists }
            } else {
                hasAudio = { count: 0, exists: false }
            }
        }

        allRelevantFiles = Object.values(data).filter((a) => {
            // remove folders with no content
            if (a.isFolder) return a.files.length > 0
            // only image/video files
            return isMediaExtension(getExtension(a.name))
        })

        if ($special.cloudSyncMediaFolder) {
            const mediaFolderPath = await requestMain(Main.GET_MEDIA_FOLDER_PATH)
            if (path === mediaFolderPath) {
                allRelevantFiles.map((a) => {
                    // remove folderId suffix
                    if (a.name.includes("_")) a.name = a.name.slice(0, a.name.lastIndexOf("_"))
                    return a
                })
            }
        }

        openFolder(active === "all" ? "all" : (path as string))
    }

    function openFolder(path: string) {
        if (path === "all" || path === "favourites") {
            foldersList = []
            filesList = allRelevantFiles.filter((a) => !a.isFolder)

            filterFiles()
            return
        }

        if (searchValue.length > 1) {
            foldersList = allRelevantFiles.filter((a) => a.isFolder)
            filesList = allRelevantFiles.filter((a) => !a.isFolder)

            filterFiles()
            return
        }

        const folder = allRelevantFiles.find((a) => a.isFolder && a.path === path)
        if (!folder) return

        foldersList = allRelevantFiles.filter((a) => a.isFolder && (folder as any).files.includes(a.path))
        filesList = allRelevantFiles.filter((a) => !a.isFolder && (folder as any).files.includes(a.path))

        filterFiles()
    }

    let scrollElem: HTMLElement | undefined

    // arrow selector
    let activeFile: null | number = null
    $: mediaFilesOnly = searchedFiles.filter((a) => !a.isFolder)
    function hightlightActive() {
        const activeShowPath = $activeShow?.type === "image" || $activeShow?.type === "video" ? $activeShow?.id : ""
        const index = mediaFilesOnly.findIndex((a) => a.path === activeShowPath)
        activeFile = index < 0 ? null : index
    }

    $: showUpdate($activeShow)
    function showUpdate(a) {
        if (a?.type !== "video" && a?.type !== "image") activeFile = null
    }

    // filter files
    let activeView = "all" // keyof typeof nextActiveView
    $: if (activeView || $activeMediaTagFilter || $sorted) filterFiles()
    $: if (searchValue !== undefined) filterSearch()

    let filteredFiles: FileFolder[] = []
    function filterFiles() {
        if (active === "online" || active === "screens" || active === "cameras" || isProviderSection) return

        let localFilteredFiles: FileFolder[] = []

        // filter by tag
        if ($activeMediaTagFilter.length) {
            localFilteredFiles = clone(filesList).filter((a) => $media[a.path]?.tags?.length && !$activeMediaTagFilter.find((tagId) => !$media[a.path].tags!.includes(tagId)))
        }
        // filter by type
        else if (activeView === "all") localFilteredFiles = clone(filesList)
        else if (activeView === "folder") localFilteredFiles = clone(foldersList)
        else localFilteredFiles = clone(filesList).filter((a) => activeView === getMediaType(getExtension(a.name)))

        // reset arrow selector
        hightlightActive()

        // sort
        let sortType = $sorted.media?.type || "name"
        if (sortType === "name") localFilteredFiles = sortFilenames(localFilteredFiles)
        else if (sortType === "name_des") localFilteredFiles = localFilteredFiles.reverse()
        else if (sortType === "created") localFilteredFiles = localFilteredFiles.sort((a, b) => (a.isFolder || b.isFolder ? 1 : b.stats.birthtimeMs - a.stats.birthtimeMs))
        else if (sortType === "modified") localFilteredFiles = localFilteredFiles.sort((a, b) => (a.isFolder || b.isFolder ? 1 : b.stats.mtimeMs - a.stats.mtimeMs))

        // append folders
        if (activeView === "all") {
            localFilteredFiles = [...sortFilenames(foldersList), ...localFilteredFiles]
        }

        filteredFiles = clone(localFilteredFiles)
        if (searchValue.length < 2) searchedFiles = clone(filteredFiles)
        else filterSearch()

        // scroll to top
        scrollElem?.scrollTo(0, 0)
    }

    // search
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
    let searchFilterActive = false
    let searchedFiles: FileFolder[] = []
    async function filterSearch() {
        if (searchFilterActive) return
        searchFilterActive = true

        if (searchValue.length === 1) {
            searchFilterActive = false
            return
        }
        if (searchValue.length < 2) {
            if (active !== "all" && active !== "favourites") requestFiles(path, 0, true)
            else searchedFiles = clone(filteredFiles)
            searchFilterActive = false
            return
        }

        if (active !== "all" && active !== "favourites" && currentDepth < 5) {
            await requestFiles(path, 5)
        }

        searchedFiles = clone(filteredFiles).filter((a) => filter(a.name).includes(filter(searchValue)))

        // scroll to top
        document.querySelector("svelte-virtual-list-viewport")?.scrollTo(0, 0)

        searchFilterActive = false
    }

    $: fileCount = mediaFilesOnly.length
    const shortcuts = {
        ArrowRight: () => {
            if (activeFile === null || activeFile < fileCount - 1) activeFile = activeFile === null ? 0 : activeFile + 1
        },
        ArrowLeft: () => {
            if (activeFile === null || activeFile > 0) activeFile = activeFile === null ? fileCount - 1 : activeFile - 1
        },
        Backspace: () => {
            if (rootPath === path) return
            goBack()
        },
        // macOS workaround as it mostly ignores the M4/M5 mouse buttons
        // special programs can be used to map these buttons to the following keyboard keys
        "[": () => goBack(),
        "]": () => goForward()
    }

    $: if (activeFile !== null) selectMedia()
    function selectMedia() {
        if (activeFile === null) return

        let path = mediaFilesOnly[activeFile]?.path || ""
        if (!path) return

        activeEdit.set({ id: path, type: "media", items: [] })
        let name = removeExtension(getFileName(path))
        let type = getMediaType(getExtension(path))

        if ($focusMode) activeFocus.set({ id: path, type })
        else activeShow.set({ id: path, name, type })
    }

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter" && searchValue.length > 1 && e.target?.closest(".search")) {
            if (fileCount) {
                let file = mediaFilesOnly[0]

                if ($focusMode) activeFocus.set({ id: file.path, type: getMediaType(getExtension(file.name)) })
                else activeShow.set({ id: file.path, name: file.name, type: getMediaType(getExtension(file.name)) })

                activeFile = searchedFiles.findIndex((a) => a.path === file.path)
                if (activeFile < 0) activeFile = null
            }
        }

        if (e.target?.closest("input") || e.target?.closest(".edit") || $activeEdit.items.length || !fileCount) return

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

    $: currentOutput = getFirstActiveOutput($outputs)

    // select all
    $: if ($selectAllMedia) selectAll()
    function selectAll() {
        let data = searchedFiles
            .filter((a) => !a.isFolder)
            .map((file) => {
                let type = getMediaType(getExtension(file.name))
                return { name: file.name, path: file.path, type, contentProvider: false }
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
            <ContentLibraryBrowser providerId={active} columns={$mediaOptions.columns} {searchValue} />
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
                        if (currentOutput?.out?.background?.id === cam.id) clearBackground()
                        else setOutput("background", { name: cam.name, id: cam.id, cameraGroup: cam.cameraGroup, type: "camera" })
                    }}
                />
            </div>
        {:else if searchedFiles.length}
            <div class="context #media" style="display: contents;">
                {#key searchedFiles}
                    {#if $mediaOptions.mode === "grid"}
                        <MediaGrid items={searchedFiles} columns={$mediaOptions.columns} let:item>
                            {#if item.isFolder}
                                <Folder
                                    name={item.name}
                                    path={item.path}
                                    mode={$mediaOptions.mode}
                                    previewPaths={item.files
                                        .map((path) => allRelevantFiles.find((a) => a.path === path)?.thumbnailPath)
                                        .filter(Boolean)
                                        .slice(0, 4)}
                                    folderFilesCount={countFolderMediaItems(item.path, allRelevantFiles)}
                                    on:open={(e) => (path = e.detail)}
                                />
                            {:else}
                                <Media credits={item.credits || {}} name={item.name || ""} path={item.path} thumbnailPath={item.previewUrl || ($mediaOptions.columns < 3 ? "" : item.thumbnailPath)} type={getMediaType(item.extension || getExtension(item.name))} shiftRange={mediaFilesOnly.map((a) => ({ ...a, type: getMediaType(getExtension(a.name)), name: removeExtension(a.name) }))} {active} />
                            {/if}
                        </MediaGrid>
                    {:else}
                        <VirtualList items={searchedFiles} let:item={file}>
                            {#if file.isFolder}
                                <Folder name={file.name} path={file.path} mode={$mediaOptions.mode} on:open={(e) => (path = e.detail)} />
                            {:else}
                                <Media credits={file.credits || {}} thumbnail={$mediaOptions.mode !== "list"} name={file.name || ""} path={file.path} type={getMediaType(file.extension || getExtension(file.name))} shiftRange={mediaFilesOnly.map((a) => ({ ...a, type: getMediaType(getExtension(a.name)), name: removeExtension(a.name) }))} {active} />
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
    {#if active !== "all" && active !== "favourites"}
        {#if rootPath !== path}
            <FloatingInputs side="left">
                <MaterialButton disabled={rootPath === path} title="actions.back" on:click={goBack}>
                    <Icon id="back" white />
                </MaterialButton>

                <div class="divider"></div>

                <p style="opacity: 0.8;display: flex;align-items: center;padding: 0 15px;">
                    <span style="opacity: 0.3;font-size: 0.9em;max-width: 500px;overflow: hidden;direction: rtl;">{pathString ? "/" : ""}{pathString}</span>
                    {folderName}

                    {#if fileCount && rootPath !== path}
                        <span style="opacity: 0.5;font-size: 0.9em;margin-inline-start: 10px;">{fileCount}</span>
                    {/if}
                </p>
            </FloatingInputs>
        {:else if hasAudio.count}
            <FloatingInputs side="left" onlyOne>
                <MaterialButton icon="autofill" on:click={hasAudio.exists ? openAudioFolder : createAudioFolder}>
                    <p>
                        <T id="audio.{hasAudio.exists ? 'open_audio_folder' : 'create_audio_folder'}" />
                        <span style="opacity: 0.5;font-size: 0.8em;margin-left: 5px;">{hasAudio.count}</span>
                    </p>
                </MaterialButton>
            </FloatingInputs>
        {/if}
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
