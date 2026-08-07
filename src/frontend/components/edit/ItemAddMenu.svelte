<script lang="ts">
    import { fade } from "svelte/transition"
    import { uid } from "uid"
    import type { StageItem } from "../../../types/Stage"
    import { activeEdit, activePage, activePopup, activeStage, dictionary, selected, stageShows } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import { getDynamicIds, replaceDynamicValues } from "../helpers/showActions"
    import T from "../helpers/T.svelte"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import { getLikelyPosition } from "./scripts/autoPosition"
    import { addItem, updateSortedStageItems } from "./scripts/itemHelpers"
    import { slideItems, stageItems } from "./values/items"

    export let isLocked = false

    let isOpen = false
    let hoveredId: string | null = null
    let hoveredSubmenu: any[] | null = null
    let hoveredY = 0
    let hoverTimeout: any = null
    let delayedHoverTimeout: any = null

    $: isStage = $activePage === "stage"

    $: if (!isOpen) {
        hoveredSubmenu = null
        hoveredId = null
        clearTimeout(delayedHoverTimeout)
    }

    $: stageId = $activeStage.id || ""
    $: stageShow = $stageShows[stageId] || {}
    $: slideTextItemsCount = Object.values(stageShow?.items || {}).filter((a) => a.type === "slide_text").length

    $: groupedItems = (isStage ? stageItems : slideItems).map((group) => {
        return {
            ...group,
            items: group.items.map((item) => {
                if (item.id === "slide_text") {
                    return {
                        ...item,
                        label: slideTextItemsCount === 1 ? "stage.next_slide_text" : "items.slide_text",
                        suffix: slideTextItemsCount > 1 ? ` (+${slideTextItemsCount})` : ""
                    }
                }

                // Stage textbox quick add dynamic values - we can't have all values anyway, this would just be some common ones
                if (item.id === "dynamic_values") {
                    const excludeValues = ["time_", "exif_", "audio_", "meta_", "slide_text_", "show_text_full", "slide_group_text", "slide_group_color", "slide_group_next_color", "slide_group_upcoming_color", "interaction_", "timer_m", "timer_s"]
                    const ref = { type: "stage" }
                    const children = getDynamicIds(false, "dropdown")
                        .filter((id) => !excludeValues.find((v) => id.includes(v)))
                        .map((id) => {
                            const dynamicId = `{${id}}`
                            const value = replaceDynamicValues(dynamicId, ref).slice(0, 30)
                            return {
                                id: dynamicId,
                                label: dynamicId,
                                icon: "",
                                title: `<b>${dynamicId}</b><br>${value}`,
                                data: value
                            }
                        })
                    return { ...item, children }
                }

                return item
            })
        }
    })

    const resolution = { width: 1920, height: 1080 }
    const halfWidth = resolution.width * 0.5
    const halfHeight = resolution.height * 0.5
    const DEFAULT_STYLE = `width: ${halfWidth}px;height: ${halfHeight}px;left: ${halfWidth * 0.5}px;top: ${halfHeight * 0.5}px;`
    const smallItems = ["timer", "clock", "slide_tracker"]

    function addStageItem(itemType: string, textValue = "") {
        if (!stageId) return

        let itemId = uid(5)
        stageShows.update((a) => {
            if (!a[stageId]?.items) return a

            let style = DEFAULT_STYLE
            if (smallItems.includes(itemType) || textValue) {
                const width = resolution.width * 0.45
                const left = halfWidth - width * 0.5
                const height = 150
                const top = halfHeight - height * 0.5
                style = `width: ${width}px;height: ${height}px;left: ${left}px;top: ${top}px;`
            }

            if (Object.keys(a[stageId]?.items).length > 0) {
                style = getLikelyPosition(Object.values(a[stageId].items), style)
            }

            let item: StageItem = { type: itemType as any, style, align: "" }

            if (itemType === "text") item.lines = [{ align: "", text: [{ style: "", value: textValue || "" }] }]
            else if (itemType === "slide_text") {
                const slideTextItems = Object.values(a[stageId].items || {}).filter((a) => a.type === "slide_text")
                item.slideOffset = slideTextItems.length
                item.style += "font-size: 800px;"
            }

            a[stageId].items[itemId] = item
            a[stageId].modified = Date.now()
            return a
        })

        updateSortedStageItems()

        if (Object.keys($stageShows[stageId]?.items || {}).length > 1) {
            activeStage.update((a) => {
                a.items = [itemId]
                return a
            })
        }
    }

    function handleAdd(type: any) {
        isOpen = false

        if (isStage) {
            if (typeof type === "string" && type.startsWith("{")) {
                addStageItem("text", type)
            } else {
                addStageItem(type)
            }
        } else {
            if (type === "icon") {
                selected.set({ id: "slide_icon", data: [{ ...$activeEdit }] })
                activePopup.set("icon")
            } else {
                const textVal = type === "text" && $activeEdit.type === "template" ? translateText("example.text", $dictionary) : ""
                addItem(type, null, {}, textVal)
            }
        }
    }

    function handleDoubleClick() {
        if (isOpen) return
        handleAdd(isStage ? "slide_text" : "text")
    }

    function handleMousedown(e: MouseEvent) {
        if (!isOpen) return
        const target = e.target as HTMLElement
        if (!target.closest(".addMenu") && !target.closest(".addButton")) {
            isOpen = false
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (isOpen && e.key === "Escape") {
            isOpen = false
            e.preventDefault()
            e.stopPropagation()
        }
    }
</script>

<svelte:window on:mousedown={handleMousedown} on:keydown|capture={handleKeydown} />

{#if !isLocked && (isStage ? $activeStage.id : $activeEdit.slide !== undefined || $activeEdit.type === "overlay" || $activeEdit.type === "template")}
    {#if isOpen}
        <div class="addMenu" transition:fade={{ duration: 80 }} style="overflow: visible;">
            <div class="menu-content">
                {#each groupedItems as group, i}
                    {#if group.label}
                        <div class="group-label"><T id={group.label} /></div>
                    {:else if i > 0}
                        <div class="group-spacer" />
                    {/if}

                    {#each group.items as item, j}
                        {@const isFirst = i === 0 && j === 0}
                        <div
                            class="item-wrapper"
                            on:mouseenter={(e) => {
                                clearTimeout(hoverTimeout)
                                clearTimeout(delayedHoverTimeout)

                                const target = e.currentTarget
                                const open = () => {
                                    const rect = target.getBoundingClientRect()
                                    const shell = target.closest(".addMenu")
                                    if (!shell) return

                                    const parentRect = shell.getBoundingClientRect()
                                    hoveredSubmenu = item.children || null
                                    hoveredId = item.id
                                    hoveredY = parentRect.bottom - rect.bottom
                                }

                                if (item.children) {
                                    delayedHoverTimeout = setTimeout(open, 120)
                                } else {
                                    hoveredSubmenu = null
                                    hoveredId = null
                                }
                            }}
                            on:mouseleave={() => {
                                clearTimeout(delayedHoverTimeout)
                                hoverTimeout = setTimeout(() => {
                                    hoveredSubmenu = null
                                    hoveredId = null
                                }, 150)
                            }}
                        >
                            <MaterialButton class="add-item-button" variant={item.children ? "text" : "outlined"} on:click={() => (item.children ? null : handleAdd(item.id))} title={item.title || item.label} white={!isFirst}>
                                <Icon id={item.icon} size={1.2} white={!isFirst} />
                                <T id={item.label} />{item.suffix || ""}
                            </MaterialButton>
                        </div>
                    {/each}
                {/each}
            </div>

            {#if hoveredSubmenu && hoveredSubmenu.length > 0 && hoveredId}
                <div
                    class="addMenu submenu"
                    transition:fade={{ duration: 80 }}
                    style="bottom: {hoveredY - 6}px;"
                    on:mouseenter={() => clearTimeout(hoverTimeout)}
                    on:mouseleave={() => {
                        hoveredSubmenu = null
                        hoveredId = null
                    }}
                >
                    {#each hoveredSubmenu as subItem}
                        <MaterialButton class="add-item-button" variant="outlined" on:click={() => handleAdd(subItem.id)} title={subItem.title || subItem.label} white>
                            {#if subItem.icon}<Icon id={subItem.icon} size={1.2} white />{/if}
                            <span class="item-name">
                                {translateText(subItem.label)}{subItem.suffix || ""}
                            </span>
                            {#if subItem.data}<span class="item-preview">{subItem.data}</span>{/if}
                        </MaterialButton>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}

    <FloatingInputs gradient style="width: 50px;height: 50px;border: none;">
        <MaterialButton class="addButton" title={isOpen ? "actions.close" : "edit.add_items"} style="width: 50px; height: 50px;" on:click={() => (isOpen = !isOpen)} on:dblclick={handleDoubleClick}>
            <Icon id="add" size={1.5} style={isOpen ? "transform: rotate(135deg);" : ""} white />
        </MaterialButton>
    </FloatingInputs>
{/if}

<style>
    .addMenu {
        position: absolute;
        bottom: 70px;
        right: 12px;

        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 160px;

        background: rgba(0, 0, 0, 0.15);
        backdrop-filter: blur(15px);
        border-radius: 25px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 6px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);

        /* over all slide items */
        z-index: 999;
    }

    .menu-content {
        max-height: calc(100vh - 200px);
        overflow-y: auto;
        overflow-x: hidden;
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    /* Thinner scrollbar */
    .menu-content::-webkit-scrollbar,
    .submenu::-webkit-scrollbar {
        width: 5px;
    }

    .addMenu :global(.add-item-button) {
        width: 100%;
        flex-shrink: 0;
        justify-content: start;
        padding: 10px 16px;
        border-radius: 50px;
        min-height: 35px;
        gap: 8px;
    }

    .item-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: left;
    }

    .item-preview {
        font-size: 0.75rem;
        opacity: 0.5;
        max-width: 70px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-left: auto;
    }

    /* remove blur from individual buttons to avoid double blur */
    .addMenu :global(.add-item-button .surface) {
        backdrop-filter: none !important;
        background: rgba(255, 255, 255, 0.03) !important;
    }

    .addMenu :global(.add-item-button:hover) {
        background: rgba(255, 255, 255, 0.1) !important;
    }

    .submenu {
        position: absolute;
        right: calc(100% + 4px);
        width: 260px;
        z-index: 1000;

        /* backdrop blur does not work for this apparently */
        background: rgba(15, 15, 15, 0.7);

        max-height: 45vh;

        overflow-y: auto;
        overflow-x: hidden;
    }

    .item-wrapper {
        position: relative;
        display: flex;
        width: 100%;
    }

    .item-wrapper:hover::before {
        content: "";
        position: absolute;
        left: -15px; /* cover the 12px gap */
        right: 0;
        top: 0;
        bottom: 0;
        pointer-events: all;
        z-index: -1;
    }

    .item-wrapper:hover {
        z-index: 1001; /* Above other menu items */
    }

    .group-label {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--primary-light);
        padding: 8px 10px 4px;
        opacity: 0.8;
    }

    .group-spacer {
        height: 6px;
    }

    /* +/x rotate animation */
    :global(.addButton svg) {
        transition: transform 0.2s ease !important;
    }
</style>
