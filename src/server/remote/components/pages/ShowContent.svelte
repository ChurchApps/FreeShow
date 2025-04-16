<script lang="ts">
    import { active } from "../../util/stores"
    import AudioPreview from "../show/AudioPreview.svelte"
    import OverlayPreview from "../show/OverlayPreview.svelte"
    import Media from "./Media.svelte"
    import PdfPreview from "./PdfPreview.svelte"

    export let tablet: boolean = false

    $: activeShow = $active
</script>

{#if activeShow.type === "image" || activeShow.type === "video"}
    <Media />
{:else if activeShow.type === "audio"}
    <AudioPreview active={activeShow} />
{:else if activeShow.type === "overlay"}
    <OverlayPreview show={activeShow} />
{:else if activeShow.type === "pdf"}
    <PdfPreview active={activeShow} {tablet} />
{:else}
    <p style="text-transform: capitalize;">{activeShow.type}</p>
{/if}
