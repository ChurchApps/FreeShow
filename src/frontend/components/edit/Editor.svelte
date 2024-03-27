<script lang="ts">
    import { onMount } from "svelte"
    import { activeEdit, activeShow, drawer, refreshEditSlide } from "../../stores"
    import OverlayEditor from "./editors/OverlayEditor.svelte"
    import SlideEditor from "./editors/SlideEditor.svelte"
    import Splash from "../main/Splash.svelte"
    import EffectEditor from "./editors/EffectEditor.svelte"
    import MediaEditor from "./editors/MediaEditor.svelte"
    import TemplateEditor from "./editors/TemplateEditor.svelte"

    $: showIsActive = $activeShow && ($activeShow.type || "show") === "show"
    $: noEditSlide = $activeEdit.slide === null || $activeEdit.slide === undefined
    $: if (showIsActive && noEditSlide && !$activeEdit.id) activeEdit.set({ slide: 0, items: [] })

    $: if ($refreshEditSlide) {
        setTimeout(() => {
            refreshEditSlide.set(false)
        }, 100)
    }

    onMount(() => {
        // close drawer
        const minHeight = 40
        if ($drawer.height > minHeight) drawer.set({ height: minHeight, stored: $drawer.height })
    })
</script>

{#key $refreshEditSlide}
    {#if $activeEdit.type === "overlay"}
        <OverlayEditor />
    {:else if $activeEdit.type === "template"}
        <TemplateEditor />
    {:else if $activeEdit.type === "effect"}
        <EffectEditor />
    {:else if $activeEdit.type === "media"}
        <MediaEditor />
    {:else if $activeEdit.type === "audio"}
        <!--  -->
    {:else if $activeEdit.slide !== undefined && $activeEdit.slide !== null}
        <SlideEditor />
    {:else}
        <Splash />
    {/if}
{/key}
