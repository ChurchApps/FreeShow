<script lang="ts">
    import { onMount } from "svelte"
    import type { PCOFolderTreeNode } from "../../../../electron/contentProviders/planningCenter/request"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { activePopup } from "../../../stores"
    import Center from "../../system/Center.svelte"
    import Loader from "../Loader.svelte"
    import PcoServiceTreeNodes from "./PcoServiceTreeNodes.svelte"

    let nodes: PCOFolderTreeNode[] = []
    let loading = true

    onMount(async () => {
        const tree = await requestMain(Main.PCO_FETCH_SERVICE_TREE)
        nodes = tree ?? []
        loading = false
    })

    function onSelect(e: CustomEvent<PCOFolderTreeNode>) {
        const node = e.detail
        if (node.type !== "plan" || !node.serviceTypeId) return

        activePopup.set(null)
        requestMain(Main.PCO_LOAD_PLAN, { serviceTypeId: node.serviceTypeId, planId: node.id })
    }
</script>

{#if loading}
    <Center padding={20}>
        <Loader />
    </Center>
{:else if !nodes.length}
    <Center padding={20} faded>
        <p>No content found!</p>
    </Center>
{:else}
    <div class="tree">
        <PcoServiceTreeNodes {nodes} on:select={onSelect} />
    </div>
{/if}

<style>
    .tree {
        background-color: var(--primary-darker);
        padding: 8px;
        border-radius: 6px;
    }
</style>
