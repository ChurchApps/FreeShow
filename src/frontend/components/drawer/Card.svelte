<script lang="ts">
    import type { Resolution } from "../../../types/Settings"
    import { mediaOptions, outputs, styles } from "../../stores"
    import { triggerClickOnEnterSpace } from "../../utils/clickable"
    import Icon from "../helpers/Icon.svelte"
    import { getResolution } from "../helpers/output"
    import Loader from "../main/Loader.svelte"
    import Label from "./Label.svelte"

    export let loaded = true
    export let preview = false
    export let active = false
    export let outlineColor: string | null = null
    export let label: string
    export let count = 0
    export let renameId = ""
    export let title = ""
    export let mediaData = ""
    export let width = 0
    export let icon: null | string = null
    export let color: null | string = null
    export let white = true
    export let showPlayOnHover = false
    export let checkered = false
    export let mode: "grid" | "list" | "lyrics" = "grid"
    export let resolution: Resolution = getResolution(null, { $outputs, $styles })
    $: resolution = getResolution(resolution, { $outputs, $styles })
    $: mainWidth = width || (mode === "grid" ? 100 / $mediaOptions.columns : 100)
</script>

<!-- display: table; -->
<div class="main" style="{outlineColor ? 'outline: 2px solid ' + outlineColor + ';' : ''}flex-direction: {mode === 'grid' ? 'column' : 'row'};width: {mainWidth}%;" class:preview class:active>
    <div class="over" style="flex-direction: {mode === 'grid' ? 'column' : 'row'};width: 100%;" on:mousedown on:click on:dblclick on:keydown={triggerClickOnEnterSpace} tabindex="0" role="button">
        {#if preview}
            <div class="overlay" />
        {:else}
            <div class="hover overlay" />
        {/if}
        <div data-media={mediaData} class="card {$$props.class || ''}" class:checkered style="{$$props.style || ''};aspect-ratio: {resolution.width}/{resolution.height};" on:mouseenter on:mouseleave on:mousemove>
            {#if !loaded}
                <div class="loader">
                    <Loader />
                </div>
            {:else if showPlayOnHover}
                <div class="overlayIcon">
                    <Icon id={active ? "clear" : "play"} size={2} white />
                </div>
            {/if}
            <slot />
        </div>
        <Label {label} {count} {renameId} {title} {icon} {white} {color} {mode} />
    </div>
</div>

<style>
    .main {
        display: flex;
        padding: 2px;
        position: relative;
    }

    .over {
        display: flex;
        flex-direction: column;
        position: relative;
    }
    .over:hover > .hover {
        /* background-color: var(--primary-lighter); */
        /* filter: brightness(1.1); */
        opacity: 1;
    }
    .hover.overlay {
        opacity: 0;
        /* transition: 0.1s opacity; */
        background-color: rgb(255 255 255 / 0.05);
        position: absolute;
        top: 0;
        left: 0;
    }

    .over:hover > .card .overlayIcon {
        opacity: 0.6;
    }
    .overlayIcon {
        display: flex;
        cursor: pointer;

        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);

        z-index: 1;
        pointer-events: none;

        transition: 0.3s opacity;
        opacity: 0;
    }

    .main.preview {
        outline: 2px solid var(--primary-lighter);
        outline-offset: -1px;
        z-index: 1;
        /* outline: 3px solid var(--primary-lighter);
    outline-offset: -2px;
    outline-offset: -5px; */
    }
    .overlay {
        pointer-events: none;
        position: absolute;
        top: 0;
        left: 0;
        background-color: rgb(0 0 0 / 0.3);
        height: 100%;
        width: 100%;
        z-index: 1;
    }
    .main.active {
        outline: 2px solid var(--secondary);
        outline-offset: -1px;
        z-index: 2;
        /* outline: 3px solid var(--secondary);
    outline-offset: -2px;
    outline-offset: -5px; */
    }

    .main :global(video),
    .main :global(canvas),
    .main :global(img) {
        max-width: 100%;
        max-height: 100%;
        align-self: center;
        pointer-events: none;
    }
    .main :global(.observer) {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
    }

    .card {
        display: flex;
        position: relative;
        /* flex-direction: column; */
        justify-content: center;
        /* aspect-ratio: 16/9; */
        background-color: var(--primary);
    }

    .loader {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }
</style>
