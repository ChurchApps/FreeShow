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

    export let item: Item
    export let index: number
    export let ratio: number

    const actions = {
        transition: { label: "popup.transition", icon: "transition" },
        showTimer: { label: "actions.show_timer", icon: "time_in" },
        hideTimer: { label: "actions.hide_timer", icon: "time_out" },
    }

    // bindings
    function removeBindings() {
        menuClick("bind_item")
    }

    // actions
    function removeAction(action) {
        // TODO: this is a duplicate of SetTime and other places
        let layoutRef: any[] = _show().layouts("active").ref()[0] || []
        let slideRef: any = layoutRef[$activeEdit.slide!] || {}
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
                location: { page: "edit", id: $activeEdit.type + "_items", override: "deleteitemaction_" + index },
            })

            return
        }

        history({
            id: "setItems",
            newData: { style: { key: "actions", values: [actions] } },
            location: { page: "edit", show: $activeShow!, slide: slideRef.id, items: [index], override: "deleteitemaction_" + slideRef.id + "_items_" + index },
        })
    }
</script>

<Movebox {ratio} active={$activeEdit.items.includes(index)} />

<div class="actions">
    <!-- localization -->
    {#if item.language}
        <div title={isoLanguages.find((a) => a.code === item.language)?.name} class="actionButton" style="zoom: {1 / ratio};left: 0;right: unset;">
            <span style="padding: 5px;z-index: 3;font-size: 0;">
                <Icon id="translate" white />
            </span>
        </div>
    {/if}

    <!-- bindings -->
    {#if item.bindings?.length}
        <div title={$dictionary.actions?.remove_binding} class="actionButton" style="zoom: {1 / ratio};left: 0;right: unset;">
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

    <!-- actions -->
    {#if item.actions}
        {#each Object.keys(item.actions) as action}
            <div title={actions[action] ? $dictionary[actions[action].label.split(".")[0]]?.[actions[action].label.split(".")[1]] : ""} class="actionButton" style="zoom: {1 / ratio};left: 0;right: unset;">
                <Button on:click={() => removeAction(action)} redHover>
                    <Icon id={actions[action]?.icon} white />
                </Button>
                {#if typeof item.actions[action] === "number"}
                    <span class="actionValue">{item.actions[action]}s</span>
                {/if}
            </div>
        {/each}
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
