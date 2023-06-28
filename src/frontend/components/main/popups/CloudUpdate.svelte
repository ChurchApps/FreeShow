<script lang="ts">
    import { activePopup, popupData } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import Button from "../../inputs/Button.svelte"
    import Center from "../../system/Center.svelte"
    import Loader from "../Loader.svelte"

    $: changes = $popupData

    // change.name
    // change.action: "upload", "download", "upload_failed", "download_failed"
    // change.type: "show", "config", "bible"
    // change.count: (changed "shows")
</script>

{#if changes && changes.length}
    <div class="changes">
        {#each changes as change}
            <p>
                <Icon id={change.action} size={1.5} white={change.action.includes("failed")} right />
                <span>{change.name}</span>
                {#if change.count}
                    <span class="count">({change.count})</span>
                {/if}
            </p>
        {/each}
    </div>

    <br />

    <Button on:click={() => activePopup.set(null)} center>
        <Icon id="check" />
    </Button>
{:else}
    <div class="loading">
        <Center>
            <Loader />
        </Center>
    </div>

    <!-- <Button
        on:click={() => {
            send(CLOUD, ["CANCEL"])
            activePopup.set(null)
        }}
        dark
    >
        <Icon id="close" right />
        <T id="popup.cancel" />
    </Button> -->
{/if}

<style>
    .loading {
        margin: 10px;
    }
    .loading :global(div) {
        overflow: hidden;
    }

    .changes {
        display: flex;
        flex-direction: column;
    }

    .changes p {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .count {
        opacity: 0.7;
        font-size: 0.9em;
    }
</style>
