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

{#if currentShow?.type === "image" || currentShow?.type === "video"}
    <Media />
{:else if currentShow?.type === "audio"}
    <AudioPreview active={currentShow} />
{:else if currentShow?.type === "overlay"}
    <OverlayPreview show={currentShow} />
{:else if currentShow?.type === "pdf"}
    <PdfPreview active={currentShow} {tablet} />
{:else if currentShow?.type === "player"}
    <!-- Online media / player content -->
    <Media />
{:else}
    <p style="text-transform: capitalize;">{currentShow?.type}</p>
{/if}
