<script lang="ts">
    import { uid } from "uid"
    import { Main } from "../../../../types/IPC/Main"
    import type { ClickEvent, FileFolder } from "../../../../types/Main"
    import { requestMain } from "../../../IPC/main"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { AudioPlaylist } from "../../../audio/audioPlaylist"
    import { activePlaylist, activePopup, activeRename, audioFolders, audioPlaylists, drawerTabsData, effectsLibrary, labelsDisabled, media, outLocked, selectAllAudio, selected } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, keysToID, sortFilenames } from "../../helpers/array"
    import { splitPath } from "../../helpers/get"
    import { getExtension, getFileName, getMediaType } from "../../helpers/media"
    import { joinTime, secondsToTime } from "../../helpers/time"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import Center from "../../system/Center.svelte"
    import DropArea from "../../system/DropArea.svelte"
    import AudioStreams from "../live/AudioStreams.svelte"
    import Microphones from "../live/Microphones.svelte"
    import Folder from "../media/Folder.svelte"
    import AudioEffect from "./AudioEffect.svelte"
    import AudioFile from "./AudioFile.svelte"
    import Metronome from "./Metronome.svelte"

    export let active: string | null
    export let searchValue = ""

    type File = { path: string; name: string; extension?: string; folder?: boolean; favourite?: boolean; audio?: boolean }

    // let files: File[] = []
    let scrollElem: HTMLElement | undefined

    let playlistSettings = false

    $: playlist = active && $audioPlaylists[active]

    $: isDefault = ["all", "favourites", "effects_library", "microphones", "audio_streams", "metronome"].includes(active || "")
    $: rootPath = isDefault || playlist ? "" : active !== null ? $audioFolders[active]?.path || "" : ""
    $: path = isDefault || playlist ? "" : rootPath
    $: name = active === "all" ? "category.all" : active === "favourites" ? "category.favourites" : active === "effects_library" ? "category.sound_effects" : rootPath === path ? (active !== "microphones" && active !== "audio_streams" && active !== "metronome" && active !== null ? $audioFolders[active]?.name || "" : "") : splitPath(path).name

    // get list of files & folders
    let prevActive: null | string = null
    $: if (active || path) updateContent()
    function updateContent() {
        if (active === "favourites") {
            prevActive = active

            allRelevantFiles = keysToID($media)
                .filter((a) => a.favourite === true && a.audio === true)
                .map((a) => {
                    return { isFolder: false, path: a.id, name: getFileName(a.id), stats: {} as any }
                })

            openFolder("favourites")
        } else if (active === "effects_library") {
            prevActive = active

            allRelevantFiles = keysToID($effectsLibrary).map((a) => {
                return { isFolder: false, path: a.id, name: getFileName(a.id), stats: {} as any }
            })

            openFolder("effects_library")
        } else if (active === "all") {
            if (active === prevActive) return
            prevActive = active

            requestFiles(Object.values($audioFolders).map((a) => a.path!))
        } else if (path.length) {
            if (path === prevActive) return
            prevActive = path

            requestFiles(path, 1)
        } else {
            // microphones & audio_streams & metronome
            prevActive = active
        }
    }

    let foldersList: FileFolder[] = []
    let filesList: FileFolder[] = []
    let allRelevantFiles: FileFolder[] = []

    let requesting = 0
    let currentDepth = 0
    async function requestFiles(path: string | string[], depth: number = 0) {
        if (!path) return

        currentDepth = depth

        requesting++
        let currentRequest = requesting
        const data = await requestMain(Main.READ_FOLDER, { path, depth })
        if (requesting !== currentRequest) return

        console.log(data)
        allRelevantFiles = Object.values(data).filter((a) => {
            // remove folders with no content
            if (a.isFolder) return a.files.length > 0
            // only audio files
            return getMediaType(getExtension(a.name)) === "audio"
        })

        openFolder(active === "all" ? "all" : (path as string))
    }

    function openFolder(path: string) {
        if (path === "all" || path === "favourites" || path === "effects_library") {
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

        console.log(allRelevantFiles)

        foldersList = allRelevantFiles.filter((a) => a.isFolder && (folder as any).files.includes(a.path))
        filesList = allRelevantFiles.filter((a) => !a.isFolder && (folder as any).files.includes(a.path))

        filterFiles()
    }

    // $: if ($sorted) filterFiles()
    $: if (searchValue !== undefined) filterSearch()

    let filteredFiles: FileFolder[] = []
    function filterFiles() {
        if (active === "microphones" || active === "audio_streams" || active === "metronome") return

        let localFilteredFiles: FileFolder[] = sortFilenames(filesList)

        // sort
        // let sortType = $sorted.media?.type || "name"
        // if (sortType === "name") localFilteredFiles = sortFilenames(localFilteredFiles)
        // else if (sortType === "name_des") localFilteredFiles = localFilteredFiles.reverse()
        // else if (sortType === "created") localFilteredFiles = localFilteredFiles.sort((a, b) => (a.isFolder || b.isFolder ? 1 : b.stats.birthtimeMs - a.stats.birthtimeMs))
        // else if (sortType === "modified") localFilteredFiles = localFilteredFiles.sort((a, b) => (a.isFolder || b.isFolder ? 1 : b.stats.mtimeMs - a.stats.mtimeMs))

        // append folders
        console.log(foldersList, localFilteredFiles)
        localFilteredFiles = [...sortFilenames(foldersList), ...localFilteredFiles]

        filteredFiles = clone(localFilteredFiles)
        if (searchValue.length < 2) searchedFiles = clone(filteredFiles)
        else filterSearch()

        // scroll to top
        scrollElem?.scrollTo(0, 0)
    }

    // search
    $: if (searchValue !== undefined) filterSearch()
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~()]/g, "")
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
            if (active !== "all" && active !== "favourites") requestFiles(path, 1)
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

    function keydown(e: KeyboardEvent) {
        if (e.target?.closest("input") || e.target?.closest(".edit")) return

        if ((e.ctrlKey || e.metaKey) && e.key === "Backspace") {
            if (rootPath === path) return
            goBack()
        }
    }

    function goBack() {
        const lastSlash = path.lastIndexOf("\\") > -1 ? path.lastIndexOf("\\") : path.lastIndexOf("/")
        const folder = path.slice(0, lastSlash)
        path = folder.length > rootPath.length ? folder || rootPath : rootPath
    }

    // selected will be cleared when clicked, so store them on mousedown
    let selectedFiles: File[] = []
    function storeSelected() {
        if ($selected.id === "audio") selectedFiles = clone($selected.data)
        else selectedFiles = []
    }

    function createPlaylist(e: ClickEvent) {
        let playlistName = ""
        let files: { path: string; name: string }[] = filteredFiles.filter((a) => !a.isFolder)
        if (selectedFiles.length) files = selectedFiles.map((a) => ({ path: a.path, name: a.name }))

        if (e.detail.ctrl) {
            files = []
        } else if (!isDefault) {
            playlistName = name
            if (name.includes(".")) playlistName = translateText(`category.${name.slice(name.indexOf(".") + 1)}`)
        }

        let playlistId = uid()
        audioPlaylists.update((a) => {
            a[playlistId] = {
                name: playlistName,
                songs: files.map((a) => a.path)
            }

            return a
        })

        drawerTabsData.update((a) => {
            a.audio.activeSubTab = playlistId
            return a
        })

        if (!playlistName || !files.length) {
            activeRename.set("category_audio_" + playlistId)
        }
    }

    // select all
    $: if ($selectAllAudio) selectAll()
    function selectAll() {
        if (playlist) {
            let data = playlist.songs.map((file, index) => {
                return { path: file, name: getFileName(file), index }
            })

            selected.set({ id: "audio", data })
            selectAllAudio.set(false)
            return
        }

        let data = filteredFiles
            .filter((a) => getExtension(a.name))
            .map((file) => {
                return { path: file.path, name: file.name, index: -1 }
            })

        selected.set({ id: "audio", data })
        selectAllAudio.set(false)
    }

    $: pathString = path.replace(rootPath, "").replace(name, "").replaceAll("\\", "/").split("/").filter(Boolean).join("/")

    let updater = 1
    $: if (active) {
        setTimeout(update, 500)
        setTimeout(update, 2000) // double check
    }
    function update() {
        updater++
    }
</script>

<svelte:window on:keydown={keydown} />

<div class="scroll" style="flex: 1;overflow-y: auto;" class:full={active === "audio_streams" || active === "effects_library"} bind:this={scrollElem}>
    <div class="grid" style={active !== "audio_streams" && active !== "effects_library" && (playlist ? playlist.songs.length : searchedFiles.length) ? "" : "height: 100%;"}>
        {#if active === "microphones"}
            <Microphones />
        {:else if active === "audio_streams"}
            <AudioStreams />
        {:else if active === "metronome"}
            <Metronome />
        {:else if playlist && playlistSettings}
            <div class="settings">
                <MaterialNumberInput label="settings.audio_crossfade (s)" value={playlist?.crossfade || 0} max={30} step={0.5} on:change={(e) => AudioPlaylist.update(active || "", "crossfade", e.detail)} />
                <MaterialNumberInput label="settings.playlist_volume (%)" value={Number(((playlist?.volume || 1) * 100).toFixed(2))} min={1} max={100} on:change={(e) => AudioPlaylist.update(active || "", "volume", e.detail / 100)} />
            </div>

            <!-- <CombinedInput>
                <p><T id="settings.custom_audio_output" /></p>
                <Dropdown options={audioOutputs} value={audioOutputs.find((a) => a.id === $special.audioOutput)?.name || "—"} on:click={(e) => updateSpecial(e.detail.id, "audioOutput")} />
            </CombinedInput> -->
        {:else if playlist}
            <DropArea id="audio_playlist" selectChildren let:fileOver file>
                {#if playlist.songs.length}
                    {#each playlist.songs as song, index}
                        <AudioFile path={song} name={getFileName(song)} {active} playlist {index} {fileOver} />
                    {/each}
                {:else}
                    <Center faded>
                        <T id="empty.general" />
                    </Center>
                {/if}
            </DropArea>
        {:else if active === "effects_library"}
            <div class="effects">
                {#each searchedFiles as file}
                    <AudioEffect path={file.path} name={file.name} />
                {/each}
            </div>
        {:else if searchedFiles.length}
            {#key rootPath}
                {#key path}
                    {#each searchedFiles as file}
                        {#if file.isFolder}
                            <Folder name={file.name} path={file.path} mode="list" on:open={(e) => (path = e.detail)} />
                        {:else}
                            <AudioFile path={file.path} name={file.name} {active} />
                        {/if}
                    {/each}
                {/key}
            {/key}
        {:else}
            <Center style="opacity: 0.2;">
                <Icon id="noAudio" size={5} white />
            </Center>
        {/if}
    </div>
</div>

{#if active === "microphones" || active === "effects_library" || active === "metronome"}
    <!-- nothing -->
{:else if active === "audio_streams"}
    <FloatingInputs onlyOne>
        <MaterialButton icon="add" style="flex: 1;" on:click={() => activePopup.set("audio_stream")} center title="new.audio_stream">
            {#if !$labelsDisabled}<T id="new.audio_stream" />{/if}
        </MaterialButton>
    </FloatingInputs>
{:else if playlist}
    <FloatingInputs side="left" on:mousedown={storeSelected}>
        <MaterialButton
            disabled={$outLocked}
            title={$activePlaylist?.id === active ? "media.stop" : "media.play"}
            on:click={() => {
                if ($outLocked) return
                $activePlaylist?.id === active ? AudioPlaylist.stop() : AudioPlaylist.start(active || "")
            }}
        >
            <Icon size={1.3} id={$activePlaylist?.id === active ? "stop" : "play"} white={$activePlaylist?.id !== active} />
        </MaterialButton>

        <div class="divider" />

        <MaterialButton
            title="media.toggle_shuffle"
            on:click={() => {
                if (!active) return
                AudioPlaylist.update(active, "mode", $audioPlaylists[active]?.mode === "shuffle" ? "default" : "shuffle")
                // if ($activePlaylist?.id === active) playlistNext("", $activePlaylist.active)
            }}
        >
            <Icon size={1.1} id="shuffle_play" white={$audioPlaylists[active || ""]?.mode !== "shuffle"} />
        </MaterialButton>
        <MaterialButton
            title="media._loop"
            on:click={() => {
                if (!active) return
                AudioPlaylist.update(active, "loop", $audioPlaylists[active]?.loop === undefined ? false : !$audioPlaylists[active]?.loop)
            }}
        >
            <Icon size={1.1} id="loop" white={$audioPlaylists[active || ""]?.loop === false} />
        </MaterialButton>

        <div class="divider" />

        <!-- total length of playlist -->
        <p class="time">
            {updater &&
                joinTime(
                    secondsToTime(
                        playlist.songs.reduce((sum, path) => {
                            const duration = AudioPlayer.getDurationSync(path)
                            return sum + duration
                        }, 0)
                    )
                )}
        </p>
    </FloatingInputs>

    <FloatingInputs round>
        <MaterialButton isActive={playlistSettings} title="audio.playlist_settings" on:click={() => (playlistSettings = !playlistSettings)}>
            <Icon size={1.1} id="options" white={!playlistSettings} />
        </MaterialButton>
    </FloatingInputs>
{:else if active === "all" || active === "favourites"}
    <!-- nothing -->
{:else}
    <!--  -->
    {#if rootPath !== path}
        <FloatingInputs side="left">
            <MaterialButton disabled={rootPath === path} title="actions.back" on:click={goBack}>
                <Icon id="back" white />
            </MaterialButton>

            <div class="divider"></div>

            <p style="opacity: 0.8;display: flex;align-items: center;padding: 0 15px;">
                <span style="opacity: 0.3;font-size: 0.9em;max-width: 500px;overflow: hidden;direction: rtl;">{pathString ? "/" : ""}{pathString}</span>
                {name}

                <!-- files count -->
                <!-- {#if content && rootPath !== path}
            <span style="opacity: 0.5;font-size: 0.9em;margin-inline-start: 10px;">{content}</span>
        {/if} -->
            </p>
        </FloatingInputs>
    {/if}

    <!-- only show if audio content -->
    {#if filteredFiles.filter((a) => !a.isFolder)?.length}
        <FloatingInputs onlyOne>
            <MaterialButton title="new.playlist" on:click={createPlaylist}>
                <Icon size={1.2} id="playlist_create" />
                {#if !$labelsDisabled}<p><T id="new.playlist" /></p>{/if}
            </MaterialButton>
        </FloatingInputs>
    {/if}
{/if}

<style>
    .scroll {
        padding-bottom: 60px;
    }
    .scroll.full {
        padding-bottom: 0;
    }

    .grid {
        display: flex;
        flex-direction: column;
        /* flex-wrap: wrap; */
        flex: 1;
        /* gap: 10px;
    padding: 10px; */
        /* padding: 5px; */
        place-content: flex-start;
    }

    .grid :global(button) {
        /* font-size: 1em; */
        padding: 6px 15px;

        justify-content: space-between;
    }
    .grid :global(.selectElem:not(.isSelected):nth-child(even)) {
        background-color: rgb(0 0 20 / 0.08);
    }

    .settings {
        margin: 15px;
        padding: 10px;

        border: 1px solid var(--primary-lighter);

        border-radius: 8px;
        overflow: hidden;
    }

    .effects {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 5px;

        height: 100%;
        margin: 10px;
    }
    .effects :global(.selectElem button) {
        background-color: var(--primary-darkest);
        /* transition: 0.2s outline; */
    }

    .time {
        display: flex;
        align-items: center;

        font-size: 0.9em;
        padding: 0 10px;
        opacity: 0.8;
    }
</style>
