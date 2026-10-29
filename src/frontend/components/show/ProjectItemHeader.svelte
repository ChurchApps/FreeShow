<script lang="ts">
    import { activeProject, activeShow, editingProjectTemplate, projects, shows } from "../../stores"
    import { linkProjectItem, unlinkProjectItem } from "../helpers/projectItemLink"
    import MaterialButton from "../inputs/MaterialButton.svelte"

    // the open show is this item of the active project
    $: index = $activeShow?.index ?? -1
    $: item = !$editingProjectTemplate && index > -1 ? $projects[$activeProject || ""]?.shows?.[index] : null
    $: isItem = !!item && item.id === $activeShow?.id && (item.type || "show") === "show"
</script>

{#if isItem}
    <div class="itemHeader">
        <p class="name">{$shows[item?.id || ""]?.name || ""}</p>
        <MaterialButton icon="search" title="actions.link_show" on:click={() => linkProjectItem(index)} />
        <MaterialButton icon="unbind" title="actions.unlink_show" on:click={() => unlinkProjectItem(index)} />
    </div>
{/if}

<style>
    .itemHeader {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 0 4px 0 12px;
        background-color: var(--primary-darker);
        border-bottom: 1px solid var(--primary-lighter);
    }

    .name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.8;
    }
</style>
