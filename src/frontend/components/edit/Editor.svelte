<script lang="ts">
    import { onMount } from "svelte"
    import { activeEdit, activeShow, drawer, focusMode, refreshEditSlide, showsCache, textEditActive } from "../../stores"
    import Splash from "../main/Splash.svelte"
    import EffectEditor from "./editors/EffectEditor.svelte"
    import MediaEditor from "./editors/MediaEditor.svelte"
    import OverlayEditor from "./editors/OverlayEditor.svelte"
    import SlideEditor from "./editors/SlideEditor.svelte"
    import TemplateEditor from "./editors/TemplateEditor.svelte"
    import TextEditor from "../show/TextEditor.svelte"

    $: if ($refreshEditSlide) {
        setTimeout(() => {
            refreshEditSlide.set(false)
        }, 100)
    }

    onMount(() => {
        // close drawer
        const minHeight = 40
        if ($drawer.height > minHeight) drawer.set({ height: minHeight, stored: $drawer.height })

        // mainly for overlay preview
        if ($activeShow?.id && ($activeShow.type || "show") !== "show" && (!$activeEdit.id || $activeEdit.type === $activeShow.type)) {
            activeEdit.set({ id: $activeShow.id, type: $activeShow.type, items: [] } as any)
        }
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
        {#if $textEditActive && !$focusMode}
            <TextEditor currentShow={$showsCache[$activeShow?.id || ""]} />
        {:else}
            <SlideEditor />
        {/if}
    {:else}
        <Splash />
    {/if}
{/key}
