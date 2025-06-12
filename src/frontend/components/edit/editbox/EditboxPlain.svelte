<script lang="ts">
    import type { Item } from "../../../../types/Show"
    import { activeEdit, dictionary, outputs, overlays, templates, activeShow } from "../../../stores"
    import Button from "../../inputs/Button.svelte"
    import Movebox from "../../system/Movebox.svelte"
    import { menuClick } from "../../context/menuClick"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { _show } from "../../helpers/shows"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { isoLanguages } from "../../main/popups/localization/isoLanguages"
    import { getStyles } from "../../helpers/style"
    import { getLayoutRef } from "../../helpers/show"

    export let item: Item
    export let index: number
    export let ratio: number

    const actions = {
        transition: { label: "popup.transition", icon: "transition" },
        showTimer: { label: "actions.show_timer", icon: "time_in" },
        hideTimer: { label: "actions.hide_timer", icon: "time_out" }
    }

    // bindings
    function removeBindings() {
        menuClick("bind_item")
    }

    // conditions
    function removeConditions() {
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
                newData: { key: "items", subkey: "conditions", data: [{}], indexes: [index] },
                location: { page: "edit", id: $activeEdit.type + "_items", override: "deleteitemcondition_" + index }
            })

            return
        }

        history({
            id: "setItems",
            newData: { style: { key: "conditions", values: [{}] } },
            location: { page: "edit", show: $activeShow!, slide: slideRef.id, items: [index], override: "deleteitemcondition_" + slideRef.id + "_items_" + index }
        })
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
</script>

<!-- all icons are square, so only corner resizers need to be active -->
<Movebox {ratio} itemStyle={item?.style} active={$activeEdit.items.includes(index)} onlyCorners={item?.type === "icon"} />

<div class="actions">
    <!-- localization -->
    {#if item?.language}
        <div title={isoLanguages.find((a) => a.code === item.language)?.name || item.language} class="actionButton" style="zoom: {1 / ratio};inset-inline-start: 0;inset-inline-end: unset;">
            <span style="padding: 5px;z-index: 3;font-size: 0;">
                <Icon id="translate" white />
            </span>
        </div>
    {/if}

    <!-- text transform -->
    {#if textTransform}
        <div title={$dictionary.edit?.text_transform} class="actionButton" style="zoom: {1 / ratio};inset-inline-start: 0;inset-inline-end: unset;">
            <span style="padding: 5px;z-index: 3;font-size: 0;">
                <Icon id="capitalize" white />
            </span>
        </div>
    {/if}

    <!-- list mode -->
    {#if item?.list?.enabled}
        <div title={$dictionary.edit?.list} class="actionButton" style="zoom: {1 / ratio};inset-inline-start: 0;inset-inline-end: unset;">
            <span style="padding: 5px;z-index: 3;font-size: 0;">
                <Icon id="list" white />
            </span>
        </div>
    {/if}

    <!-- scrolling -->
    {#if item?.scrolling?.type && item.scrolling.type !== "none"}
        <div title={$dictionary.edit?.scrolling} class="actionButton" style="zoom: {1 / ratio};inset-inline-start: 0;inset-inline-end: unset;">
            <span style="padding: 5px;z-index: 3;font-size: 0;">
                <Icon id="scrolling" white />
            </span>
        </div>
    {/if}

    <!-- button -->
    {#if item?.button?.press || item?.button?.release}
        <div title={$dictionary.popup?.action} class="actionButton" style="zoom: {1 / ratio};inset-inline-start: 0;inset-inline-end: unset;">
            <span style="padding: 5px;z-index: 3;font-size: 0;">
                <Icon id="button" white />
            </span>
        </div>
    {/if}

    <!-- bindings -->
    {#if item?.bindings?.length}
        <div title={$dictionary.actions?.remove_binding} class="actionButton" style="zoom: {1 / ratio};inset-inline-start: 0;inset-inline-end: unset;">
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
        <div title={$dictionary.actions?.conditions} class="actionButton" style="zoom: {1 / ratio};inset-inline-start: 0;inset-inline-end: unset;">
            <Button on:click={removeConditions} redHover>
                <Icon id="light" white />
            </Button>
        </div>
    {/if}

    <!-- actions -->
    {#if item?.actions}
        {#each Object.keys(item.actions) as action}
            <div title={actions[action] ? $dictionary[actions[action].label.split(".")[0]]?.[actions[action].label.split(".")[1]] : ""} class="actionButton" style="zoom: {1 / ratio};inset-inline-start: 0;inset-inline-end: unset;">
                <Button on:click={() => removeAction(action)} redHover>
                    <Icon id={actions[action]?.icon} white />
                </Button>
                {#if typeof item.actions[action] === "number"}
                    <span class="actionValue">{item.actions[action]}s</span>
                {/if}
            </div>
        {/each}
    {/if}

    <!-- gradient -->
    {#if item?.lines?.find((a) => a.text?.find((a) => a.style.includes("-gradient")))}
        <div title={$dictionary.popup?.color_gradient} class="actionButton" style="zoom: {1 / ratio};inset-inline-start: 0;inset-inline-end: unset;">
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
        inset-inline-start: 0;

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
