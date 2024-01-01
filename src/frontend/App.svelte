<script lang="ts">
    import MainLayout from "./MainLayout.svelte"
    import MainOutput from "./MainOutput.svelte"
    import ContextMenu from "./components/context/ContextMenu.svelte"
    import Pdf from "./components/export/Pdf.svelte"
    import { startEventTimer, startTimer } from "./components/helpers/timerTick"
    import MenuBar from "./components/main/MenuBar.svelte"
    import Popup from "./components/main/Popup.svelte"
    import Recorder from "./components/main/Recorder.svelte"
    import Toast from "./components/main/Toast.svelte"
    import { activeTimers, autosave, closeAd, currentWindow, disabledServers, events, os, outputDisplay } from "./stores"
    import { focusArea, logerror, startAutosave, toggleRemoteStream } from "./utils/common"
    import { keydown } from "./utils/shortcuts"
    import { startup } from "./utils/startup"

    startup()

    $: isWindows = !$currentWindow && $os.platform === "win32"

    ///// UPDATERS /////

    // countdown timer tick
    $: if ($activeTimers.length) startTimer()

    // check for show event
    $: if (Object.keys($events).length) startEventTimer()

    // autosave
    $: if ($autosave) startAutosave()

    // stream to OutputShow
    $: if (!$currentWindow && ($disabledServers.output_stream !== "" || !$outputDisplay)) toggleRemoteStream()

    // close youtube ad
    $: if ($closeAd) setTimeout(() => closeAd.set(false), 10)
</script>

<svelte:window on:keydown={keydown} on:mousedown={focusArea} on:error={logerror} on:unhandledrejection={logerror} />

{#if $currentWindow === "pdf"}
    <Pdf />
{:else}
    {#if isWindows}
        <MenuBar />
    {/if}

    <main style={isWindows ? "height: calc(100% - 30px);" : ""} class:closeAd={$closeAd} class:background={$currentWindow === "output"}>
        <ContextMenu />

        {#if $currentWindow === "output"}
            <MainOutput />
        {:else}
            <!-- WIP black window before output is loaded (don't show app screen when creating output windows) -->
            <!-- {#if !$loaded}<div class="black" />{/if} -->

            <Popup />
            <Toast />
            <Recorder />

            <MainLayout />
        {/if}
    </main>
{/if}

<style>
    main {
        height: 100%;
    }
    main:not(.background) {
        background-color: var(--primary);
    }

    .closeAd {
        height: 1px;
    }

    /* .black {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: black;
        z-index: 500;
    } */
</style>
