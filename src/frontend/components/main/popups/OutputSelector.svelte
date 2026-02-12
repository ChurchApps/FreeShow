<script lang="ts">
    import { onMount } from "svelte"
    import { OUTPUT } from "../../../../types/Channels"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { activePage, activePopup, currentOutputSettings, outputs, settingsTab } from "../../../stores"
    import { triggerClickOnEnterSpace } from "../../../utils/clickable"
    import { send } from "../../../utils/request"
    import { clone, keysToID } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { translateText } from "../../../utils/language"

    let screens: any[] = []

    // enabled windows on top
    $: outputWindows = keysToID($outputs).sort((a, b) => (a.enabled === b.enabled ? 0 : a.enabled ? 1 : -1))

    let minPosX: number | null = null
    let minPosY: number | null = null
    let totalScreensWidth = 0
    let totalScreensHeight = 0

    onMount(async () => {
        const displays = await requestMain(Main.GET_DISPLAYS)
        let sortedScreens = displays.sort(sortScreensByPosition)
        screens = sortedScreens.sort(internalFirst)

        // get min/max bounds
        minPosX = null
        minPosY = null
        let maxPosX: null | number = null
        let maxPosY: null | number = null
        clone(screens).forEach(({ bounds }) => {
            if (minPosX === null || bounds.x < minPosX) minPosX = bounds.x
            if (minPosY === null || bounds.y < minPosY) minPosY = bounds.y
            if (maxPosX === null || bounds.x + bounds.width > maxPosX) maxPosX = bounds.x + bounds.width
            if (maxPosY === null || bounds.y + bounds.height > maxPosY) maxPosY = bounds.y + bounds.height
        })

        totalScreensWidth = maxPosX !== null && minPosX !== null ? (maxPosX - minPosX) / 2 : 0
        totalScreensHeight = maxPosY !== null && minPosY !== null ? (maxPosY - minPosY) / 2 : 0

        // don't overlap buttons (& allow scroll bars to work)
        totalScreensWidth = Math.min(totalScreensWidth, 4800)
        totalScreensHeight = Math.min(totalScreensHeight, 1000)

        // make all values start at 0
        screens.forEach((a, i) => {
            screens[i].previewBounds = {
                x: a.bounds.x - (minPosX || 0),
                y: a.bounds.y - (minPosY || 0)
            }
        })
    })

    function internalFirst(a, b) {
        return b.internal - a.internal
    }
    function sortScreensByPosition(a, b) {
        let aX = a.bounds.x
        let bX = b.bounds.x

        return aX - bX
    }

    function identifyScreens() {
        send(OUTPUT, ["IDENTIFY_SCREENS"], screens)
    }

    function openOutput(outputId: string) {
        currentOutputSettings.set(outputId)
        settingsTab.set("display_settings")
        activePage.set("settings")
        activePopup.set(null)
    }
</script>

<div class="content">
    {#if screens.length}
        <div class="screens" style="transform: translate(-{totalScreensWidth}px, -{totalScreensHeight}px)">
            {#each screens as screen, i}
                <!-- WIP create output on screen on click if empty -->
                <div class="screen noClick" style="opacity: 0.4;width: {screen.bounds.width}px;height: {screen.bounds.height}px;inset-inline-start: {screen.previewBounds.x}px;top: {screen.previewBounds.y}px;">
                    {i + 1}
                </div>
            {/each}

            {#each outputWindows as currentScreen}
                <div style="opacity: 0.8;position: absolute;width: {currentScreen.bounds?.width}px;height: {currentScreen.bounds?.height}px;inset-inline-start: {currentScreen.bounds?.x - (minPosX ? minPosX : 0)}px;top: {currentScreen.bounds?.y - (minPosY ? minPosY : 0)}px;">
                    <span style="z-index: 2;position: absolute;top: 50%;left: 50%;transform: translate(-50%, -50%);font-size: 0.5em;pointer-events: none;">{currentScreen.name}</span>
                    <!-- Current screen position -->
                    <div data-title={translateText(`main.open: <b>${currentScreen.name}</b>`)} class="screen" style="width: 100%;height: 100%;{currentScreen.screen && screens.find((a) => a.id.toString() === currentScreen.screen) ? 'opacity: 1;' : ''}" on:click={() => openOutput(currentScreen.id)} role="button" tabindex="0" on:keydown={triggerClickOnEnterSpace}></div>
                </div>
            {/each}
        </div>
    {:else}
        <T id="remote.loading" />
    {/if}
</div>

<div class="bottom">
    <MaterialButton variant="outlined" on:click={identifyScreens} title="settings.identify_screens" style="padding: 12px;">
        <Icon id="search" size={1.4} white />
    </MaterialButton>
</div>

<style>
    .content {
        width: 100%;
        display: flex;
        /* justify-content: center; */
        /* transform: translateX(-20%); */
        overflow: auto;

        min-height: 200px;
    }
    .screens {
        --zoom: 0.08;
        zoom: var(--zoom);
        font-size: 20em;
        overflow: visible;
        /* position: relative;
        margin-top: auto; */
        position: absolute;
        left: 50%;
        top: calc(50% + 350px);
        /* transform: translateX(-1080px); */

        /* width: 30%;
    position: absolute;
    left: 50%;
    transform: translateX(-50%); */
    }

    .screens :global(.lock) {
        zoom: calc(1 / var(--zoom));
        position: absolute;
        top: 2px;
        inset-inline-end: 2px;

        /* pointer-events: initial; */
        padding: 5px !important;
        z-index: 2;
    }

    .bottom {
        position: absolute;
        bottom: 20px;
        inset-inline-start: 20px;
    }

    .screen {
        position: absolute;
        /* transform: translateX(-50%); */

        display: flex;
        align-items: center;
        justify-content: center;

        background-color: var(--primary);
        outline: 40px solid var(--secondary);
        transition: background-color 0.1s;
    }

    .screen:hover:not(.disabled):not(.noClick) {
        background-color: var(--primary-lighter);
        cursor: pointer;
    }

    .screen.noClick {
        opacity: 0.5;
        pointer-events: none;
    }

    /* .screen.active, */
    .screen.noClick {
        outline: 40px solid var(--primary-lighter);
        background-color: var(--primary-darker);
        z-index: 1;
    }

    .screen:focus:not(.disabled) {
        outline: 42px solid var(--secondary);
        outline-offset: 0;
    }
</style>
