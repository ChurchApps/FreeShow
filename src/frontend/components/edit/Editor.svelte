<script lang="ts">
    import { activeEdit, activeShow } from "../../stores"
    import OverlayEditor from "../edit/OverlayEditor.svelte"
    import SlideEditor from "../edit/SlideEditor.svelte"
    import Splash from "../main/Splash.svelte"
    import EffectEditor from "./EffectEditor.svelte"
    import MediaEditor from "./MediaEditor.svelte"
    import TemplateEditor from "./TemplateEditor.svelte"

    // $: if ($activeShow && $activeEdit.id) activeEdit.set({ slide: 0, items: [] })
    // TODO: check if slide 0 exists
    $: if ($activeShow && ($activeShow.type === undefined || $activeShow.type === "show") && ($activeEdit.slide === null || $activeEdit.slide === undefined) && !$activeEdit.id) activeEdit.set({ slide: 0, items: [] })
</script>

<!-- TODO: activeEdit, edit overlays, templates, ... -->
{#if $activeEdit.type === "overlay"}
    <OverlayEditor />
{:else if $activeEdit.type === "template"}
    <TemplateEditor />
{:else if $activeEdit.type === "effect"}
    <EffectEditor />
{:else if $activeShow?.type === "image" || $activeShow?.type === "video" || $activeEdit.type === "media"}
    <MediaEditor />
{:else if $activeEdit.type === "audio"}
    <!--  -->
{:else if $activeEdit.slide !== undefined && $activeEdit.slide !== null}
    <SlideEditor />
{:else}
    <Splash />
{/if}

<style>
</style>
