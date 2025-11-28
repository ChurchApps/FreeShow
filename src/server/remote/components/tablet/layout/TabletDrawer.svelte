<script lang="ts">
    import Icon from "../../../../common/components/Icon.svelte"
    import { drawer, activeDrawerTab, dictionary } from "../../../util/stores"
    import { translate } from "../../../util/helpers"
    import Button from "../../../../common/components/Button.svelte"
    import MaterialButton from "../../MaterialButton.svelte"
    import TabletDrawerNavigation from "./drawer/TabletDrawerNavigation.svelte"
    import TabletDrawerContent from "./drawer/TabletDrawerContent.svelte"
    import Resizeable from "./drawer/Resizeable.svelte"

    const minHeight = 40
    const defaultHeight = 400
    const maxHeight = 800

    $: height = $drawer.height ?? defaultHeight

    let move = false
    let startY = 0
    let startHeight = 0
    let isResizing = false

    function onPointerDown(e: PointerEvent) {
        // Don't start resize if clicking on tabs or search
        if ((e.target as HTMLElement).closest(".tabs") || (e.target as HTMLElement).closest(".search-container")) return

        move = true
        isResizing = true
        startY = e.clientY
        startHeight = height

        // Capture pointer for touch
        const target = e.currentTarget as HTMLElement
        target.setPointerCapture?.(e.pointerId)

        window.addEventListener("pointermove", onPointerMove)
        window.addEventListener("pointerup", onPointerUp)
        window.addEventListener("pointercancel", onPointerUp)
    }

    function onPointerMove(e: PointerEvent) {
        if (!move) return
        e.preventDefault()

        const delta = startY - e.clientY
        let newHeight = startHeight + delta

        if (newHeight < minHeight) newHeight = minHeight
        if (newHeight > maxHeight) newHeight = maxHeight

        drawer.update(d => ({ ...d, height: newHeight }))
    }

    function onPointerUp(e: PointerEvent) {
        const target = e.currentTarget as HTMLElement
        target?.releasePointerCapture?.(e.pointerId)
        move = false
        isResizing = false
        window.removeEventListener("pointermove", onPointerMove)
        window.removeEventListener("pointerup", onPointerUp)
        window.removeEventListener("pointercancel", onPointerUp)
    }

    // Dock button with drag-to-resize
    let dockDragging = false
    let dockStartY = 0
    let dockStartHeight = 0

    function onDockPointerDown(e: PointerEvent) {
        e.stopPropagation()
        dockDragging = false
        isResizing = true
        dockStartY = e.clientY
        dockStartHeight = height

        const target = e.currentTarget as HTMLElement
        target.setPointerCapture?.(e.pointerId)

        window.addEventListener("pointermove", onDockPointerMove)
        window.addEventListener("pointerup", onDockPointerUp)
        window.addEventListener("pointercancel", onDockPointerUp)
    }

    function onDockPointerMove(e: PointerEvent) {
        const delta = dockStartY - e.clientY

        // Start dragging after threshold
        if (Math.abs(delta) > 10) {
            dockDragging = true
        }

        if (dockDragging) {
            e.preventDefault()
            let newHeight = dockStartHeight + delta

            if (newHeight < minHeight) newHeight = minHeight
            if (newHeight > maxHeight) newHeight = maxHeight

            drawer.update(d => ({ ...d, height: newHeight }))
        }
    }

    function onDockPointerUp(e: PointerEvent) {
        const target = e.currentTarget as HTMLElement
        target?.releasePointerCapture?.(e.pointerId)

        // If we didn't drag, treat as toggle click
        if (!dockDragging) {
            toggleDrawer()
        }

        dockDragging = false
        isResizing = false
        window.removeEventListener("pointermove", onDockPointerMove)
        window.removeEventListener("pointerup", onDockPointerUp)
        window.removeEventListener("pointercancel", onDockPointerUp)
    }

    function toggleDrawer() {
        if (height > minHeight) {
            drawer.update(d => ({ ...d, height: minHeight, stored: height }))
        } else {
            drawer.update(d => ({ ...d, height: $drawer.stored || defaultHeight }))
        }
    }

    let searchValue = ""
    let searchElem: HTMLInputElement | undefined

    function clearDrawerSearch() {
        searchValue = ""
        searchElem?.focus()
    }

    function openDrawerTab(tab: string) {
        activeDrawerTab.set(tab)
        if (height <= minHeight) {
            toggleDrawer()
        }
    }
</script>

<div class="drawer" class:resizing={isResizing} style="height: {height}px">
    <div class="top context #drawer_top" on:pointerdown={onPointerDown}>
        <span class="tabs">
            <MaterialButton
                id="shows"
                style="border-radius: 0; border-bottom: 2px solid var(--primary); padding: 0.2em 0.8em;"
                isActive={$activeDrawerTab === "shows"}
                on:click={e => {
                    e.stopPropagation()
                    openDrawerTab("shows")
                }}
            >
                <Icon id="shows" size={1.3} white={$activeDrawerTab === "shows"} />
                <span>{translate("tabs.shows", $dictionary)}</span>
            </MaterialButton>
            <MaterialButton
                id="media"
                style="border-radius: 0; border-bottom: 2px solid var(--primary); padding: 0.2em 0.8em;"
                isActive={$activeDrawerTab === "media"}
                on:click={e => {
                    e.stopPropagation()
                    openDrawerTab("media")
                }}
            >
                <Icon id="media" size={1.3} white={$activeDrawerTab === "media"} />
                <span>{translate("tabs.media", $dictionary)}</span>
            </MaterialButton>
            <MaterialButton
                id="audio"
                style="border-radius: 0; border-bottom: 2px solid var(--primary); padding: 0.2em 0.8em;"
                isActive={$activeDrawerTab === "audio"}
                on:click={e => {
                    e.stopPropagation()
                    openDrawerTab("audio")
                }}
            >
                <Icon id="audio" size={1.3} white={$activeDrawerTab === "audio"} />
                <span>{translate("tabs.audio", $dictionary)}</span>
            </MaterialButton>
            <MaterialButton
                id="overlays"
                style="border-radius: 0; border-bottom: 2px solid var(--primary); padding: 0.2em 0.8em;"
                isActive={$activeDrawerTab === "overlays"}
                on:click={e => {
                    e.stopPropagation()
                    openDrawerTab("overlays")
                }}
            >
                <Icon id="overlays" size={1.3} white={$activeDrawerTab === "overlays"} />
                <span>{translate("tabs.overlays", $dictionary)}</span>
            </MaterialButton>
            <MaterialButton
                id="templates"
                style="border-radius: 0; border-bottom: 2px solid var(--primary); padding: 0.2em 0.8em;"
                isActive={$activeDrawerTab === "templates"}
                on:click={e => {
                    e.stopPropagation()
                    openDrawerTab("templates")
                }}
            >
                <Icon id="templates" size={1.3} white={$activeDrawerTab === "templates"} />
                <span>{translate("tabs.templates", $dictionary)}</span>
            </MaterialButton>
            <MaterialButton
                id="scripture"
                style="border-radius: 0; border-bottom: 2px solid var(--primary); padding: 0.2em 0.8em;"
                isActive={$activeDrawerTab === "scripture"}
                on:click={e => {
                    e.stopPropagation()
                    openDrawerTab("scripture")
                }}
            >
                <Icon id="scripture" size={1.3} white={$activeDrawerTab === "scripture"} />
                <span>{translate("tabs.scripture", $dictionary)}</span>
            </MaterialButton>
            <MaterialButton
                id="calendar"
                style="border-radius: 0; border-bottom: 2px solid var(--primary); padding: 0.2em 0.8em;"
                isActive={$activeDrawerTab === "calendar"}
                on:click={e => {
                    e.stopPropagation()
                    openDrawerTab("calendar")
                }}
            >
                <Icon id="calendar" size={1.3} white={$activeDrawerTab === "calendar"} />
                <span>{translate("tabs.calendar", $dictionary)}</span>
            </MaterialButton>
            <MaterialButton
                id="functions"
                style="border-radius: 0; border-bottom: 2px solid var(--primary); padding: 0.2em 0.8em;"
                isActive={$activeDrawerTab === "functions"}
                on:click={e => {
                    e.stopPropagation()
                    openDrawerTab("functions")
                }}
            >
                <Icon id="functions" size={1.3} white={$activeDrawerTab === "functions"} />
                <span>{translate("tabs.functions", $dictionary)}</span>
            </MaterialButton>
        </span>

        <div class="right-controls">
            <div class="search-container">
                <Icon id="search" size={1.2} white />
                <input bind:this={searchElem} class="search edit" type="text" placeholder={translate("main.search", $dictionary)} bind:value={searchValue} on:click={e => e.stopPropagation()} />
                {#if searchValue.length}
                    <Button
                        class="clear-btn"
                        on:click={e => {
                            e.stopPropagation()
                            searchValue = ""
                            searchElem?.focus()
                        }}
                    >
                        <Icon id="clear" size={1} white />
                    </Button>
                {/if}
            </div>

            <button class="dock-btn" on:pointerdown={onDockPointerDown} title={height > minHeight ? "Minimize drawer (drag to resize)" : "Expand drawer (drag to resize)"}>
                <Icon id={height > minHeight ? "down" : "up"} size={1.4} white />
            </button>
        </div>
    </div>

    <div class="content">
        <Resizeable id="leftPanelDrawer">
            <TabletDrawerNavigation id={$activeDrawerTab} />
        </Resizeable>

        <div class="main-content">
            <TabletDrawerContent id={$activeDrawerTab} {searchValue} on:search-clear={clearDrawerSearch} />
        </div>
    </div>
</div>

<style>
    .drawer {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        background-color: var(--primary);
        z-index: 100;
        display: flex;
        flex-direction: column;
        box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3);
        will-change: height;
    }

    .drawer:not(.resizing) {
        transition: height 0.15s ease-out;
    }

    .top {
        position: relative;
        height: 40px;
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: var(--primary);
        cursor: ns-resize;
        padding: 0;
        padding-right: 10px;
        padding-top: 4px; /* Account for ::after resize handle visual offset */
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
        box-sizing: border-box;

        box-shadow: 0 -1.8px 8px rgb(0 0 0 / 0.2);
        z-index: 1;
    }

    .top::after {
        content: "";
        background-color: var(--primary-lighter);
        position: absolute;
        top: 0;
        width: 100%;
        left: 0;
        height: 4px;
        cursor: ns-resize;
    }

    .tabs {
        display: flex;
        height: 100%;
        overflow-x: auto;
        overflow-y: hidden;
    }

    .tabs :global(button) {
        height: 100%;
        gap: 5px;
    }

    .tabs :global(button.isActive) {
        border-bottom: 2px solid var(--secondary) !important;
    }

    .right-controls {
        display: flex;
        align-items: center;
        height: 100%;
        flex-shrink: 0;
        position: relative;
    }

    .search-container {
        display: flex;
        align-items: center;
        background-color: rgb(0 0 0 / 0.2);
        border-radius: 4px;
        padding: 0 10px;
        height: 28px;
        gap: 8px;
        margin-right: 5px;
    }

    .search {
        background: transparent;
        color: var(--text);
        font-size: inherit;
        font-family: inherit;
        border: none;
        padding: 0;
        width: 120px;
        height: 100%;
    }

    .search:focus {
        outline: none;
    }

    .search::placeholder {
        color: inherit;
        opacity: 0.5;
    }

    .search-container :global(.clear-btn) {
        padding: 2px;
        min-width: auto;
        height: auto;
        opacity: 0.7;
    }

    .search-container :global(.clear-btn:hover) {
        opacity: 1;
    }

    .content {
        flex: 1;
        display: flex;
        overflow: hidden;
        background-color: var(--primary-darker);
    }

    .main-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .right-controls :global(.dock-btn) {
        height: 100%;
        padding: 0 12px;
        border-radius: 0;
        flex-shrink: 0;
    }

    .dock-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        min-width: 48px;
        padding: 0 12px;
        border: none;
        background: transparent;
        cursor: ns-resize;
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
        color: var(--text);
    }

    .dock-btn:hover {
        background-color: rgb(255 255 255 / 0.05);
    }

    .dock-btn:active {
        background-color: rgb(255 255 255 / 0.1);
    }
</style>
