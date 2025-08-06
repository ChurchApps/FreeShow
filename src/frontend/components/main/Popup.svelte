<script lang="ts">
    import { fade, scale } from "svelte/transition"
    import type { Popups } from "../../../types/Main"
    import { activePopup, dictionary, os } from "../../stores"
    import { MENU_BAR_HEIGHT } from "../../utils/common"
    import { popups } from "../../utils/popup"
    import { disablePopupClose } from "../../utils/shortcuts"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"

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
</script>

{#if popupId !== null}
    {#key popupId}
        <div style={isWindows ? `height: calc(100% - ${MENU_BAR_HEIGHT}px);` : null} class="popup" transition:fade={{ duration: 100 }} on:mousedown={mousedown}>
            <!-- class:fill={popupId === "import_scripture"} -->
            <div class="card" transition:scale={{ duration: 200 }}>
                <div style="position: relative;{popupId === 'alert' ? '' : 'border-bottom: 1px solid var(--primary-lighter);'}">
                    <div class="headerContent" style="margin: 10px 20px;position: relative;">
                        {#if popupId !== "alert"}
                            {#key popupId}
                                <h2 style="font-size: 1.38em;"><T id="popup.{popupId}" /></h2>
                            {/key}
                        {/if}

                        {#if popupId !== "alert" && !disablePopupClose.includes(popupId)}
                            <Button class="popup-close" title="{$dictionary.actions?.close} [esc]" on:click={() => activePopup.set(null)}>
                                <Icon id="close" size={1.3} white />
                            </Button>
                        {/if}
                    </div>
                </div>
                <div class="scroll" style="--top-height: {isWindows ? MENU_BAR_HEIGHT : 0}px;">
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
        background-color: rgb(0 0 0 / 0.8);
        /* pointer-events: none; */
        width: 100%;
        height: 100%;
        padding: 20px var(--navigation-width);
        z-index: 5000;

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

        /* border-radius: var(--border-radius); */
        border-radius: 12px;

        /* overflow-y: auto; */
        /* overflow-x: hidden; */

        min-width: 50%;
        min-height: 50px;
        max-width: 100%;
        max-height: 100%;

        border: 2px solid var(--primary-lighter);
    }

    .scroll {
        overflow: auto;
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
    .card :global(.popup-back) {
        position: absolute;
        inset-inline-end: -10px;
        top: 0;
        height: 100%;
        padding: 0.4em !important;
        border-radius: 6px;
        aspect-ratio: 1;
        justify-content: center;
    }

    .card :global(.popup-back) {
        inset-inline-start: 0;

        max-height: 35.2px;
        margin-top: 10px;
        margin-left: 10px;
    }
    .card:has(.popup-back) h2 {
        margin-left: 40px;
    }
</style>
