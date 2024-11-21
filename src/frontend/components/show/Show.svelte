<script lang="ts">
    import { activeShow } from "../../stores"
    import { createGlobalTimerFromLocalTimer } from "../drawer/timers/timers"
    import Splash from "../main/Splash.svelte"
    import Layouts from "../slide/Layouts.svelte"
    import AudioPreview from "./AudioPreview.svelte"
    import MediaPreview from "./media/MediaPreview.svelte"
    import OverlayPreview from "./overlay/OverlayPreview.svelte"
    import PdfPreview from "./pdf/PdfPreview.svelte"
    import PowerPointPreview from "./ppt/PowerPointPreview.svelte"
    import Section from "./Section.svelte"
    import Slides from "./Slides.svelte"

    $: show = $activeShow

    // check for timer & create global
    $: if (show?.id) createGlobalTimerFromLocalTimer(show?.id)
</script>

<div id="showArea" class="main">
    {#if show}
        {#if show.type === "video" || show.type === "image" || show.type === "player"}
            <MediaPreview />
        {:else if show.type === "audio"}
            <AudioPreview active={$activeShow} />
        {:else if show.type === "section"}
            <Section section={show} />
        {:else if show.type === "overlay"}
            <OverlayPreview {show} />
        {:else if show.type === "pdf"}
            <PdfPreview {show} />
        {:else if show.type === "ppt"}
            <PowerPointPreview {show} />
        {:else if (show.type || "show") === "show"}
            <Slides showId={$activeShow?.id || ""} />
            <Layouts />
        {:else}
            <p style="text-align: center;text-transform: capitalize;opacity: 0.8;">{show.type}</p>
        {/if}
    {:else}
        <Splash />
    {/if}
</div>

<style>
    .main {
        height: 100%;
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }
</style>
