<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { Show } from "../../../../types/Show"
    import { send } from "../../util/socket"
    import { groupsCache } from "../../util/stores"

    export let show: Show

    send("API:get_groups", { id: show.id })

    $: groups = $groupsCache[show.id!] || []
    $: console.log(groups)

    let dispatch = createEventDispatcher()
    function addGroup(group: any) {
        send("API:add_group", { showId: show.id, groupId: group.id })
        dispatch("added")
    }
</script>

<div class="groups">
    {#each groups as group}
        <div class="group" style="--color: {group.color};" on:click={() => addGroup(group)}>
            <p>{group.group || "—"}</p>
        </div>
    {/each}
</div>

<style>
    .groups {
        flex: 1;
        overflow-y: auto;

        display: flex;
        flex-direction: column;
        gap: 5px;

        padding: 10px;
    }

    .group {
        display: flex;
        justify-content: center;
        width: 100%;

        background-color: var(--primary-darker);

        --color: var(--text);
        border-bottom: 2px solid var(--color);
        color: var(--color);

        cursor: pointer;
    }
</style>
