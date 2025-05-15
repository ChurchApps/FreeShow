<script lang="ts">
    import { actionHistory } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { getDateAndTimeString, timeAgo } from "../../helpers/time"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Center from "../../system/Center.svelte"

    function clearHistory() {
        actionHistory.set([])
    }
</script>

<main class="history">
    {#if $actionHistory.length}
        {#each $actionHistory as item}
            <p>
                <span>
                    {item.action[0].toUpperCase() + item.action.slice(1).replaceAll("_", " ")}
                    {#if item.count > 1}<span style="opacity: 0.5;">({item.count})</span>{/if}
                </span>
                <span class="time" title={getDateAndTimeString(item.time || 0)}>{timeAgo(item.time || 0)}</span>
            </p>
        {/each}

        <br />

        <CombinedInput>
            <Button on:click={clearHistory} style="width: 100%;" center dark>
                <Icon id="delete" right />
                <T id="actions.clear_history" />
            </Button>
        </CombinedInput>
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
    main :global(p:nth-child(odd)) {
        background-color: rgb(0 0 20 / 0.08);
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
