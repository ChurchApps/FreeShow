<script lang="ts">
    import { ProjectShowRef } from "../../../../types/Projects"
    import { showsCache } from "../../../stores"
    import AudioPreview from "../AudioPreview.svelte"
    import FolderShow from "../folder/FolderShow.svelte"
    import MediaPreview from "../media/MediaPreview.svelte"
    import OverlayPreview from "../overlay/OverlayPreview.svelte"
    import PdfPreview from "../pdf/PdfPreview.svelte"
    import Slides from "../Slides.svelte"

    export let show: ProjectShowRef
    $: type = show.type
</script>

{#if type === "video" || type === "image" || type === "player"}
    <MediaPreview projectShow={show} />
{:else if type === "audio"}
    <AudioPreview active={show} />
{:else if type === "section"}
    {#if show.notes}
        <p class="notes">{show.notes}</p>
    {/if}
{:else if show.type === "overlay"}
    <div style="height: 250px;">
        <OverlayPreview {show} />
    </div>
{:else if type === "pdf"}
    <PdfPreview {show} index={show.index || 0} />
    <!-- ppt, screen, ndi -->
{:else if type === "folder"}
    <FolderShow path={show.id} index={show.index || 0} />
{:else}
    <Slides showId={show.id} layout={show.layout} projectIndex={show.index} />

    <!-- WIP change layout??? -->
    <!-- <Layouts /> -->
    {#if $showsCache[show.id]?.layouts?.[$showsCache[show.id]?.settings?.activeLayout]?.notes}
        <p class="notes">{$showsCache[show.id]?.layouts?.[$showsCache[show.id]?.settings?.activeLayout]?.notes}</p>
    {/if}
{/if}

<style>
    .notes {
        width: 100%;
        padding: 10px 15px;
    }
</style>
