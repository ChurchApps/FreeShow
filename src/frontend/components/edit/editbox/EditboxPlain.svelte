<script lang="ts">
    import { onDestroy } from "svelte"
    import type { Item } from "../../../../types/Show"
    import { activeEdit, activeShow, outputs, overlays, templates } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { menuClick } from "../../context/menuClick"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getLayoutRef } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import { getStyles } from "../../helpers/style"
    import Button from "../../inputs/Button.svelte"
    import { isoLanguages } from "../../main/popups/localization/isoLanguages"
    import Movebox from "../../system/Movebox.svelte"
    import { isConditionMet } from "../scripts/itemHelpers"
    import { getItemText } from "../scripts/textStyle"

    export let item: Item | null
    export let index: number
    export let ratio: number

    const actions = [
        { id: "transition", label: "popup.transition", icon: "transition" },
        { id: "clickReveal", label: "actions.click_reveal", icon: "click_action", direct: true },
        { id: "lineReveal", label: "actions.line_reveal", icon: "line_reveal", direct: true },
        { id: "showTimer", label: "actions.show_timer", icon: "time_in" },
        { id: "hideTimer", label: "actions.hide_timer", icon: "time_out" }
    ]

    function removeItemValue(valueId: string) {
        let layoutRef = getLayoutRef()
        let slideRef = layoutRef[$activeEdit.slide!] || {}
        let slideItems = _show().get("slides")?.[slideRef.id]?.items || []

        if ($activeEdit.id) getItems()
        function getItems() {
            let slide = {}
            if ($activeEdit.type === "overlay") slide = $overlays
            else if ($activeEdit.type === "template") slide = $templates

            slideItems = slide[$activeEdit.id!]?.items
        }

        if (!slideItems) return

        if ($activeEdit.type === "overlay" || $activeEdit.type === "template") {
            history({
                id: "UPDATE",
                oldData: { id: $activeEdit.id },
                newData: { key: "items", subkey: valueId, data: [undefined], indexes: [index] },
                location: { page: "edit", id: $activeEdit.type + "_items", override: "deleteitem" + valueId + "_" + index }
            })

            return
        }

        history({
            id: "setItems",
            newData: { style: { key: valueId, values: [undefined] } },
            location: { page: "edit", show: $activeShow!, slide: slideRef.id, items: [index], override: "deleteitem" + valueId + "_" + slideRef.id + "_items_" + index }
        })
    }

    // bindings
    function removeBindings() {
        menuClick("bind_item")
    }

    // actions
    function removeAction(action) {
        // TODO: this is a duplicate of SetTime and other places
        let layoutRef = getLayoutRef()
        let slideRef = layoutRef[$activeEdit.slide!] || {}
        let slideItems = _show().get("slides")?.[slideRef.id]?.items || []

        if ($activeEdit.id) getItems()
        function getItems() {
            let slide = {}
            if ($activeEdit.type === "overlay") slide = $overlays
            else if ($activeEdit.type === "template") slide = $templates

            slideItems = slide[$activeEdit.id!]?.items
        }

        if (!slideItems) return

        let actions = clone(slideItems[index].actions)
        delete actions[action]

        if ($activeEdit.type === "overlay" || $activeEdit.type === "template") {
            history({
                id: "UPDATE",
                oldData: { id: $activeEdit.id },
                newData: { key: "items", subkey: "actions", data: [actions], indexes: [index] },
                location: { page: "edit", id: $activeEdit.type + "_items", override: "deleteitemaction_" + index }
            })

            return
        }

        history({
            id: "setItems",
            newData: { style: { key: "actions", values: [actions] } },
            location: { page: "edit", show: $activeShow!, slide: slideRef.id, items: [index], override: "deleteitemaction_" + slideRef.id + "_items_" + index }
        })
    }

    $: styles = getStyles(item?.lines?.[0]?.text?.[0]?.style)
    $: textTransform = !!(styles["text-transform"] && styles["text-transform"] !== "none")

    let updater = 0
    const updaterInterval = setInterval(() => updater++, 3000)
    onDestroy(() => clearInterval(updaterInterval))

    $: showItemState = isConditionMet(item?.conditions?.showItem, getItemText(item), "default", updater)
</script>

<!-- all icons are square, so only corner resizers need to be active -->
<Movebox {ratio} itemStyle={item?.style} active={$activeEdit.items.includes(index)} onlyCorners={item?.type === "icon"} />

<div class="actions">
    <!-- localization -->
    {#if item?.language}
        <div data-title={isoLanguages.find(a => a.code === item.language)?.name || item.language} class="actionButton" style="zoom: {1 / ratio};left: 0;inset-inline-end: unset;">
            <span style="padding: 5px;z-index: 3;font-size: 0;">
                <Icon id="translate" white />
            </span>
        </div>
    {/if}

    <!-- text transform -->
    {#if textTransform}
        <div data-title={translateText("edit.text_transform")} class="actionButton" style="zoom: {1 / ratio};left: 0;inset-inline-end: unset;">
            <span style="padding: 5px;z-index: 3;font-size: 0;">
                <Icon id="capitalize" white />
            </span>
        </div>
    {/if}

    <!-- list mode -->
    {#if item?.list?.enabled}
        <div data-title={translateText("edit.list")} class="actionButton" style="zoom: {1 / ratio};left: 0;inset-inline-end: unset;">
            <span style="padding: 5px;z-index: 3;font-size: 0;">
                <Icon id="list" white />
            </span>
        </div>
    {/if}

    <!-- scrolling -->
    {#if item?.scrolling?.type && item.scrolling.type !== "none"}
        <div data-title={translateText("edit.scrolling")} class="actionButton" style="zoom: {1 / ratio};left: 0;inset-inline-end: unset;">
            <span style="padding: 5px;z-index: 3;font-size: 0;">
                <Icon id="scrolling" white />
            </span>
        </div>
    {/if}

    <!-- button -->
    {#if item?.button?.press || item?.button?.release}
        <div data-title={translateText("popup.action")} class="actionButton" style="zoom: {1 / ratio};left: 0;inset-inline-end: unset;">
            <span style="padding: 5px;z-index: 3;font-size: 0;">
                <Icon id="button" white />
            </span>
        </div>
    {/if}

    <!-- bindings -->
    {#if item?.bindings?.length}
        <div data-title={translateText("actions.remove_binding")} class="actionButton" style="zoom: {1 / ratio};left: 0;inset-inline-end: unset;">
            <Button on:click={removeBindings} redHover>
                <Icon id="bind" white />
            </Button>
            {#if item.bindings.length > 1}
                <span class="actionValue">{item.bindings.length}</span>
            {:else}
                <span class="actionValue">
                    {#if item.bindings[0] === "stage"}
                        <T id="menu.stage" />
                    {:else}
                        {$outputs[item.bindings[0]]?.name}
                    {/if}
                </span>
            {/if}
        </div>
    {/if}

    <!-- conditions -->
    {#if Object.values(item?.conditions || {}).length}
        <div data-title={translateText("actions.conditions")} class="actionButton" style="zoom: {1 / ratio};left: 0;inset-inline-end: unset;background-color: var(--{showItemState ? '' : 'dis'}connected);">
            <Button on:click={() => removeItemValue("conditions")} redHover>
                <Icon id="light" white />
            </Button>
        </div>
    {/if}

    <!-- actions -->
    {#each actions as action}
        {@const actionValue = item ? (action.direct ? item[action.id] : item.actions?.[action.id]) : null}
        {#if actionValue}
            <div data-title={action ? translateText(action.label) : ""} class="actionButton" style="zoom: {1 / ratio};left: 0;inset-inline-end: unset;">
                <Button on:click={() => (action.direct ? removeItemValue(action.id) : removeAction(action.id))} redHover>
                    <Icon id={action?.icon} white />
                </Button>
                {#if typeof actionValue === "number"}
                    <span class="actionValue">{actionValue}s</span>
                {/if}
            </div>
        {/if}
    {/each}

    <!-- gradient -->
    {#if item?.lines?.find(a => a.text?.find(a => a.style?.includes("-gradient")))}
        <div data-title={translateText("popup.color_gradient")} class="actionButton" style="zoom: {1 / ratio};left: 0;inset-inline-end: unset;">
            <span style="padding: 5px;z-index: 3;font-size: 0;">
                <Icon id="color" white />
            </span>
        </div>
    {/if}
</div>

<style>
    .actions {
        position: absolute;
        top: 0;
        left: 0;

        display: flex;
        flex-direction: column;
    }
    .actionValue {
        font-size: small;
        opacity: 0.5;
        font-weight: bold;
        padding: 0 5px;
        text-shadow: none;
    }
    .actionButton {
        display: flex;
        align-items: center;
        background-color: var(--focus);
        color: var(--text);
    }
    .actionButton :global(button) {
        padding: 5px !important;
        z-index: 3;
    }
</style>
