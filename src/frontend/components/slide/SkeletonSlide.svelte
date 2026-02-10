<script lang="ts">
    import type { Slide } from "../../../types/Show"
    import { slidesOptions } from "../../stores"

    export let slide: Slide
    export let index: number
    export let color: string
    export let columns = 1
    export let active: boolean = false

    // $: isLessons = show?.reference?.type === "lessons"
    $: viewMode = $slidesOptions.mode || "grid"

    $: name = slide.group
</script>

<div class="main" class:active style="width: {viewMode === 'grid' || viewMode === 'simple' || viewMode === 'groups' ? 100 / columns : 100}%;" role="none" on:click>
    {#if viewMode === "lyrics"}
        <div class="label" style="color: {color};margin-bottom: 5px;">
            <span style="color: var(--text);opacity: 0.85;font-size: 0.9em;">{index + 1}</span>
            <span class="text">{@html name === null ? "" : name === "." ? "" : name || "—"}</span>
            <div class="alignment" />
        </div>
    {/if}

    <div class="slide">
        <!-- <div class="loader">
            <Loader size={0.8} />
        </div> -->
    </div>

    {#if viewMode === "simple"}
        <div data-title={name || ""} style="height: 2px;" />
    {:else if viewMode !== "lyrics"}
        <div class="label" style="color: {color};border-bottom: 2px solid {color || 'var(--primary-darkest)'};">
            <span style="color: var(--text);opacity: 0.85;font-size: 0.9em;">{index + 1}</span>
            <span class="text" style={name === null ? "opacity: 0;" : ""}>{@html name === null ? "-" : name === "." ? "" : name || "—"}</span>
            <div class="alignment" />
        </div>
    {/if}
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        position: relative;
        padding: 2px;
    }

    .main.active {
        outline: 2px solid var(--secondary-opacity);
        outline-offset: -1px;
    }

    .slide {
        background-color: black;
        aspect-ratio: 16 / 9;

        /* background-color: var(--primary-darkest); */
        z-index: 0;
        outline-offset: 0;
        width: 100%;

        position: relative;
        display: flex;
    }

    /* .loader {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
    } */

    .label {
        justify-content: space-between;

        position: relative;
        background-color: var(--primary-darkest);
        display: flex;
        padding: 5px;
        padding-bottom: 3px;
        font-size: 0.8em;
        font-weight: bold;
        align-items: center;
    }

    .label .text {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
    }
</style>
