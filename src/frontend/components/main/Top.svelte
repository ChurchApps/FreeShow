<script type="ts">
    import { activeEdit, activeShow, dictionary, os, outputDisplay, saved } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import { displayOutputs } from "../helpers/output"
    import Button from "../inputs/Button.svelte"
    import TopButton from "../inputs/TopButton.svelte"

    export let isWindows: boolean = false
</script>

<div class="top" class:drag={!isWindows}>
    <!-- {#if !isWindows}
    <div class="dragZone" />
    {/if} -->
    <span style="width: 300px;">
        {#if !$saved && $os.platform !== "win32"}
            <div class="unsaved" />
        {/if}
        <!-- logo -->
        <h1 style="align-self: center;width: 100%;padding: 0px 10px;text-align: center;font-size: 1.8em;">FreeShow</h1>
    </span>
    <span>
        <TopButton id="show" />
        <TopButton id="edit" disabled={!$activeShow && !$activeEdit.type && ($activeEdit.slide === undefined || $activeEdit.slide === null)} />
        <!-- <TopButton id="draw" /> -->
        <TopButton id="stage" />
    </span>
    <span style="width: 300px;justify-content: flex-end;">
        <!-- <TopButton id="stage" hideLabel /> -->
        <TopButton id="draw" hideLabel />
        <TopButton id="settings" hideLabel />
        <Button title={$outputDisplay ? $dictionary.menu?._title_display_stop : $dictionary.menu?._title_display} on:click={displayOutputs} class="context #output display {$outputDisplay ? 'on' : 'off'}" red={$outputDisplay}>
            {#if $outputDisplay}
                <Icon id="cancelDisplay" size={1.6} white />
            {:else}
                <Icon id="outputs" size={1.6} white />
            {/if}
        </Button>
    </span>
</div>

<style>
    .top {
        position: relative;
        display: flex;
        justify-content: space-between;
        z-index: 30;
        min-height: 40px;
        height: 40px;

        /* disabled because it's causing unexpected behaviour in Windows 11 */
        /* -webkit-app-region: drag; */
    }
    .top span {
        display: flex;
    }

    .top.drag {
        -webkit-app-region: drag;
    }

    .top.drag :global(button) {
        -webkit-app-region: no-drag;
    }

    /* .dragZone {
        position: absolute;

        display: flex;
        justify-content: space-between;
        background-color: var(--primary-darker);
        width: 100%;
        height: 3px;

        z-index: 2;
        -webkit-app-region: drag;
    } */

    div :global(button.display) {
        display: flex;
        justify-content: center;
        min-width: 60px;
    }

    .unsaved {
        position: absolute;
        left: 0;
        height: 100%;
        width: 5px;
        background-color: rgb(255 0 0 / 0.25);
    }
</style>
