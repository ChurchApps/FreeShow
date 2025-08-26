<script lang="ts">
    import { activePopup, popupData } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Center from "../../system/Center.svelte"
    import Loader from "../Loader.svelte"

    $: changes = $popupData

    // change.name
    // change.action: "upload", "download", "upload_failed", "download_failed"
    // change.type: "show", "config", "bible"
    // change.count: (changed "shows")
</script>

{#if changes && changes.length}
    <div class="changes" style="margin-bottom: 20px;">
        {#each changes as change}
            <p>
                <Icon id={change.action} size={1.3} white={change.action.includes("failed")} />
                <span>{change.name}</span>
                {#if change.count}
                    <span class="count">{change.count}</span>
                {/if}
            </p>
        {/each}
    </div>

    <MaterialButton variant="outlined" icon="check" on:click={() => activePopup.set(null)} />
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

        background-color: var(--primary-darker);

        border-radius: 4px;
        overflow: hidden;
    }

    .changes p {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
    }
    .changes p:nth-child(odd) {
        background-color: var(--primary-darkest);
    }

    .count {
        opacity: 0.5;
        font-size: 0.7em;
        padding-left: 5px;
    }
</style>
