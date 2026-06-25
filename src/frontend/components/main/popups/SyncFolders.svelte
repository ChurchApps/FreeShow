<script lang="ts">
    import { onMount } from "svelte"
    import type { PCOFolderTreeNode } from "../../../../electron/contentProviders/planningCenter/request"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { contentProviderData } from "../../../stores"
    import Center from "../../system/Center.svelte"
    import Loader from "../Loader.svelte"
    import Tip from "../Tip.svelte"
    import FolderTree from "./SyncFoldersPcoFolderTree.svelte"

    let folderTree: PCOFolderTreeNode[] | null = null
    let loading = true

    onMount(async () => {
        folderTree = (await requestMain(Main.PROVIDER_FETCH_FOLDERS, { providerId: "planningcenter" })) ?? null
        loading = false
    })

    function updateProvider(key: string, value: any) {
        contentProviderData.update((a) => {
            if (!a.planningcenter) a.planningcenter = {}
            a.planningcenter[key] = value
            return a
        })
    }

    function getAllFolderIds(nodes: PCOFolderTreeNode[]): string[] {
        let ids: string[] = []
        nodes.forEach((n) => {
            if (n.type === "folder") {
                ids.push(n.id)
                if (n.children?.length) {
                    ids = [...ids, ...getAllFolderIds(n.children)]
                }
            }
        })
        return ids
    }

    function handleToggleSelect(e: CustomEvent<{ id: string; checked: boolean }>) {
        const { id, checked } = e.detail
        const allIds = getAllFolderIds(folderTree || [])
        const currentSelected = $contentProviderData.planningcenter?.syncFolderIds || []

        let nextSelected: string[]
        if (currentSelected.length === 0) {
            if (!checked) nextSelected = allIds.filter((a) => a !== id)
            else nextSelected = []
        } else {
            if (checked) nextSelected = [...currentSelected, id]
            else nextSelected = currentSelected.filter((a) => a !== id)
        }

        // set to empty (sync all) if all folders are selected
        const allSelected = allIds.every((a) => nextSelected.includes(a))
        if (allSelected) nextSelected = []

        updateProvider("syncFolderIds", nextSelected)
    }
</script>

{#if loading}
    <Center padding={15}>
        <Loader />
    </Center>
{:else if folderTree === null || folderTree.length === 0}
    <Center padding={20} faded>
        <p>No folders found in your Planning Center account!</p>
    </Center>
{:else}
    <Tip value="Only services in the selected folders will be automatically synced." bottom={20} />

    <div class="tree">
        <FolderTree nodes={folderTree} selectedIds={$contentProviderData.planningcenter?.syncFolderIds || []} on:toggleSelect={handleToggleSelect} />
    </div>
{/if}

<style>
    .tree {
        background-color: var(--primary-darker);
        padding: 8px;
        border-radius: 6px;
    }
</style>
