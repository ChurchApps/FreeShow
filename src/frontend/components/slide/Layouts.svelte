<script lang="ts">
    import { changeSlidesView } from "../../show/slides"
    import { actions, activePopup, activeShow, alertMessage, showsCache, slidesOptions } from "../../stores"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import { getActionIcon, runAction } from "../actions/actions"
    import Icon from "../helpers/Icon.svelte"
    import { _show } from "../helpers/shows"
    import { joinTime, secondsToTime } from "../helpers/time"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialZoom from "../inputs/MaterialZoom.svelte"
    import Reference from "./Reference.svelte"

    $: showId = $activeShow?.id || ""
    $: currentShow = $showsCache[showId] || {}
    $: layouts = currentShow.layouts
    $: activeLayout = currentShow.settings?.activeLayout

    let totalTime = "0s"
    let isTranslated = false
    $: layoutSlides = layouts?.[activeLayout]?.slides || []
    $: if (layoutSlides.length) getTotalTime()
    function getTotalTime() {
        let ref =
            _show()
                .layouts("active")
                .ref()[0]
                ?.filter((a) => a?.data && !a.data.disabled) || []
        let total = ref.reduce((value, slide) => (value += Number(slide?.data?.nextTimer || 0)), 0)

        totalTime = total ? (total > 59 ? joinTime(secondsToTime(total)) : total + "s") : "0s"

        isTranslated = !!layoutSlides.find(
            (a) =>
                a?.id &&
                _show()
                    .slides([a.id])
                    .get("items")
                    ?.flat()
                    ?.find((item) => item?.language)
        )
    }

    $: reference = currentShow.reference

    $: customActionId = currentShow?.settings?.customAction
    $: customAction = customActionId && $actions[customActionId] ? customActionId : ""
    function runCustomAction(edit = false) {
        if (edit || !customAction) {
            activePopup.set("custom_action")
            return
        }

        runAction($actions[customAction], { source: "click" })
    }

    let profile = getAccess("shows")
    $: isLocked = currentShow?.locked || profile.global === "read" || profile[currentShow?.category || ""] === "read"

    $: referenceType = currentShow?.reference?.type
</script>

{#if referenceType === "lessons"}
    <MaterialZoom hidden columns={$slidesOptions.columns} on:change={(e) => slidesOptions.set({ ...$slidesOptions, columns: e.detail })} />
{:else if layoutSlides.length}
    <FloatingInputs arrow={!isLocked} let:open>
        <div slot="menu">
            {#if Object.keys($actions).length && !reference && (!isLocked || customAction)}
                <MaterialButton title="show.custom_action_tip" on:click={() => runCustomAction(true)}>
                    <Icon size={1.1} id="actions" white={!customAction} />
                </MaterialButton>

                <div class="divider" />
            {/if}

            <MaterialButton on:click={() => activePopup.set("translate")} title="popup.translate">
                <Icon size={1.1} id="translate" white={!isTranslated} />
            </MaterialButton>
        </div>

        {#if !open && customAction}
            <MaterialButton style="aspect-ratio: unset;" class="context #edit_custom_action" title="actions.run_action: {$actions[customAction].name}" on:click={() => runCustomAction()}>
                <Icon size={1.1} id={getActionIcon(customAction)} />
                <p>{$actions[customAction].name}</p>
            </MaterialButton>

            <div class="divider" />
        {/if}

        {#if isLocked}
            <MaterialButton
                title="show.locked"
                on:click={() => {
                    alertMessage.set(`${translateText(currentShow?.locked ? "show.locked" : "profile.locked")}<br><br>Unlock it by clicking the three dots in the top right corner.`)
                    activePopup.set("alert")
                }}
            >
                <Icon size={1.1} id="locked" />
            </MaterialButton>
        {:else}
            {#if !open && (isTranslated || referenceType === "scripture")}
                <MaterialButton on:click={() => activePopup.set("translate")} title="popup.translate">
                    <Icon size={1.1} id="translate" white={!isTranslated} />
                </MaterialButton>
            {/if}

            {#if open || totalTime !== "0s" || referenceType !== "scripture"}
                <MaterialButton title="popup.next_timer{totalTime !== '0s' ? ': ' + totalTime : ''} [Ctrl+Shift+D]" on:click={() => activePopup.set("next_timer")}>
                    <Icon size={1.1} id="clock" white={totalTime === "0s"} />
                </MaterialButton>
            {/if}
        {/if}

        {#if open}
            <div class="divider"></div>
        {/if}

        <MaterialZoom hidden={!open} columns={$slidesOptions.columns} on:change={(e) => slidesOptions.set({ ...$slidesOptions, columns: e.detail })} />

        <MaterialButton class="context #slideViews" title="show.change_view: show.{$slidesOptions.mode} [Ctrl+Shift+V]" on:click={changeSlidesView}>
            <Icon size={1.3} id={$slidesOptions.mode} white={$slidesOptions.mode === "grid"} />
        </MaterialButton>
    </FloatingInputs>
{/if}

{#if $slidesOptions.mode !== "simple" && reference}
    <FloatingInputs style="max-width: {referenceType ? 90 : 70}%;" side="left">
        <Reference {showId} show={currentShow} />
    </FloatingInputs>
{/if}

<style>
    div {
        display: flex;
        justify-content: space-between;
        width: 100%;
        /* height: 50px; */
        /* background-color: var(--primary); */
        background-color: var(--primary-darkest);
        /* border-top: 3px solid var(--primary-lighter); */
    }

    /* fixed height for consistent heights */
    div :global(button) {
        min-height: 28px;
        padding: 0 0.8em !important;
    }
    div :global(button.active) {
        /* color: var(--secondary) !important; */
        /* color: rgb(255 255 255 /0.5) !important; */
        background-color: var(--primary) !important;
    }
</style>
