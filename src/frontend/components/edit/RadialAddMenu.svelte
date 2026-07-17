<script lang="ts">
    import { uid } from "uid"
    import type { StageItem } from "../../../types/Stage"
    import { activeEdit, activePage, activePopup, activeStage, dictionary, selected, stageShows } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import { getLikelyPosition } from "./scripts/autoPosition"
    import { addItem, updateSortedStageItems } from "./scripts/itemHelpers"
    import { slideItems, stageItems } from "./values/items"

    export let isLocked = false

    let isOpen = false
    let isSnapping = false
    let editorWidth = 600
    const radius = 145

    $: isList = editorWidth < 520
    $: isStage = $activePage === "stage"

    $: stageId = $activeStage.id || ""
    $: stageShow = $stageShows[stageId] || {}
    $: slideTextItemsCount = Object.values(stageShow.items || {}).filter((a) => a.type === "slide_text").length

    $: menuItems = isStage
        ? stageItems.map((item) => {
              if (item.id === "slide_text") {
                  return {
                      ...item,
                      label: slideTextItemsCount === 1 ? "stage.next_slide_text" : "items.slide_text",
                      suffix: slideTextItemsCount > 1 ? ` (+${slideTextItemsCount})` : ""
                  }
              }
              return item
          })
        : slideItems

    $: rightItems = isStage ? ["text", "media", "camera", "web"] : ["media", "camera", "web", "table", "chart", "events"]
    $: leftItems = isStage ? ["timer", "clock", "slide_tracker", "metronome", "visualizer"] : ["timer", "clock", "slide_tracker", "weather", "visualizer", "captions"]

    function getItemCoords(id: string) {
        if (isStage ? id === "slide_text" : id === "text") {
            return { x: 0, y: -radius }
        }
        if (isStage ? id === "current_output" : id === "icon") {
            return { x: 0, y: radius }
        }
        if (rightItems.includes(id)) {
            const idx = rightItems.indexOf(id)
            const count = rightItems.length
            const angle = -Math.PI / 3 + (idx * ((2 * Math.PI) / 3)) / (count - 1)
            return {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            }
        }
        if (leftItems.includes(id)) {
            const idx = leftItems.indexOf(id)
            const count = leftItems.length
            const angle = Math.PI + Math.PI / 3 - (idx * ((2 * Math.PI) / 3)) / (count - 1)
            return {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            }
        }
        return { x: 0, y: 0 }
    }

    let lastClickTime = 0

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
        isSnapping = true
        isOpen = false

        if (isStage) {
            addStageItem(type)
        } else {
            if (type === "icon") {
                selected.set({ id: "slide_icon", data: [{ ...$activeEdit }] })
                activePopup.set("icon")
            } else {
                const textVal = type === "text" && $activeEdit.type === "template" ? translateText("example.text", $dictionary) : ""
                if (type === "text") {
                    addItem(type, null, {}, textVal)
                } else {
                    addItem(type)
                }
            }
        }

        setTimeout(() => {
            isSnapping = false
        }, 100)
    }

    function toggleMenu() {
        const now = Date.now()
        if (isOpen && now - lastClickTime < 300) {
            handleAdd(isStage ? "slide_text" : "text")
            return
        }
        lastClickTime = now
        isOpen = !isOpen
    }

    function handleDoubleClick() {
        handleAdd(isStage ? "slide_text" : "text")
    }

    function handleWindowClick(e: MouseEvent) {
        if (!isOpen) return
        const target = e.target as HTMLElement
        const container = document.querySelector(".radial-container")
        if (container && !container.contains(target)) {
            isOpen = false
        }
    }
</script>

<svelte:window on:click={handleWindowClick} />

<div class="editor-width-tracker" bind:clientWidth={editorWidth}></div>

{#if !isLocked && (isStage ? $activeStage.id : $activeEdit.slide !== undefined || $activeEdit.type === "overlay" || $activeEdit.type === "template")}
    <div class="radial-backdrop" class:show={isOpen} class:snap={isSnapping} on:click|stopPropagation={toggleMenu} role="none"></div>

    {#if isOpen}
        <div class="radial-click-detector" on:click|stopPropagation={toggleMenu} role="none"></div>
    {/if}

    <div class="radial-container" class:open={isOpen} class:snap={isSnapping} class:is-list={isList}>
        {#if isOpen}
            <div class="radial-items">
                {#each menuItems as item, index}
                    {@const coords = getItemCoords(item.id)}
                    {@const positionClass = (isStage ? item.id === "slide_text" : item.id === "text") ? "top" : (isStage ? item.id === "current_output" : item.id === "icon") ? "bottom" : rightItems.includes(item.id) ? "right" : "left"}
                    <div class="radial-item-wrapper {positionClass}" class:large={item.isLarge && !isList} style="--x: {coords.x}px; --y: {coords.y}px; --delay: {100 + index * 10}ms;" on:click={() => handleAdd(item.id)} role="button" tabindex="0" on:keydown={(e) => e.key === "Enter" && handleAdd(item.id)}>
                        <MaterialButton class="radial-item-btn" title={item.title || item.label} white>
                            <Icon id={item.icon} size={isList ? 1.2 : item.isLarge ? 2.0 : 1.7} white />
                        </MaterialButton>

                        <span class="radial-item-label">
                            <T id={item.label} />{item.suffix || ""}
                        </span>
                    </div>
                {/each}
            </div>
        {/if}

        <FloatingInputs gradient style="width: 50px; height: 50px; border: none; position: absolute; bottom: 0; right: 0;">
            <MaterialButton class="radial-trigger" on:click={toggleMenu} on:dblclick={handleDoubleClick} title={isOpen ? "actions.close" : "edit.add_items"} white>
                <Icon id="add" size={1.6} white />
            </MaterialButton>
        </FloatingInputs>
    </div>
{/if}

<style>
    .editor-width-tracker {
        position: absolute;
        inset: 0;
        pointer-events: none;
        visibility: hidden;
    }

    .radial-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(8px);
        z-index: 998;
        opacity: 0;
        pointer-events: none;
        transition:
            opacity 0.25s ease,
            backdrop-filter 0.25s ease;
    }

    .radial-backdrop.show {
        opacity: 1;
        pointer-events: auto;
    }

    .radial-backdrop.snap {
        transition: none !important;
        opacity: 0 !important;
        backdrop-filter: none !important;
    }

    .radial-click-detector {
        position: absolute;
        bottom: 12px;
        right: 12px;
        width: 50px;
        height: 50px;
        z-index: 1000;
        pointer-events: auto;
        cursor: pointer;
        background: transparent;
    }

    .radial-container {
        position: absolute;
        bottom: 12px;
        right: 12px;
        width: 50px;
        height: 50px;
        z-index: 999;
        pointer-events: none;
        transition: all 0.25s cubic-bezier(0.25, 1, 0.5, 1);
    }

    .radial-container.snap {
        transition: none !important;
    }

    .radial-container.open:not(.is-list) {
        bottom: 240px;
        right: 240px;
        transform: none;
    }

    .radial-container.open.is-list {
        bottom: 12px;
        right: 12px;
        transform: none;
    }

    .radial-container :global(.row) {
        width: 50px !important;
        height: 50px !important;
        max-width: none !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        pointer-events: none !important;
    }

    :global(button.radial-trigger) {
        width: 50px !important;
        height: 50px !important;
        border-radius: 50% !important;
        padding: 0 !important;
        min-height: unset !important;
        pointer-events: auto !important;
        transition: transform 0.65s cubic-bezier(0.25, 1, 0.5, 1) !important;
    }

    .radial-container.open :global(button.radial-trigger) {
        transform: rotate(135deg) !important;
    }

    :global(button.radial-trigger:not(.contained):not(.isActive):not(:disabled):hover),
    :global(button.radial-trigger:not(.contained):not(.isActive):not(:disabled):active),
    :global(button.radial-trigger:not(.contained):not(.isActive):not(:disabled):active:hover),
    :global(button.radial-trigger:focus),
    :global(button.radial-trigger:focus-visible) {
        background:
            linear-gradient(rgba(25, 25, 35, 0.95), rgba(25, 25, 35, 0.95)) padding-box,
            linear-gradient(160deg, #8000f0 0%, #b300f0 30%, #d100db 60%, var(--secondary) 100%) border-box !important;
        box-shadow: 0 6px 20px rgba(128, 0, 240, 0.3);
    }

    :global(button.radial-trigger:active) {
        transform: scale(0.95) !important;
    }

    /* Radial Layout Items Panel */
    .radial-container:not(.is-list) .radial-items {
        position: absolute;
        top: 25px;
        left: 25px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* List Layout Items Panel */
    .radial-container.is-list .radial-items {
        position: absolute;
        bottom: 60px;
        right: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
        background: rgba(25, 25, 35, 0.95);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        padding: 6px;
        width: 170px;
        max-height: 380px;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        pointer-events: auto;
        animation: fadeInUp 0.15s cubic-bezier(0.25, 1, 0.5, 1) forwards;
    }

    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    /* Radial Layout Wrapper */
    .radial-container:not(.is-list) .radial-item-wrapper {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 56px;
        pointer-events: auto;
        transform: translate(var(--x), var(--y));
        opacity: 0;
        animation: explode 0.12s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        animation-delay: var(--delay);
    }

    /* List Layout Wrapper */
    .radial-container.is-list .radial-item-wrapper {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        width: 100%;
        gap: 12px;
        padding: 6px 10px;
        border-radius: 6px;
        cursor: pointer;
        user-select: none;
        transition: background 0.15s ease;
    }

    .radial-container.is-list .radial-item-wrapper:hover {
        background: rgba(255, 255, 255, 0.08);
    }

    .radial-container.is-list .radial-item-wrapper:active {
        background: rgba(255, 255, 255, 0.12);
    }

    .radial-container:not(.is-list) .radial-item-wrapper.large {
        width: 66px;
        height: 66px;
    }

    /* Radial Layout Button */
    .radial-container:not(.is-list) :global(button.radial-item-btn) {
        width: 100% !important;
        height: 100% !important;
        border-radius: 50% !important;
        background: rgba(35, 35, 45, 0.9) !important;
        border: 1px solid var(--primary-lighter) !important;
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: white !important;
        padding: 0 !important;
        min-height: unset !important;
        transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
    }

    /* List Layout Button */
    .radial-container.is-list :global(button.radial-item-btn) {
        width: 24px !important;
        height: 24px !important;
        min-height: unset !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        pointer-events: none !important;
    }

    .radial-container:not(.is-list) .radial-item-wrapper.large :global(button.radial-item-btn) {
        background: rgba(45, 45, 60, 0.95) !important;
        border-width: 2px !important;
        border-color: var(--primary-light) !important;
    }

    .radial-container:not(.is-list) :global(button.radial-item-btn:not(.contained):not(.isActive):not(:disabled):hover),
    .radial-container:not(.is-list) :global(button.radial-item-btn:not(.contained):not(.isActive):not(:disabled):active),
    .radial-container:not(.is-list) :global(button.radial-item-btn:not(.contained):not(.isActive):not(:disabled):active:hover),
    .radial-container:not(.is-list) :global(button.radial-item-btn:focus),
    .radial-container:not(.is-list) :global(button.radial-item-btn:focus-visible) {
        background: rgba(50, 50, 65, 0.95) !important;
        border-color: var(--primary-light) !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    .radial-container:not(.is-list) .radial-item-wrapper.large :global(button.radial-item-btn:not(.contained):not(.isActive):not(:disabled):hover),
    .radial-container:not(.is-list) .radial-item-wrapper.large :global(button.radial-item-btn:not(.contained):not(.isActive):not(:disabled):active),
    .radial-container:not(.is-list) .radial-item-wrapper.large :global(button.radial-item-btn:not(.contained):not(.isActive):not(:disabled):active:hover),
    .radial-container:not(.is-list) .radial-item-wrapper.large :global(button.radial-item-btn:focus),
    .radial-container:not(.is-list) .radial-item-wrapper.large :global(button.radial-item-btn:focus-visible) {
        background: rgba(60, 60, 80, 0.95) !important;
        border-color: var(--secondary) !important;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
    }

    .radial-container:not(.is-list) :global(.radial-item-btn:active) {
        transform: scale(0.95);
    }

    /* Radial Layout Labels */
    .radial-container:not(.is-list) .radial-item-label {
        position: absolute;
        font-size: 0.72rem;
        font-weight: 500;
        color: #ffffff;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
        white-space: nowrap;
        background: rgba(0, 0, 0, 0.65);
        padding: 2px 6px;
        border-radius: 4px;
        pointer-events: none;
        opacity: 1;
    }

    /* List Layout Labels */
    .radial-container.is-list .radial-item-label {
        font-size: 0.8rem;
        font-weight: 500;
        color: var(--text-light, #eee);
        white-space: nowrap;
        pointer-events: none;
    }

    .radial-container:not(.is-list) .radial-item-wrapper.top .radial-item-label {
        bottom: 100%;
        margin-bottom: 8px;
        left: 50%;
        transform: translateX(-50%);
    }

    .radial-container:not(.is-list) .radial-item-wrapper.bottom .radial-item-label {
        top: 100%;
        margin-top: 8px;
        left: 50%;
        transform: translateX(-50%);
    }

    .radial-container:not(.is-list) .radial-item-wrapper.right .radial-item-label {
        left: 100%;
        margin-left: 8px;
        top: 50%;
        transform: translateY(-50%);
    }

    .radial-container:not(.is-list) .radial-item-wrapper.left .radial-item-label {
        right: 100%;
        margin-right: 8px;
        top: 50%;
        transform: translateY(-50%);
    }

    @keyframes explode {
        0% {
            opacity: 0;
        }
        100% {
            opacity: 1;
        }
    }
</style>
