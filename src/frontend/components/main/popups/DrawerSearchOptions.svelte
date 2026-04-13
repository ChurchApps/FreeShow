<script lang="ts">
    import { activeDrawerTab, os, scriptureSettings } from "../../../stores"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    $: drawerTab = $activeDrawerTab

    $: enterSwapped = $scriptureSettings.enterSwapped

    function swapEnterBehavior() {
        scriptureSettings.update((s) => {
            s.enterSwapped = !s.enterSwapped
            return s
        })
    }

    const ctrl = $os.platform === "darwin" ? "Cmd" : "Ctrl"
    $: addToProjectShortcut = enterSwapped ? `${ctrl} + Enter` : "Enter"
    $: playShortcut = enterSwapped ? "Enter" : `${ctrl} + Enter`
</script>

{#if drawerTab === "scripture"}
    <ul style="list-style-position: inside;margin-bottom: 10px;">
        <li>Press <key class:swapped={enterSwapped}>{addToProjectShortcut}</key> to add to project</li>
        <li>Press <key class:swapped={enterSwapped}>{playShortcut}</key> to play</li>
    </ul>

    <MaterialButton variant="outlined" icon="swap" on:click={swapEnterBehavior}>Swap</MaterialButton>
{/if}

<style>
    key {
        background: var(--primary-darker);
        color: var(--primary-text);

        font-size: 0.9em;
        font-family: monospace;
        text-transform: uppercase;

        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid var(--primary-lighter);
    }

    key.swapped {
        background: var(--secondary);
        color: var(--secondary-text);
    }
</style>
