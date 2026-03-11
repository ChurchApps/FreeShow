<script lang="ts">
    import { active, activeShow, shows } from "../../util/stores"
    import AudioPreview from "../show/AudioPreview.svelte"
    import OverlayPreview from "../show/OverlayPreview.svelte"
    import Media from "./Media.svelte"
    import PdfPreview from "./PdfPreview.svelte"

    export let tablet: boolean = false

    let currentShow: any = null

    // `active` contains just {id,type} and is set when you click a show/project entry.
    // `activeShow` is populated by the server when it responds to a SHOW message and contains
    // the full show object (including media paths) which we need for PDF thumbnails.
    $: activeRef = $active
    $: serverShow = $activeShow

    // fall back to shows store (trimmed list) if server hasn't sent the full show yet
    // always ensure we carry the type hint from activeRef so `currentShow.type` is never undefined
    $: {
        let base: any = serverShow || $shows.find((s: any) => s.id === activeRef?.id) || { id: activeRef?.id, type: activeRef?.type }
        if (base) {
            if (!base.type && activeRef?.type) base.type = activeRef.type
            currentShow = base
        } else {
            currentShow = null
        }
    }

</script>

<div class="content-page">
    {#if currentShow?.name}
        <h2 class="header">{currentShow.name}</h2>
    {/if}

    <div class="content-body">
        {#if currentShow?.type === "image" || currentShow?.type === "video"}
            <Media />
        {:else if currentShow?.type === "audio"}
            <AudioPreview active={currentShow} />
        {:else if currentShow?.type === "overlay"}
            <OverlayPreview show={currentShow} />
        {:else if currentShow?.type === "pdf"}
            <PdfPreview active={currentShow} {tablet} />
        {:else if currentShow?.type === "player"}
            <Media />
        {:else}
            <p class="fallback">{currentShow?.type}</p>
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

