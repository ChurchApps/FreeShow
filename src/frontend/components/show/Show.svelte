<script lang="ts">
    import { activeProject, activeShow, dictionary, outLocked, projects } from "../../stores"
    import Capture from "../drawer/live/Capture.svelte"
    import NdiStream from "../drawer/live/NDIStream.svelte"
    import { createGlobalTimerFromLocalTimer } from "../drawer/timers/timers"
    import { setOutput } from "../helpers/output"
    import HoverButton from "../inputs/HoverButton.svelte"
    import Splash from "../main/Splash.svelte"
    import Camera from "../output/Camera.svelte"
    import Layouts from "../slide/Layouts.svelte"
    import AudioPreview from "./AudioPreview.svelte"
    import FolderShow from "./folder/FolderShow.svelte"
    import MediaPreview from "./media/MediaPreview.svelte"
    import OverlayPreview from "./overlay/OverlayPreview.svelte"
    import PdfPreview from "./pdf/PdfPreview.svelte"
    import PowerPointPreview from "./ppt/PowerPointPreview.svelte"
    import Section from "./Section.svelte"
    import Slides from "./Slides.svelte"

    $: show = $activeShow

    // check for timer & create global
    $: if (show?.id) createGlobalTimerFromLocalTimer(show?.id)

    $: position = $projects[$activeProject || ""]?.shows?.findIndex((a) => a.id === show?.id)
</script>

<div id="showArea" class="main">
    {#if show}
        {#if show.type === "video" || show.type === "image" || show.type === "player"}
            <MediaPreview />
        {:else if show.type === "audio"}
            <AudioPreview active={$activeShow} />
        {:else if show.type === "section"}
            {#key position !== undefined}
                <!-- update content when moving position in project -->
                <Section section={show} />
            {/key}
        {:else if show.type === "overlay"}
            <OverlayPreview {show} />
        {:else if show.type === "pdf"}
            {#key show}
                <PdfPreview {show} />
            {/key}
        {:else if show.type === "ppt"}
            <PowerPointPreview {show} />
        {:else if show.type === "camera"}
            <HoverButton
                icon="play"
                size={10}
                on:click={() => {
                    if (!$outLocked) setOutput("background", { id: show.id, type: show.type })
                }}
                title={$dictionary.media?.play}
            >
                <Camera id={show.id} groupId={show.data?.groupId} class="media" />
            </HoverButton>
        {:else if show.type === "screen"}
            <HoverButton
                icon="play"
                size={10}
                on:click={() => {
                    if (!$outLocked) setOutput("background", { id: show.id, type: show.type })
                }}
                title={$dictionary.media?.play}
            >
                <Capture screen={{ id: show.id, name: show.name || "" }} streams={[]} background />
            </HoverButton>
        {:else if show.type === "ndi"}
            <HoverButton
                icon="play"
                size={10}
                on:click={() => {
                    if (!$outLocked) setOutput("background", { id: show.id, type: show.type })
                }}
                title={$dictionary.media?.play}
            >
                <NdiStream screen={{ id: show.id, name: show.name || "" }} background />
            </HoverButton>
        {:else if show.type === "folder"}
            {#key show.id}
                <FolderShow path={show.id} index={show.index || 0} />
            {/key}
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
