<script lang="ts">
    import { fade } from "svelte/transition"
    import { special } from "../../stores"

    export let x = 0
    export let y = 0
    export let visible = false
    export let style = ""
    export let parsed: { text: string; isShortcut: boolean }[] = []

    $: isOptimized = $special.optimizedMode
</script>

{#if visible}
    <div class="tooltip" class:isOptimized style="top: {y}px; left: {x}px; {style}" transition:fade={{ duration: 150 }}>
        {#each parsed as part}
            <span class={part.isShortcut ? "shortcut" : ""}>{@html part.text.replaceAll("\n", "<br>")}</span>
        {/each}
    </div>
{/if}

<style>
    .tooltip {
        position: fixed;

        /* background-color: var(--primary-darkest); */
        background-color: rgba(18, 18, 28, 0.85);
        backdrop-filter: blur(3px);
        border: 1px solid var(--primary-lighter);

        color: var(--text);
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 0.85em;
        z-index: 9999;
        pointer-events: none;
        transform: translate(-50%, -100%);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);

        max-width: 380px;
    }

    .shortcut {
        color: var(--accent);
        font-weight: bold;
        text-transform: uppercase;
    }
</style>
