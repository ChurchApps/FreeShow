<!-- All items of the active project in one scrolling list, otherwise working as the normal show view -->

<script lang="ts">
    import { onMount, setContext } from "svelte"
    import type { ProjectShowRef } from "../../../types/Projects"
    import { activeProject, activeShow, projects } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Loader from "../main/Loader.svelte"
    import Center from "../system/Center.svelte"
    import { getAllProjectItems } from "./focus/focus"
    import FocusItem from "./focus/FocusItem.svelte"

    // the item views lay out as stacked list items
    setContext("stackedList", true)

    $: project = $projects[$activeProject || ""]

    // don't refresh list unless order changes
    let projectItemsList: ProjectShowRef[] = []
    onMount(updateProjectItemsList)
    $: projectItems = (project?.shows || []).map((a) => a.id || a.name).join(",")
    $: if (projectItems) updateProjectItemsList()
    function updateProjectItemsList() {
        projectItemsList = project?.shows || []
    }

    function selectItem(item: ProjectShowRef, index: number) {
        if ($activeShow?.index === index && $activeShow?.id === item.id) return
        activeShow.set({ ...item, index })
    }
</script>

{#await getAllProjectItems(projectItemsList)}
    <Center>
        <Loader />
    </Center>
{:then list}
    {#if list.length}
        <div class="list">
            {#each list as item, i}
                <div class="listItem" class:active={$activeShow?.index === i} role="none" on:mousedown={() => selectItem(item, i)}>
                    <div class="name" style={item.color ? `border-bottom: 2px solid ${item.color}` : ""}>
                        <Icon id={item.icon || "noIcon"} custom={(item.type || "show") === "show"} white right />
                        <p>{item.name}</p>
                    </div>
                    <FocusItem show={{ ...item, index: i }} />
                </div>
            {/each}
        </div>
    {:else}
        <Center faded>
            <T id="empty.general" />
        </Center>
    {/if}
{/await}

<style>
    .list {
        display: flex;
        flex-direction: column;
    }

    .name {
        width: 100%;
        background-color: var(--primary-darkest);
        padding: 4px 8px;
        font-weight: 600;

        display: flex;
        align-items: center;
    }
    .active .name {
        color: var(--secondary);
    }
</style>
