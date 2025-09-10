<script lang="ts">
    import { activePopup, saved } from "../../../stores"
    import { closeApp, save, saveComplete } from "../../../utils/save"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    const actions = {
        n: () => activePopup.set(null),
        q: () => closeApp(),
        y: () => ($saved ? saveComplete({ closeWhenFinished: true }) : save(true))
    }

    function keydown(e: KeyboardEvent) {
        if (actions[e.key]) {
            e.preventDefault()
            actions[e.key]()
        }
    }

    // auto close after X seconds if $errorHasOccurred??
</script>

<svelte:window on:keydown={keydown} />

<div class="list">
    <MaterialButton variant="outlined" style="width: 100%;" on:click={() => activePopup.set(null)}>
        <T id="popup.cancel" />
        <span>N</span>
    </MaterialButton>
    {#if $saved}
        <MaterialButton variant="contained" style="margin-top: 8px;width: 100%;" on:click={() => saveComplete({ closeWhenFinished: true })}>
            <T id="main.quit" />
            <span>Y</span>
        </MaterialButton>
    {:else}
        <MaterialButton variant="outlined" style="width: 100%;" on:click={closeApp}>
            <div style="opacity: 0.7;"><T id="popup.quit" /></div>
            <span>Q</span>
        </MaterialButton>
        <MaterialButton variant="contained" style="margin-top: 8px;width: 100%;" on:click={() => save(true)}>
            <T id="popup.save_quit" />
            <span>Y</span>
        </MaterialButton>
    {/if}
</div>

<style>
    .list {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    span {
        display: flex;
        justify-content: end;
        align-items: center;

        position: absolute;
        inset-inline-end: 15px;

        color: var(--text);
        opacity: 0.6;
        font-size: 0.9em;
    }
</style>
