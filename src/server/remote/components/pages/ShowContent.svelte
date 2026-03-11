<script lang="ts">
    import { getFileName, removeExtension } from "../../../common/util/media"
    import { active } from "../../util/stores"
    import AudioPreview from "../show/AudioPreview.svelte"
    import OverlayPreview from "../show/OverlayPreview.svelte"
    import Media from "./Media.svelte"
    import PdfPreview from "./PdfPreview.svelte"

    export let tablet: boolean = false

    $: activeShow = $active

    $: name = removeExtension(getFileName(activeShow?.id) || "")
</script>

<div class="content-page">
    {#if name}
        <h2 class="header">{name}</h2>
    {/if}

    <div class="content-body">
        {#if activeShow.type === "image" || activeShow.type === "video"}
            <Media />
        {:else if activeShow.type === "audio"}
            <AudioPreview active={activeShow} />
        {:else if activeShow.type === "overlay"}
            <OverlayPreview show={activeShow} />
        {:else if activeShow.type === "pdf"}
            <PdfPreview active={activeShow} {tablet} />
        {:else if activeShow.type === "player"}
            <!-- Online media / player content -->
            <Media />
        {:else}
            <p class="fallback">{activeShow?.type}</p>
        {/if}
    </div>
</div>

<style>
    .content-page {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        min-height: 0;
        overflow: hidden;
    }

    .header {
        flex: 0 0 auto;
        margin: 0;
        padding: 0.83em 0;
        font-size: 1rem;
        text-align: center;
    }

    .content-body {
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }

    .fallback {
        margin: 0;
        padding: 12px;
        text-transform: capitalize;
    }
</style>
