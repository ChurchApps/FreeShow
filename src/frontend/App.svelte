<script lang="ts">
    import MainLayout from "./MainLayout.svelte"
    import MainOutput from "./MainOutput.svelte"
    import ContextMenu from "./components/context/ContextMenu.svelte"
    import Pdf from "./components/export/Pdf.svelte"
    import Guide from "./components/guide/Guide.svelte"
    import { getContrast } from "./components/helpers/color"
    import { getBlending } from "./components/helpers/output"
    import { checkTimers, startEventTimer, startTimer } from "./components/helpers/timerTick"
    import Loader from "./components/main/Loader.svelte"
    import MenuBar from "./components/main/MenuBar.svelte"
    import Popup from "./components/main/Popup.svelte"
    import ProfileSelector from "./components/main/ProfileSelector.svelte"
    import Recorder from "./components/main/Recorder.svelte"
    import Toast from "./components/main/Toast.svelte"
    import TooltipManager from "./components/main/TooltipManager.svelte"
    import QuickSearch from "./components/quicksearch/QuickSearch.svelte"
    import Center from "./components/system/Center.svelte"
    import { activeProfile, activeTimers, closeAd, currentWindow, disabledServers, events, language, loaded, localeDirection, os, outputDisplay, outputs, profiles, theme, themes, timers } from "./stores"
    import { focusArea, logerror, mainClick, toggleRemoteStream } from "./utils/common"
    import { keydown } from "./utils/shortcuts"
    import { startup } from "./utils/startup"

    startup()

    $: isWindows = !$currentWindow && $os.platform === "win32"

    ///// UPDATERS /////

    // countdown timer tick
    $: if ($activeTimers.length) startTimer()
    $: if (Object.keys($timers).length) checkTimers()

    // check for show event
    $: if (Object.keys($events).length) startEventTimer()

    // stream to OutputShow
    $: if (($loaded && $disabledServers.output_stream !== "") || !$outputDisplay) setTimeout(toggleRemoteStream, 1000)

    // close youtube ad
    $: if ($closeAd) setTimeout(() => closeAd.set(false), 10)

    // edge blending
    let blending = ""
    $: if ($currentWindow === "output" && Object.values($outputs)[0]?.blending) blending = getBlending()

    // set language direction
    $: document.documentElement.setAttribute("dir", $localeDirection)
    $: document.documentElement.setAttribute("lang", $language)

    $: contrastColor = getContrast($themes[$theme]?.colors?.secondary || "")
    $: secondaryContrast = `--secondary-text: ${contrastColor === "#000000" ? "#131313" : "#f0f0ff"};`
    $: globalStyle = `${isWindows ? "height: calc(100% - 25px);" : ""}${secondaryContrast}${blending}`
</script>

<svelte:window on:keydown={keydown} on:mousedown={focusArea} on:click={mainClick} on:error={logerror} on:unhandledrejection={logerror} />

{#if $currentWindow === "pdf"}
    <Pdf />
{:else}
    <!-- "isWindows" is only set in main window -->
    {#if isWindows}
        <MenuBar />
    {/if}

    <main style={globalStyle} class:closeAd={$closeAd} class:background={$currentWindow === "output"}>
        <ContextMenu />
        <TooltipManager />

        {#if $currentWindow === "output"}
            <MainOutput />
        {:else if $loaded && Object.keys($profiles).length && $activeProfile === null}
            <Popup />
            <ProfileSelector />
        {:else if $loaded}
            <Popup />
            <QuickSearch />
            <Toast />
            <Recorder />
            <Guide />

            <MainLayout />
        {:else}
            <Center>
                <Loader size={2} />
            </Center>
        {/if}
    </main>
{/if}

<style>
    main {
        height: 100%;
    }
    main:not(.background) {
        background-color: var(--primary);
        /* background: linear-gradient(130deg, var(--primary) 0%, rgb(42, 44, 62) 100%); */
    }

    .closeAd {
        height: 1px;
    }
</style>
