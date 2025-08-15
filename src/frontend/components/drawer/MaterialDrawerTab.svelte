<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { SelectIds } from "../../../types/Main"
    import { actions, activeActionTagFilter, activeDrawerTab, activeVariableTagFilter, audioPlaylists, drawerTabsData } from "../../stores"
    import { translateText } from "../../utils/language"
    import { getActionIcon } from "../actions/actions"
    import Icon from "../helpers/Icon.svelte"
    import HiddenInput from "../inputs/HiddenInput.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import SelectElem from "../system/SelectElem.svelte"
    import { clone } from "../helpers/array"

    export let category: any

    $: id = category.id
    $: label = category.label
    $: icon = category.icon
    $: action = category.action || ""
    $: count = category.count || 0
    $: readOnly = category.readOnly || false

    export let parentId: string = ""
    export let isSubmenu = false
    $: submenu = category.submenu || {}

    export let active: string
    export let showSelector: boolean = false
    export let selectHandler: null | ((id: string) => void) = null
    export let isSelected: null | ((id: string) => boolean) = null
    // Optional predicate to determine if this item should show a selector
    export let canSelect: null | ((id: string) => boolean) = null

    $: submenuActive = isSubmenu ? $activeActionTagFilter.includes(id) || $activeVariableTagFilter.includes(id) : false
    $: isActive = submenuActive || active === id

    $: drawerId = $activeDrawerTab
    $: selectId = `category_${drawerId}${drawerId === "scripture" ? "___" + icon : ""}` as SelectIds

    const dispatch = createEventDispatcher()
    function click(e: any) {
        const { ctrl, shift } = e.detail
        if (ctrl || shift) return

        // If we're in selection mode (showSelector is true), only handle selection
        if (showSelector && selectHandler) {
            selectHandler(id)
            return
        }

        if (category.openTrigger) category.openTrigger(id)

        drawerTabsData.update((a) => {
            a[drawerId].activeSubTab = parentId || id
            return a
        })
    }

    function rename(e: any) {
        dispatch("rename", { id, value: e.detail.value })
    }

    const defaultFolders = ["all", "unlabeled", "favourites", "effects_library", "effects", "online", "screens", "cameras", "microphones", "audio_streams"]
    const tabsWithCategories = ["shows", "media", "audio", "overlays", "templates", "scripture"]

    $: noEdit = !tabsWithCategories.includes(drawerId) || defaultFolders.includes(id)
    $: className = noEdit ? "" : $audioPlaylists[id] ? "context #playlist" : `context #category_${drawerId}_button${readOnly ? "_readonly" : ""}`

    // SUB MENU

    $: openedSubmenus = $drawerTabsData[drawerId]?.openedSubmenus || []
    $: submenuOpened = openedSubmenus.includes(id)

    function openSubMenu() {
        drawerTabsData.update((a) => {
            if (!a[drawerId]) return a
            let opened = clone(openedSubmenus)

            let existingIndex = opened.findIndex((menuId) => menuId === id) ?? -1
            if (existingIndex < 0) opened.push(id)
            else {
                opened.splice(existingIndex, 1)
                delete a[drawerId].activeSubmenu
                if (category.openTrigger) category.openTrigger(id)
            }

            a[drawerId].openedSubmenus = opened
            return a
        })
    }
</script>

<SelectElem style="width: 100%;" id={selectId} selectable={!noEdit} borders="center" trigger="column" data={id}>
    <MaterialButton class={className} style="width: 100%;font-weight: normal;padding: 0.2em 0.8em;" {isActive} on:click={click}>
        <div style="max-width: 85%;" data-title={translateText(label)}>
            {#if showSelector && (!canSelect || canSelect(id))}
                <input type="checkbox" style="margin-right:8px;" checked={isSelected ? isSelected(id) : false} on:change={() => selectHandler?.(id)} />
            {/if}
            <Icon style={isSubmenu ? `color: ${category.color};` : ""} id={icon} white={isActive || isSubmenu} />
            {#if noEdit || isSubmenu}
                <p style="margin: 5px;">
                    {#if label}
                        {translateText(label)}
                    {:else}
                        <span style="opacity: 0.5;font-style: italic;pointer-events: none;">{translateText("main.unnamed")}</span>
                    {/if}
                </p>
            {:else}
                <HiddenInput value={translateText(label)} id="category_{drawerId}_{id}" on:edit={rename} />
            {/if}
        </div>

        {#if action && $actions[action]}
            <span style="padding: 0 5px;" data-title={$actions[action].name}>
                <Icon id={getActionIcon(action)} size={0.8} white />
            </span>
        {/if}

        {#if count}
            <span class="count">{count}</span>
        {/if}

        <!-- SUB MENU -->
        {#if !isSubmenu && submenu?.options?.length}
            <MaterialButton on:click={openSubMenu} style="border-left: 1px solid var(--primary-lighter);padding: 0.8em;position: absolute;right: 0;">
                {#if submenuOpened}
                    <Icon id="arrow_down" size={1.4} />
                {:else}
                    <Icon id="arrow_right" size={1.4} white />
                {/if}
            </MaterialButton>
        {/if}
    </MaterialButton>
</SelectElem>

{#if !isSubmenu && submenuOpened && submenu?.options?.length}
    <div class="submenus">
        {#each submenu.options as option}
            <svelte:self parentId={id} category={option} {active} isSubmenu />
        {/each}
    </div>
{/if}

<style>
    div {
        display: flex;
        align-items: center;
        gap: 10px;

        width: 100%;
    }

    div :global(input) {
        padding: 6.5px;
    }

    .count {
        opacity: 0.5;
        font-size: 0.8em;
        min-width: 28px;
        text-align: end;
    }

    .submenus {
        border-top: 1px solid var(--primary-lighter);
        box-shadow: inset 0 6px 5px -6px rgb(0 0 0 / 0.4);

        /* margin-left: 20px; */
        border-inline-start: 8px solid var(--primary-darkest);

        display: flex;
        flex-direction: column;
        gap: 0;
    }
</style>
