<script lang="ts">
    import { actionHistory } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { getDateAndTimeString, timeAgo } from "../../helpers/time"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Center from "../../system/Center.svelte"

    function clearHistory() {
        actionHistory.set([])
    }
</script>

<main class="history">
    {#if $actionHistory.length}
        <div class="list">
            {#each $actionHistory as item}
                <p style="padding: 5px 20px;">
                    <span>
                        {item.action[0].toUpperCase() + item.action.slice(1).replaceAll("_", " ")}
                        {#if item.count > 1}<span style="opacity: 0.5;">({item.count})</span>{/if}
                    </span>
                    <span class="time" data-title={getDateAndTimeString(item.time || 0)}>{timeAgo(item.time || 0)}</span>
                </p>
            {/each}
        </div>

        <MaterialButton variant="outlined" style="margin-top: 20px;" icon="delete" on:click={clearHistory}>
            <T id="actions.clear_history" />
        </MaterialButton>
    {:else}
        <Center faded>
            <T id="empty.general" />
        </Center>
    {/if}
</main>

<style>
    main {
        display: flex;
        flex-direction: column;
        /* gap: 5px; */
    }

    .list {
        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);

        border-radius: 8px;
        padding: 10px 0;

        display: flex;
        flex-direction: column;
    }
    .list p:nth-child(odd) {
        background-color: rgb(0 0 20 / 0.12) !important;
    }

    p {
        width: 100%;
        display: flex;
        justify-content: space-between;
    }

    span {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    p .time {
        opacity: 0.5;
        font-size: 0.8em;
        font-style: italic;
    }
</style>
