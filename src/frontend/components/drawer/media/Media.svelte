<script lang="ts">
    import VirtualList from "@sveltejs/svelte-virtual-list"
    import { Grid } from "svelte-virtual"
    import { READ_FOLDER } from "../../../../types/Channels"
    import { activeEdit, activePage, activeShow, dictionary, media, mediaFolders, mediaOptions } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { splitPath } from "../../helpers/get"
    import { getExtension, getMediaType, isMediaExtension } from "../../helpers/media"
    import Button from "../../inputs/Button.svelte"
    import Center from "../../system/Center.svelte"
    import Folder from "./Folder.svelte"
    import Media from "./MediaCard.svelte"
    import { loadFromPixabay } from "./pixabay"

    export let active: string | null
    export let searchValue: string = ""

    let files: any[] = []

    let notFolders = ["all", "favourites", "pixabay"]
    $: console.log(active)
    $: rootPath = notFolders.includes(active || "") ? "" : active !== null ? $mediaFolders[active]?.path! || "" : ""
    $: path = notFolders.includes(active || "") ? "" : rootPath

    // TODO: fix name...!!
    $: console.log(active, ":", rootPath, ":", path, ":", name)
    $: name = active === "all" ? "category.all" : active === "favourites" ? "category.favourites" : active === "pixabay" ? "Pixabay" : rootPath === path ? (active !== null ? $mediaFolders[active]?.name || "" : "") : splitPath(path).name

    async function loadFilesAsync() {
        fullFilteredFiles = []
        if (activeView === "folder") return

        fullFilteredFiles = await loadFromPixabay(searchValue || "landscape", activeView === "video")
        loadAllFiles(fullFilteredFiles)
    }

    $: if (active === "pixabay" && (searchValue !== null || activeView)) loadFilesAsync()

    // get list of files & folders
    let prevActive: null | string = null
    $: {
        if (active === "pixabay") {
            prevActive = active
            loadFilesAsync()
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
            slowLoader = 50
            increaseLoading()
        } else if (active === "all") {
            if (active !== prevActive) {
                prevActive = active
                files = []
                Object.values($mediaFolders).forEach((data) => window.api.send(READ_FOLDER, data.path))
            }
        } else if (path.length) {
            if (path !== prevActive) {
                prevActive = path
                files = []
                window.api.send(READ_FOLDER, path)
            }
        }
    }

    // receive files
    window.api.receive(READ_FOLDER, (msg: any) => {
        if (active === "all" || msg.path === path) {
            files.push(...msg.files.filter((file: any) => isMediaExtension(file.extension) || file.folder))
            files.sort((a: any, b: any) => a.name.localeCompare(b.name)).sort((a: any, b: any) => (a.folder === b.folder ? 0 : a.folder ? -1 : 1))

            filterFiles()

            slowLoader = 50
            increaseLoading()
        }
    })

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
        if (active === "pixabay") return

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
        fullFilteredFiles = JSON.parse(JSON.stringify(filteredFiles))
        if (searchValue.length > 1) fullFilteredFiles = fullFilteredFiles.filter((a) => filter(a.name).includes(searchValue))
    }

    function wheel(e: any) {
        if (e.ctrlKey || e.metaKey) mediaOptions.set({ ...$mediaOptions, columns: Math.max(2, Math.min(10, $mediaOptions.columns + (e.deltaY < 0 ? -100 : 100) / 100)) })
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
        if ($activePage === "edit" && $activeShow && ($activeShow.type === undefined || $activeShow.type === "show")) {
            activeEdit.set({ id: path, type: "media", items: [] })
        } else {
            activeEdit.set({ items: [] })
            let type = getMediaType(getExtension(path))
            activeShow.set({ id: path, name, type })
        }
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

        if (e.ctrlKey && shortcuts[e.key]) {
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

    // TODO: temporary loading preformance test
    let slowLoader: number = 50 // 10
    let timeout: any = null
    function increaseLoading() {
        if (timeout) clearTimeout(timeout)
        if (slowLoader < filteredFiles.length) {
            setTimeout(() => {
                // slowLoader += 1
                slowLoader += 50
                console.log(slowLoader + "/" + filteredFiles.length)
                increaseLoading()
            }, 200)
        }
    }

    let gridHeight
    let gridWidth
</script>

<!-- TODO: download pixabay images!!! -->
<!-- TODO: pexels images ? -->

<svelte:window on:keydown={keydown} />

<!-- TODO: fix: big images & many files -->
<!-- TODO: autoscroll -->
<!-- TODO: ctrl+arrow keys change drawer item... -->
<div class="scroll" style="flex: 1;overflow-y: auto;" bind:this={scrollElem} on:wheel={wheel}>
    <div class="grid" class:list={$mediaOptions.mode === "list"} style="height: 100%;" bind:clientHeight={gridHeight} bind:clientWidth={gridWidth}>
        {#if fullFilteredFiles.length}
            {#key rootPath}
                {#key path}
                    {#if $mediaOptions.mode === "grid"}
                        <Grid
                            itemCount={fullFilteredFiles.length}
                            itemHeight={gridWidth / $mediaOptions.columns / 1.777 + 25}
                            itemWidth={gridWidth / $mediaOptions.columns - ($mediaOptions.columns > 8 || $mediaOptions.columns < 4 ? 12 - $mediaOptions.columns : 3)}
                            height={gridHeight - 1}
                        >
                            <div slot="item" let:index let:style {style}>
                                {#if fullFilteredFiles[index].folder}
                                    <Folder bind:rootPath={path} name={fullFilteredFiles[index].name} path={fullFilteredFiles[index].path} mode={$mediaOptions.mode} />
                                {:else}
                                    <Media name={fullFilteredFiles[index].name} path={fullFilteredFiles[index].path} type={getMediaType(fullFilteredFiles[index].extension)} bind:activeFile {allFiles} {active} />
                                {/if}
                            </div>
                        </Grid>
                    {:else}
                        <VirtualList items={fullFilteredFiles} let:item={file}>
                            {#if file.folder}
                                <Folder bind:rootPath={path} name={file.name} path={file.path} mode={$mediaOptions.mode} />
                            {:else}
                                <Media name={file.name} path={file.path} type={getMediaType(file.extension)} bind:activeFile {allFiles} {active} />
                            {/if}
                        </VirtualList>
                    {/if}
                {/key}
            {/key}
        {:else}
            <Center>
                <Icon id="noImage" size={5} white />
            </Center>
        {/if}
    </div>
</div>

<div class="tabs" style="display: flex;align-items: center;">
    <Button disabled={rootPath === path} title={$dictionary.actions?.back} on:click={goBack}>
        <Icon size={1.3} id="back" />
    </Button>
    <Button disabled={rootPath === path} title={$dictionary.actions?.home} on:click={() => (path = rootPath)}>
        <Icon size={1.3} id="home" />
    </Button>
    <span style="flex: 1;text-align: center;">
        {#key name}
            {#if name.includes(".")}
                <T id={name} />
            {:else}
                {name}
            {/if}
        {/key}
    </span>
    <Button disabled={!allFiles.length || activeFile === 0} on:click={() => (activeFile = activeFile === null ? content - 1 : activeFile - 1)}>
        <Icon size={1.3} id="previous" />
    </Button>
    {activeFile === null ? "" : activeFile + 1 + "/"}{content}
    <Button disabled={!allFiles.length || activeFile === content - 1} on:click={() => (activeFile = activeFile === null ? 0 : activeFile + 1)}>
        <Icon size={1.3} id="next" />
    </Button>
    <div class="seperator" />
    <Button title={$dictionary.media?.[activeView]} on:click={() => (activeView = nextActiveView[activeView])}>
        <Icon size={1.3} id={activeView} white={activeView === "all"} />
    </Button>
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
    <Button disabled={$mediaOptions.columns >= 10} on:click={() => mediaOptions.set({ ...$mediaOptions, columns: Math.min(10, $mediaOptions.columns + 1) })} title={$dictionary.actions?.zoomOut}>
        <Icon size={1.3} id="remove" white />
    </Button>
    <Button disabled={$mediaOptions.columns <= 2} on:click={() => mediaOptions.set({ ...$mediaOptions, columns: Math.max(2, $mediaOptions.columns - 1) })} title={$dictionary.actions?.zoomIn}>
        <Icon size={1.3} id="add" white />
    </Button>
    <p class="text">{(100 / $mediaOptions.columns).toFixed()}%</p>
</div>

<style>
    .tabs {
        display: flex;
        background-color: var(--primary-darkest);
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

    .grid :global(svelte-virtual-list-viewport) {
        width: 100%;
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
        text-align: right;
        width: 50px;
        margin-right: 10px;
    }

    .seperator {
        width: 3px;
        height: 100%;
        background-color: var(--primary-lighter);
    }
</style>
