<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { PCOFolderTreeNode } from "../../../../electron/contentProviders/planningCenter/request"
    import Icon from "../../helpers/Icon.svelte"
    import MaterialCheckbox from "../../inputs/MaterialCheckbox.svelte"

    export let nodes: PCOFolderTreeNode[]
    export let selectedIds: string[]
    export let depth = 0

    const dispatch = createEventDispatcher()

    // just leave all expanded always for now
    // Start with all folders expanded
    // let expanded = new Set<string>(nodes.filter((n) => n.type === "folder").map((n) => n.id))
    // function toggleExpand(id: string) {
    //     if (expanded.has(id)) expanded.delete(id)
    //     else expanded.add(id)
    //     expanded = expanded
    // }

    function toggleCheck(id: string, checked: boolean) {
        dispatch("toggleSelect", { id, checked })
    }

    function forwardToggleSelect(e: CustomEvent<{ id: string; checked: boolean }>) {
        dispatch("toggleSelect", e.detail)
    }
</script>

{#each nodes as node}
    {#if node.type === "folder"}
        <div class="row" style="margin-left: {depth * 16}px;">
            <!-- <button on:click={() => toggleExpand(node.id)}>
                <Icon id={expanded.has(node.id) ? "arrow_down" : "arrow_right"} size={0.75} white />
            </button> -->

            <MaterialCheckbox label={node.name} icon="folder" checked={selectedIds.length === 0 || selectedIds.includes(node.id)} on:change={(e) => toggleCheck(node.id, e.detail)} style="width: 100%;height: 32px;min-height: 32px;padding-left: 10px;" small />
        </div>

        <!-- expanded.has(node.id) -->
        {#if node.children.length}
            <svelte:self nodes={node.children} {selectedIds} depth={depth + 1} on:toggleSelect={forwardToggleSelect} />
        {/if}
    {:else}
        <div class="row service-row" style="margin-left: {depth * 16}px;">
            <Icon id="list" size={0.8} white style="opacity: 0.6;" />
            <span class="service-name">{node.name}</span>
        </div>
    {/if}
{/each}

<style>
    .row {
        display: flex;
        align-items: center;
        gap: 6px;

        padding-block: 4px;
        padding-inline-end: 8px;
        border-radius: 4px;

        border-left: 2px solid var(--primary-lighter);
    }

    .service-row {
        padding-left: 10px;

        opacity: 0.65;
        font-size: 0.85em;
    }

    .service-name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>
