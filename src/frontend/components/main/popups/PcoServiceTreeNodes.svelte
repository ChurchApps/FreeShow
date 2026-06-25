<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { PCOFolderTreeNode } from "../../../../electron/contentProviders/planningCenter/request"
    import Icon from "../../helpers/Icon.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    export let nodes: PCOFolderTreeNode[]
    export let depth = 0

    const dispatch = createEventDispatcher<{ select: PCOFolderTreeNode }>()

    function forwardSelect(e: CustomEvent<PCOFolderTreeNode>) {
        dispatch("select", e.detail)
    }
</script>

{#each nodes as node}
    {#if node.type === "folder"}
        <div class="row" style="margin-left: {depth * 16}px;font-weight: 600;opacity: 0.85;">
            <Icon id="folder" size={0.9} style="opacity: 0.85;margin-right: 2px;" white />
            <p style="font-size: 0.9em;">{node.name}</p>
        </div>

        {#if node.children.length}
            <svelte:self nodes={node.children} depth={depth + 1} on:select={forwardSelect} />
        {/if}
    {:else if node.type === "service_type"}
        <div class="row" style="margin-left: {depth * 16}px;opacity: 0.9;">
            <Icon id="list" size={0.8} style="opacity: 0.9;margin-right: 2px;" white />
            <p style="font-size: 0.9em;">{node.name}</p>
        </div>

        {#if node.children.length}
            <svelte:self nodes={node.children} depth={depth + 1} on:select={forwardSelect} />
        {/if}
    {:else if node.type === "plan"}
        <div class="row" style="margin-left: {depth * 16}px;padding: 2px;">
            <MaterialButton style="width: 100%;justify-content: start;font-weight: normal;padding: 4px 8px;" on:click={() => dispatch("select", node)}>
                <Icon id="project" size={0.8} style="margin-right: 2px;" white />
                <p>{node.name}</p>
            </MaterialButton>
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

        padding-left: 10px;
        border-left: 2px solid var(--primary-lighter);

        font-size: 0.9em;
    }
</style>
