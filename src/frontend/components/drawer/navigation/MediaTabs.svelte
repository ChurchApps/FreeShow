<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import type { ContentProviderId } from "../../../../electron/contentProviders/base/types"
    import { Main } from "../../../../types/IPC/Main"
    import { ToMain } from "../../../../types/IPC/ToMain"
    import { destroyMain, receiveToMain, requestMain, sendMain } from "../../../IPC/main"
    import { drawerTabsData, labelsDisabled, media, mediaFolders, providerConnections } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import { keysToID, sortObject } from "../../helpers/array"
    import { addDrawerFolder } from "../../helpers/dropActions"
    import Icon from "../../helpers/Icon.svelte"
    import { countFolderMediaItems } from "../../helpers/media"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import NavigationSections from "./NavigationSections.svelte"

    const profile = getAccess("media")
    $: readOnly = profile.global === "read"

    $: activeSubTab = $drawerTabsData.media?.activeSubTab || ""

    $: foldersList = keysToID($mediaFolders)
    $: favoritesListLength = Object.values($media).filter((a) => !a.audio && a.favourite).length

    let allCount = 0
    let folderLengths: { [key: string]: number } = {}
    $: if (foldersList.length) getCounts()
    async function getCounts() {
        const folderPaths = foldersList.map((a) => a.path || "")
        const data = keysToID(await requestMain(Main.READ_FOLDER, { path: folderPaths, depth: 1 }))
        const newFolderLengths: { [key: string]: number } = {}

        folderPaths.forEach((folderPath) => {
            newFolderLengths[folderPath] = countFolderMediaItems(folderPath, data)
        })

        folderLengths = newFolderLengths
        // WIP allCount
        // allCount = data.reduce((acc) => {
        //     acc += isRootFolderItem isMediaExtension(getExtension(filePath)) ? 1 : 0
        //     return acc
        // }, 0)
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

    let sections: any[] = []
    $: sections = [
        [
            { id: "all", label: "category.all", icon: "all", count: allCount },
            { id: "favourites", label: "category.favourites", icon: "star", count: favoritesListLength, hidden: !favoritesListLength && activeSubTab !== "favourites" }
        ],
        // WIP Providers
        ...(contentProviders.length ? [[{ id: "TITLE", label: "Curriculum" }, ...contentProviders.map((p) => ({ id: p.providerId, label: p.displayName, icon: "web" }))]] : []),
        [{ id: "online", label: "media.online", icon: "web" }, "SEPARATOR", { id: "screens", label: "live.screens", icon: "screen" }, { id: "cameras", label: "live.cameras", icon: "camera" }].filter(Boolean),
        [{ id: "TITLE", label: "media.folders" }, ...convertToButton(foldersList, folderLengths)]
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
    <div slot="section_2" style="{!contentProviders.length ? 'padding: 8px;' : ''}{foldersList.length && !contentProviders.length ? 'padding-top: 12px;' : ''}">
        {#if !contentProviders.length}
            <MaterialButton style="width: 100%;" title="new.system_folder" variant="outlined" disabled={readOnly} on:click={addFolder} small>
                <Icon id="add" size={$labelsDisabled ? 0.9 : 1} white={$labelsDisabled} />
                {#if !$labelsDisabled}<T id="new.system_folder" />{/if}
            </MaterialButton>
        {/if}
    </div>
    <div slot="section_3" style="padding: 8px;{foldersList.length ? 'padding-top: 12px;' : ''}">
        <MaterialButton style="width: 100%;" title="new.system_folder" variant="outlined" disabled={readOnly} on:click={addFolder} small>
            <Icon id="add" size={$labelsDisabled ? 0.9 : 1} white={$labelsDisabled} />
            {#if !$labelsDisabled}<T id="new.system_folder" />{/if}
        </MaterialButton>
    </div>
</NavigationSections>
