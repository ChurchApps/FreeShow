<script lang="ts">
    import { fade, scale } from "svelte/transition"
    import type { Popups } from "../../../types/Main"
    import { activePopup, os } from "../../stores"
    import { MENU_BAR_HEIGHT } from "../../utils/common"
    import { popups } from "../../utils/popup"
    import { disablePopupClose } from "../../utils/shortcuts"
    import T from "../helpers/T.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"

    function mousedown(e: any) {
        if (popupId && disablePopupClose.includes(popupId)) return

        if (e.target.classList.contains("popup")) activePopup.set(null)
    }

    // prevent svelte transition lock
    let popupId: Popups | null = null
    let popupTimeout: NodeJS.Timeout | null = null
    $: if ($activePopup !== undefined) updatePopup()
    function updatePopup() {
        if (popupTimeout) return

        popupTimeout = setTimeout(() => {
            popupId = $activePopup
            popupTimeout = null
        }, 100)
    }

    $: isWindows = $os.platform === "win32"

    let scrolled = false
    $: if (popupId === null) scrolled = false
    function scroll(e) {
        scrolled = e.target.scrollTop > 0
    }
</script>

{#if popupId !== null}
    {#key popupId}
        <div style={isWindows ? `height: calc(100% - ${MENU_BAR_HEIGHT}px);` : null} class="popup" transition:fade={{ duration: 100 }} on:mousedown={mousedown}>
            <!-- class:fill={popupId === "import_scripture"} -->
            <div class="card" transition:scale={{ duration: 200 }}>
                <div class="headerContent" style="{popupId === 'alert' ? '' : 'border-bottom: 1px solid var(--primary-lighter);'}{scrolled ? 'box-shadow: 2px 2px 4px 5px rgb(0 0 0 / 0.1);' : ''}">
                    <div class="headerMargin">
                        {#if popupId !== "alert"}
                            {#key popupId}
                                <!-- margin-top: -5px; -->
                                <h2 style="font-size: 1.3em;margin-top: -2px;"><T id="popup.{popupId}" /></h2>
                            {/key}
                        {/if}

                        {#if popupId !== "alert" && !disablePopupClose.includes(popupId)}
                            <MaterialButton class="popup-close" icon="close" iconSize={1.3} title="actions.close [esc]" on:click={() => activePopup.set(null)} />
                        {/if}
                    </div>
                </div>
                <div class="scroll" style="--top-height: {isWindows ? MENU_BAR_HEIGHT : 0}px;" on:scroll={scroll}>
                    <div class="body">
                        <svelte:component this={popups[popupId]} />
                    </div>
                </div>
            </div>
        </div>
    {/key}
{/if}

<style>
    h2 {
        color: var(--text);
    }

    .popup {
        position: absolute;
        background-color: rgb(0 0 0 / 0.55);
        /* pointer-events: none; */
        width: 100%;
        height: 100%;
        padding: 20px var(--navigation-width);
        z-index: 5000;

        backdrop-filter: blur(4px);

        font-size: 1.2em;

        display: flex;
        align-items: center;
        justify-content: center;
    }

    @media screen and (max-width: 1000px) {
        .popup {
            padding: 20px;
            position: absolute;
            inset-inline-start: 50%;
            top: 50%;
            /* 12px for windows menu bar */
            transform: translate(-50%, calc(-50% + 12px));
        }
    }

    .card {
        position: relative;
        background-color: var(--primary);

        /* background-color: rgba(41, 44, 54, 0.8);
        backdrop-filter: blur(4px); */

        /* border-radius: var(--border-radius); */
        border-radius: 10px;

        /* overflow-y: auto; */
        /* overflow-x: hidden; */

        min-width: 50%;
        min-height: 50px;
        max-width: 100%;
        max-height: 100%;

        border: 2px solid var(--primary-lighter);
        box-shadow: 0 0 5px 5px rgb(0 0 0 / 0.2);
    }

    .headerContent {
        position: relative;
        display: flex;

        z-index: 1;

        transition: 0.2s box-shadow ease;

        min-height: 56px;
    }
    .headerMargin {
        margin: 10px 20px;
        position: relative;
        width: 100%;

        display: flex;
        align-items: center;
    }

    .scroll {
        overflow: auto;
        overflow-x: hidden;
        /* 40px(popup margin) - 4px(popup border) - 35.2px(popup header) - 20px(body padding) - 25px(menubar) */
        max-height: calc(100vh - 99.2px - var(--top-height));
    }

    .body {
        display: flex;
        flex-direction: column;
        margin: 20px;
        min-width: 38vw;
    }

    /* .fill {
        width: 100%;
        height: 100%;
    } */

    /* WIP dropdown */
    /* .popup :global(.dropdown) {
        position: fixed !important;
        width: fit-content;
        max-height: 150px;
    } */

    .card :global(.popup-close),
    .card :global(.popup-back),
    .card :global(.popup-options),
    .card :global(.popup-reset) {
        position: absolute;
        inset-inline-end: -10px;
        top: 0;
        height: 100%;
        padding: 0.4em !important;
        border-radius: 4px;
        aspect-ratio: 1;
        justify-content: center;

        z-index: 1;
    }

    .card :global(.popup-back) {
        inset-inline-start: 0;

        max-height: 35.2px;
        margin-top: 10px;
        margin-left: 10px;
    }
    .card:has(.popup-back) h2 {
        margin-left: 35px;
    }

    .card :global(.popup-options) {
        inset-inline-end: 42px;

        max-height: 35.2px;
        margin-top: 10px;
        margin-right: 10px;

        /* overflow: visible; */
    }
    .card :global(.popup-options.active) {
        color: var(--secondary) !important;
        background-color: var(--primary-darkest) !important;
    }

    .card :global(.popup-options .state) {
        position: absolute;
        bottom: 0; /* -1px; */
        right: 0; /* -1px; */

        display: flex;
        align-items: center;
        justify-content: center;

        background-color: var(--primary-darkest);
        color: var(--text);
        padding: 2px;
        border-radius: 50%;

        font-size: 0.65em;
        opacity: 0.8;

        width: 18px;
        height: 18px;

        pointer-events: none;
    }

    .card :global(.popup-reset) {
        inset-inline-end: 85px;

        max-height: 35.2px;
        margin-top: 10px;
        margin-right: 10px;
    }
</style>
