<script lang="ts">
    import { addCanvaPresentationAsShow } from "../../../converters/canvaPresentation"
    import { activeCanvaPresentation } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Center from "../../system/Center.svelte"
    import InfoMetadata from "./InfoMetadata.svelte"

    $: selectedPresentation = $activeCanvaPresentation
    $: presentationInfo = [
        { label: "info.type", value: "media.presentation" },
        { label: "canva.design_id", value: selectedPresentation?.designId },
        { label: "export.slides", value: selectedPresentation?.slideCount }
    ]

    function convertPresentation() {
        if (!selectedPresentation) return
        addCanvaPresentationAsShow(selectedPresentation)
    }
</script>

<div class="scroll">
    {#if selectedPresentation}
        {#if selectedPresentation.thumbnail}
            <img class="thumbnail" src={selectedPresentation.thumbnail} alt={selectedPresentation.presentationName} />
        {/if}

        <InfoMetadata title={selectedPresentation.presentationName} info={presentationInfo} />

        <div class="actions">
            <MaterialButton variant="outlined" icon="slide" title="new.show_convert" on:click={convertPresentation}>
                <T id="new.show_convert" />
            </MaterialButton>
        </div>
    {:else}
        <Center style="opacity: 0.35;">
            <T id="canva.select_presentation" />
        </Center>
    {/if}
</div>

<style>
    .scroll {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 10px;
    }

    .thumbnail {
        width: 100%;
        max-height: 150px;
        object-fit: cover;
        border-radius: 4px;
        margin-bottom: 10px;
        background-color: var(--primary-darker);
    }

    .actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin: 10px 5px;
    }
</style>
