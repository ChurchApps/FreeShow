<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { Main } from "../../../../types/IPC/Main"
    import { ToMain } from "../../../../types/IPC/ToMain"
    import type { FileData } from "../../../../types/Main"
    import { destroyMain, receiveToMain, requestMain, sendMain } from "../../../IPC/main"
    import { drawerTabsData, labelsDisabled, media, mediaFolders } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import { keysToID, sortObject } from "../../helpers/array"
    import { addDrawerFolder } from "../../helpers/dropActions"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import NavigationSections from "./NavigationSections.svelte"
    import { mediaExtensions } from "../../../values/extensions"

    const profile = getAccess("media")
    $: readOnly = profile.global === "read"

    $: activeSubTab = $drawerTabsData.media?.activeSubTab || ""

    $: foldersList = keysToID($mediaFolders)
    $: favoritesListLength = Object.values($media).filter((a) => !a.audio && a.favourite).length

    let allCount = 0
    let folderLengths: { [key: string]: number } = {}
    $: if (foldersList.length) {
        requestMain(
            Main.READ_FOLDERS,
            foldersList?.map((a) => ({ path: a.path || "" })),
            (data) => {
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
            else if (mediaExtensions.includes(file.extension)) {
                allCount++
                count++
            }
        })
        return count
    }

    let sections: any[] = []
    $: sections = [
        [
            { id: "all", label: "category.all", icon: "all", count: allCount },
            { id: "favourites", label: "category.favourites", icon: "star", count: favoritesListLength, hidden: !favoritesListLength && activeSubTab !== "favourites" }
        ],
        [
            { id: "online", label: "media.online", icon: "web" },
            { id: "screens", label: "live.screens", icon: "screen" },
            { id: "cameras", label: "live.cameras", icon: "camera" }
        ],
        convertToButton(foldersList, folderLengths)
    ]

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
        addDrawerFolder(data, "media")
    })
    onDestroy(() => destroyMain(listenerId))

    function updateName(e: any) {
        const { id, value } = e.detail
        mediaFolders.update((a) => {
            if (a[id].default) delete a[id].default
            a[id].name = value
            return a
        })
    }
</script>

<NavigationSections {sections} active={activeSubTab} on:rename={updateName}>
    <div slot="section_2" style="padding: 8px;{foldersList.length ? 'padding-top: 12px;' : ''}">
        <MaterialButton icon="add" style="width: 100%;" title="new.system_folder" variant="outlined" disabled={readOnly} on:click={addFolder} small>
            {#if !$labelsDisabled}<T id="new.system_folder" />{/if}
        </MaterialButton>
    </div>
</NavigationSections>
