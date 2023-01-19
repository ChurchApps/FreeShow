<script lang="ts">
    import { redoHistory, undoHistory } from "../../../stores"
    import { redo, undo } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { dateToString, timeAgo } from "../../helpers/time"
    import Button from "../../inputs/Button.svelte"
    import Center from "../../system/Center.svelte"

    $: rHistory = [...$redoHistory]
    $: uHistory = [{ id: "initial", time: 0 }, ...$undoHistory].reverse()

    const historyIdToString = {
        removeSlides: "Removed slide(s)",
        deleteSlides: "Deleted slide(s)",
        deleteGroups: "Deleted slide group(s)",
        slide: "Added slide",
        newSlide: "Added slide",
        addShowToProject: "Added show to project",
        updateProject: "Changed project",
        SAVE: "Saved",
        initial: "Initial state",
    }

    function callUndo(index) {
        setTimeout(() => {
            for (let i = 0; i <= index; i++) {
                undo()
            }
        }, 10)
    }

    function callRedo(index) {
        setTimeout(() => {
            for (let i = rHistory.length - 1; i >= index; i--) {
                redo()
            }
        }, 10)
    }

    function clearHistory() {
        undoHistory.set([])
        redoHistory.set([])
    }
</script>

{#if rHistory.length || uHistory.length}
    {#each rHistory as item, i}
        <Button on:click={() => callRedo(i)} style="opacity: 0.5;">
            <p>
                <span>
                    {#if item.id === "SAVE"}<Icon id="save" />{/if}
                    {historyIdToString[item.id] || item.id}
                </span>
                <span class="time" title={dateToString(item.time || 0)}>{timeAgo(item.time || 0)}</span>
            </p>
        </Button>
    {/each}
    {#each uHistory as item, i}
        <Button on:click={() => callUndo(i - 1)} outline={i === 0}>
            <p>
                <span>
                    {#if item.id === "SAVE"}<Icon id="save" />{/if}
                    {historyIdToString[item.id] || item.id}
                </span>
                <span class="time" title={dateToString(item.time || 0)}>{timeAgo(item.time || 0)}</span>
            </p>
        </Button>
    {/each}

    <br />

    <Button on:click={clearHistory} center>
        <Icon id="delete" right />
        <T id="actions.clear_history" />
    </Button>
{:else}
    <Center>
        <T id="empty.general" />
    </Center>
{/if}

<style>
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
        opacity: 0.8;
        font-size: 0.8em;
        font-style: italic;
    }
</style>
