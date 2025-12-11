<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { Main } from "../../../../types/IPC/Main"
    import type { ClickEvent } from "../../../../types/Main"
    import { destroyMain, receiveMain, sendMain } from "../../../IPC/main"
    import { AudioPlaylist } from "../../../audio/audioPlaylist"
    import { activePlaylist, activePopup, activeRename, audioFolders, audioPlaylists, drawerTabsData, effectsLibrary, labelsDisabled, media, outLocked, selectAllAudio, selected } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, sortByName } from "../../helpers/array"
    import { splitPath } from "../../helpers/get"
    import { getFileName, getMediaType } from "../../helpers/media"
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
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { joinTime, secondsToTime } from "../../helpers/time"

    export let active: string | null
    export let searchValue = ""

    type File = { path: string; name: string; extension?: string; folder?: boolean; favourite?: boolean; audio?: boolean }

    let files: File[] = []
    let scrollElem: HTMLElement | undefined

    let playlistSettings = false

    $: playlist = active && $audioPlaylists[active]

    $: isDefault = ["all", "favourites", "effects_library", "microphones", "audio_streams", "metronome"].includes(active || "")
    $: rootPath = isDefault || playlist ? "" : active !== null ? $audioFolders[active]?.path || "" : ""
    $: path = isDefault || playlist ? "" : rootPath
    $: name = active === "all" ? "category.all" : active === "favourites" ? "category.favourites" : active === "effects_library" ? "category.sound_effects" : rootPath === path ? (active !== "microphones" && active !== "audio_streams" && active !== "metronome" && active !== null ? $audioFolders[active]?.name || "" : "") : splitPath(path).name

    // get list of files & folders
    let prevActive: null | string = null
    $: {
        if (active === "favourites") {
            prevActive = active
            files = Object.entries($media)
                .map(([path, a]) => {
                    let p = splitPath(path)
                    let name = p.name
                    return { path, favourite: a.favourite === true, name, extension: p.extension, audio: a.audio === true }
                })
                .filter((a) => a.favourite === true && a.audio === true)

            // filterFiles()
            scrollElem?.scrollTo(0, 0)
        } else if (active === "effects_library") {
            prevActive = active
            files = clone($effectsLibrary)

            scrollElem?.scrollTo(0, 0)
        } else if (active === "all") {
            if (active !== prevActive) {
                prevActive = active
                files = []
                Object.values($audioFolders).forEach((data) => sendMain(Main.READ_FOLDER, { path: data.path!, disableThumbnails: true }))
            }
        } else if (path.length) {
            if (path !== prevActive) {
                prevActive = path
                files = []
                sendMain(Main.READ_FOLDER, { path, listFilesInFolders: true, disableThumbnails: true })
            }
        } else {
            // microphones & audio_streams & metronome
            prevActive = active
        }
    }

    let filesInFolders: { id: string; name: string }[] = []
    let folderFiles: { [key: string]: string[] } = {}

    let listenerId = receiveMain(Main.READ_FOLDER, (data) => {
        filesInFolders = sortByName(data.filesInFolders || [])

        if (active !== "all" && data.path !== path) return

        files.push(...data.files.filter((file) => getMediaType(file.extension) === "audio" || (active !== "all" && file.folder)))
        files = sortByName(files).sort((a, b) => (a.folder === b.folder ? 0 : a.folder ? -1 : 1))

        files = files.map((a) => ({ ...a, path: a.folder ? a.path : a.path }))

        // set valid files in folder
        folderFiles = {}
        Object.keys(data.folderFiles).forEach((path) => {
            folderFiles[path] = data.folderFiles[path].filter((file) => file.folder || getMediaType(file.extension) === "audio")
        })

        // remove folders with no content
        files = files.filter((a) => !a.folder || !folderFiles[a.path] || folderFiles[a.path].length > 0)

        // filterFiles()
        scrollElem?.scrollTo(0, 0)
    })
    onDestroy(() => destroyMain(listenerId))

    // search
    $: if (searchValue !== undefined || files) filterSearch()
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~()]/g, "")
    let fullFilteredFiles: any[] = []
    function filterSearch() {
        fullFilteredFiles = clone(files)
        if (searchValue.length > 1) fullFilteredFiles = [...fullFilteredFiles, ...filesInFolders].filter((a) => filter(a.name).includes(filter(searchValue)))

        // scroll to top
        document.querySelector("svelte-virtual-list-viewport")?.scrollTo(0, 0)
    }

    function keydown(e: KeyboardEvent) {
        // if (e.key === "Enter" && searchValue.length > 1 && e.target.closest(".search")) {
        //   if (fullFilteredFiles.length) {
        //     let file = fullFilteredFiles[0]
        //     activeShow.set({ id: file.path, name: file.name, type: $videoExtensions.includes(file.extension) ? "video" : "image" })
        //     activeFile = filteredFiles.findIndex((a) => a.path === file.path)
        //     if (activeFile < 0) activeFile = null
        //   }
        // }

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
        let files = fullFilteredFiles.filter((a) => !a.folder)
        if (selectedFiles.length) files = selectedFiles

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
        let data = (playlist ? playlist.songs : fullFilteredFiles)
            .filter((a) => (playlist ? true : a.extension))
            .map((file, index) => {
                if (playlist) return { path: file, name: getFileName(file), index }
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
    <div class="grid" style={active !== "audio_streams" && active !== "effects_library" && (playlist ? playlist.songs.length : fullFilteredFiles.length) ? "" : "height: 100%;"}>
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
                {#each fullFilteredFiles as file}
                    <AudioEffect path={file.path} name={file.name} />
                {/each}
            </div>
        {:else if fullFilteredFiles.length}
            {#key rootPath}
                {#key path}
                    {#each fullFilteredFiles as file}
                        {#if file.folder}
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
    {#if fullFilteredFiles.filter((a) => !a.folder)?.length}
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
