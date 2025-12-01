<script lang="ts">
    import { onMount } from "svelte"
    import type { Overlay } from "../../../../../../../types/Show"
    import Icon from "../../../../../../common/components/Icon.svelte"
    import Center from "../../../../../../common/components/Center.svelte"
    import { translate } from "../../../../../util/helpers"
    import { send } from "../../../../../util/socket"
    import { dictionary, overlays, overlayCategories, activeOverlayCategory, outData } from "../../../../../util/stores"
    import MaterialButton from "../../../../MaterialButton.svelte"
    import Zoomed from "../../../../show/Zoomed.svelte"
    import Textbox from "../../../../show/Textbox.svelte"

    export let searchValue: string = ""

    // Resolution for overlays
    let resolution = { width: 1920, height: 1080 }

    // Get active overlays from output data
    $: activeOverlayIds = $outData?.overlays || []

    // Get current category
    $: activeCategory = $activeOverlayCategory || "all"

    // Convert overlays object to array with IDs
    $: overlaysList = Object.entries($overlays || {}).map(([id, overlay]) => ({
        id,
        ...(overlay as Overlay)
    }))

    // Filter overlays by category
    $: categoryFilteredOverlays = overlaysList.filter(overlay => {
        if (activeCategory === "all") {
            // Exclude archived categories in "all" view
            return !$overlayCategories[overlay.category || ""]?.isArchive
        }
        if (activeCategory === "unlabeled") {
            return overlay.category === null || !$overlayCategories[overlay.category]
        }
        return overlay.category === activeCategory
    })

    // Filter overlays by search
    $: filteredOverlays = categoryFilteredOverlays.filter(overlay => {
        if (!searchValue) return true
        return (overlay.name || "").toLowerCase().includes(searchValue.toLowerCase())
    })

    // Sort overlays by name
    $: sortedOverlays = [...filteredOverlays].sort((a, b) => (a.name || "").localeCompare(b.name || ""))

    // Toggle overlay on/off
    function toggleOverlay(overlayId: string) {
        if (isOverlayActive(overlayId)) {
            // Overlay is active, deactivate it
            send("API:clear_overlay", { id: overlayId })
        } else {
            // Overlay is inactive, activate it
            send("API:id_select_overlay", { id: overlayId })
        }
        // Request updated cleared state
        setTimeout(() => send("API:get_cleared"), 100)
    }

    // Check if overlay is currently active
    function isOverlayActive(overlayId: string): boolean {
        return activeOverlayIds.includes(overlayId)
    }

    // Loading state
    let loadingStarted = false
    onMount(() => {
        loadingStarted = true
        // Request current state
        send("API:get_cleared")
    })
</script>

<div class="scroll-container">
    <div class="column">
        {#if overlaysList.length}
            {#if overlaysList.length < 20 || loadingStarted}
                {#if sortedOverlays.length}
                    <div class="grid">
                        {#each sortedOverlays as overlay}
                            {@const isActive = isOverlayActive(overlay.id)}
                            <div class="overlay-card" class:active={isActive}>
                                <MaterialButton style="width: 100%; height: 100%; padding: 0; flex-direction: column; border-radius: 8px; overflow: hidden;" {isActive} on:click={() => toggleOverlay(overlay.id)} title={overlay.name || translate("main.unnamed", $dictionary)}>
                                    <div class="preview">
                                        <Zoomed center {resolution} background={overlay.items?.length ? "var(--primary);" : overlay.color || "var(--primary);"} checkered={!!overlay.items?.length}>
                                            {#each overlay.items || [] as item}
                                                <Textbox {item} />
                                            {/each}
                                        </Zoomed>

                                        <!-- Play/Stop icon overlay -->
                                        <div class="overlay-icon" class:visible={isActive}>
                                            <Icon id={isActive ? "clear" : "play"} size={2} white />
                                        </div>
                                    </div>

                                    <div class="label">
                                        {#if overlay.isDefault}
                                            <Icon id="protected" style="opacity: 0.6; margin-inline-start: 3px; position: absolute; left: 0;" size={0.6} white />
                                        {/if}
                                        <span class="name">{overlay.name || translate("main.unnamed", $dictionary)}</span>
                                    </div>
                                </MaterialButton>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <Center faded>{translate("empty.search", $dictionary)}</Center>
                {/if}
            {:else}
                <Center faded>{translate("remote.loading", $dictionary)}</Center>
            {/if}
        {:else}
            <Center faded>{translate("empty.general", $dictionary)}</Center>
        {/if}
    </div>
</div>

<style>
    .scroll-container {
        overflow-y: auto;
        flex: 1;
        height: 100%;
    }

    .column {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--primary-darker);
        padding-bottom: 60px;
    }

    .grid {
        display: flex;
        flex-wrap: wrap;
        padding: 8px;
        gap: 8px;
    }

    .overlay-card {
        width: calc(20% - 6.4px);
        min-width: 120px;
        /* aspect-ratio: 16/9; */
        border-radius: 8px;
        overflow: hidden;
        position: relative;
        background-color: var(--primary);
        transition: outline 0.15s ease;
        display: flex;
        flex-direction: column;
    }

    .overlay-card.active {
        outline: 2px solid var(--secondary);
        outline-offset: -1px;
    }

    .overlay-card :global(button) {
        background-color: transparent !important;
    }

    .overlay-card:hover :global(button) {
        background-color: rgb(255 255 255 / 0.05) !important;
    }

    .preview {
        position: relative;
        width: 100%;
        /* flex: 1; */
        aspect-ratio: 16/9;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }

    .overlay-icon {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        opacity: 0;
        transition: opacity 0.2s ease;
        pointer-events: none;
        z-index: 1;
    }

    .overlay-card:hover .overlay-icon {
        opacity: 0.6;
    }

    .overlay-icon.visible {
        opacity: 0.8;
    }

    .label {
        position: relative;
        display: flex;
        align-items: center;
        background-color: var(--primary-darkest);

        font-size: 0.8em;
        /* font-weight: bold; */

        height: 25px;
        flex: 1;

        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;

        width: 100%;
        text-align: center;
        padding: 4px 5px;
        padding-bottom: 3px;
    }

    .name {
        width: 100%;
        margin: 0 5px;
        text-align: center;
        overflow-x: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* Responsive grid */
    @media (max-width: 600px) {
        .overlay-card {
            width: calc(33.333% - 6px);
        }
    }

    @media (min-width: 900px) {
        .overlay-card {
            width: calc(16.666% - 6.7px);
        }
    }

    @media (min-width: 1200px) {
        .overlay-card {
            width: calc(12.5% - 7px);
        }
    }
</style>
