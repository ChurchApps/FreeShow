<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { Main } from "../../../../types/IPC/Main"
    import { ToMain } from "../../../../types/IPC/ToMain"
    import type { FileData } from "../../../../types/Main"
    import { destroyMain, receiveToMain, requestMain, sendMain } from "../../../IPC/main"
    import { drawerTabsData, labelsDisabled, audioFolders, media, audioPlaylists, effectsLibrary, audioStreams, activeRename } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import { keysToID, sortObject } from "../../helpers/array"
    import { addDrawerFolder } from "../../helpers/dropActions"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import NavigationSections from "./NavigationSections.svelte"
    import { audioExtensions } from "../../../values/extensions"

    const profile = getAccess("audio")
    $: readOnly = profile.global === "read"

    $: activeSubTab = $drawerTabsData.audio?.activeSubTab || ""

    $: foldersList = keysToID($audioFolders)
    $: favoritesListLength = Object.values($media).filter((a) => a.audio && a.favourite).length
    $: effectsLength = $effectsLibrary.length
    $: audioStreamsLength = Object.keys($audioStreams).length

    let allCount = 0
    let folderLengths: { [key: string]: number } = {}
    $: if (foldersList.length) {
        requestMain(
            Main.READ_FOLDERS,
            foldersList?.map((a) => ({ path: a.path || "" })),
            (data) => {
                console.log(data)

                const newFolderLengths: { [key: string]: number } = {}
                allCount = 0
                Object.entries(data).forEach(([path, files]) => {
                    newFolderLengths[path] = countFiles(files)
                })
                folderLengths = newFolderLengths
            }
        )
    }
    function countFiles(files: FileData[]) {
        let count = 0
        files.forEach((file) => {
            if (file.folder) count++
            else if (audioExtensions.includes(file.extension)) {
                allCount++
                count++
            }
        })
        return count
    }

    $: playlists = !!Object.keys($audioPlaylists).length
    // ...(playlists ? [getAudioPlaylists($audioPlaylists)] : []),

    let sections: any[] = []
    $: sections = [
        [
            { id: "all", label: "category.all", icon: "all", count: allCount },
            { id: "favourites", label: "category.favourites", icon: "star", count: favoritesListLength, hidden: !favoritesListLength && activeSubTab !== "favourites" }
        ],
        [
            { id: "microphones", label: "live.microphones", icon: "microphone" },
            { id: "audio_streams", label: "live.audio_streams", icon: "audio_stream", count: audioStreamsLength }
        ],
        [{ id: "effects_library", label: "category.sound_effects", icon: "effect", count: effectsLength, hidden: !effectsLength && activeSubTab !== "effects_library" }],
        getAudioPlaylists($audioPlaylists),
        convertToButton(foldersList, folderLengths)
    ]

    function getAudioPlaylists(playlistUpdater) {
        if (!Object.keys(playlistUpdater).length) return []

        let playlists = sortObject(keysToID(playlistUpdater), "name")
        playlists = playlists.map((a) => {
            const length = a.songs?.length
            return { id: a.id, label: a.name, icon: "playlist", length }
        })
        if (!playlists.length) return []

        return playlists
    }

    function convertToButton(categories: any[], lengths: { [key: string]: number }) {
        return sortObject(categories, "name").map((a) => {
            return { id: a.id, label: a.name, icon: a.icon, count: lengths[a.path] }
        })
    }

    const PICK_ID = uid()
    function addFolder() {
        sendMain(Main.OPEN_FOLDER, { channel: PICK_ID })
    }
    let listenerId = receiveToMain(ToMain.OPEN_FOLDER2, (data) => {
        if (data.channel !== PICK_ID || !data.path) return
        addDrawerFolder(data, "audio")
    })
    onDestroy(() => destroyMain(listenerId))

    function updateName(e: any) {
        const { id, value } = e.detail

        if ($audioPlaylists[id]) {
            audioPlaylists.update((a) => {
                a[id].name = value
                return a
            })
            return
        }

        audioFolders.update((a) => {
            if (a[id].default) delete a[id].default
            a[id].name = value
            return a
        })
    }

    function createPlaylist() {
        let playlistId = uid()
        audioPlaylists.update((a) => {
            a[playlistId] = { name: "", songs: [] }
            return a
        })

        drawerTabsData.update((a) => {
            a.audio.activeSubTab = playlistId
            return a
        })

        activeRename.set("category_audio_" + playlistId)
    }
</script>

<NavigationSections {sections} active={activeSubTab} on:rename={updateName}>
    <div slot="section_3" style="padding: 8px;{playlists ? 'padding-top: 12px;' : ''}">
        <MaterialButton icon="add" style="width: 100%;" title="new.playlist" variant="outlined" disabled={readOnly} on:click={createPlaylist} small>
            {#if !$labelsDisabled}<T id="new.playlist" />{/if}
        </MaterialButton>
    </div>
    <div slot="section_4" style="padding: 8px;{foldersList.length ? 'padding-top: 12px;' : ''}">
        <MaterialButton icon="add" style="width: 100%;" title="new.system_folder" variant="outlined" disabled={readOnly} on:click={addFolder} small>
            {#if !$labelsDisabled}<T id="new.system_folder" />{/if}
        </MaterialButton>
    </div>
</NavigationSections>
