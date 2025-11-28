<script lang="ts">
    import Icon from "../../../../common/components/Icon.svelte"
    import { drawer, activeDrawerTab, dictionary } from "../../../util/stores"
    import { translate } from "../../../util/helpers"
    import Button from "../../../../common/components/Button.svelte"
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

    function onPointerDown(e: PointerEvent) {
        move = true
        startY = e.clientY
        startHeight = height
        window.addEventListener("pointermove", onPointerMove)
        window.addEventListener("pointerup", onPointerUp)
    }

    function onPointerMove(e: PointerEvent) {
        if (!move) return
        const delta = startY - e.clientY
        let newHeight = startHeight + delta
        
        if (newHeight < minHeight) newHeight = minHeight
        if (newHeight > maxHeight) newHeight = maxHeight
        
        drawer.update(d => ({ ...d, height: newHeight }))
    }

    function onPointerUp() {
        move = false
        window.removeEventListener("pointermove", onPointerMove)
        window.removeEventListener("pointerup", onPointerUp)
    }

    function toggleDrawer() {
        if (height > minHeight) {
            drawer.update(d => ({ ...d, height: minHeight, stored: height }))
        } else {
            drawer.update(d => ({ ...d, height: $drawer.stored || defaultHeight }))
        }
    }

    let searchValue = ""
    let searchActive = false
    let searchElem: HTMLInputElement | undefined

    function openDrawerTab(tab: string) {
        activeDrawerTab.set(tab)
        if (height <= minHeight) {
            toggleDrawer()
        }
    }
</script>

<div class="drawer" style="height: {height}px">
    <div class="top context #drawer_top" on:pointerdown={onPointerDown} on:click={toggleDrawer} on:keydown={(e) => e.key === "Enter" && toggleDrawer()} role="button" tabindex="0">
        <span class="tabs">
            <Button 
                class="tab {$activeDrawerTab === 'shows' ? 'active' : ''}" 
                on:click={(e) => { e.stopPropagation(); openDrawerTab('shows') }}
            >
                <Icon id="shows" size={1.2} white={$activeDrawerTab === 'shows'} />
                <span>{translate("tabs.shows", $dictionary)}</span>
            </Button>
            <Button 
                class="tab {$activeDrawerTab === 'media' ? 'active' : ''}" 
                on:click={(e) => { e.stopPropagation(); openDrawerTab('media') }}
            >
                <Icon id="media" size={1.2} white={$activeDrawerTab === 'media'} />
                <span>{translate("tabs.media", $dictionary)}</span>
            </Button>
            <Button 
                class="tab {$activeDrawerTab === 'audio' ? 'active' : ''}" 
                on:click={(e) => { e.stopPropagation(); openDrawerTab('audio') }}
            >
                <Icon id="audio" size={1.2} white={$activeDrawerTab === 'audio'} />
                <span>{translate("tabs.audio", $dictionary)}</span>
            </Button>
            <Button 
                class="tab {$activeDrawerTab === 'overlays' ? 'active' : ''}" 
                on:click={(e) => { e.stopPropagation(); openDrawerTab('overlays') }}
            >
                <Icon id="overlays" size={1.2} white={$activeDrawerTab === 'overlays'} />
                <span>{translate("tabs.overlays", $dictionary)}</span>
            </Button>
            <Button 
                class="tab {$activeDrawerTab === 'templates' ? 'active' : ''}" 
                on:click={(e) => { e.stopPropagation(); openDrawerTab('templates') }}
            >
                <Icon id="templates" size={1.2} white={$activeDrawerTab === 'templates'} />
                <span>{translate("tabs.templates", $dictionary)}</span>
            </Button>
            <Button 
                class="tab {$activeDrawerTab === 'scripture' ? 'active' : ''}" 
                on:click={(e) => { e.stopPropagation(); openDrawerTab('scripture') }}
            >
                <Icon id="scripture" size={1.2} white={$activeDrawerTab === 'scripture'} />
                <span>{translate("tabs.scripture", $dictionary)}</span>
            </Button>
            <Button 
                class="tab {$activeDrawerTab === 'calendar' ? 'active' : ''}" 
                on:click={(e) => { e.stopPropagation(); openDrawerTab('calendar') }}
            >
                <Icon id="calendar" size={1.2} white={$activeDrawerTab === 'calendar'} />
                <span>{translate("tabs.calendar", $dictionary)}</span>
            </Button>
            <Button 
                class="tab {$activeDrawerTab === 'functions' ? 'active' : ''}" 
                on:click={(e) => { e.stopPropagation(); openDrawerTab('functions') }}
            >
                <Icon id="functions" size={1.2} white={$activeDrawerTab === 'functions'} />
                <span>{translate("tabs.functions", $dictionary)}</span>
            </Button>
        </span>

        <input 
            bind:this={searchElem} 
            class:hidden={!searchActive && !searchValue.length} 
            class="search edit" 
            type="text" 
            placeholder={translate("main.search...", $dictionary)} 
            bind:value={searchValue} 
            on:click={(e) => e.stopPropagation()}
        />
        
        {#if !searchActive && !searchValue.length}
            <Button class="search-btn" on:click={(e) => { e.stopPropagation(); searchActive = true; setTimeout(() => searchElem?.focus(), 100) }}>
                <Icon id="search" size={1.4} white />
            </Button>
        {:else}
            <div class="clearSearch">
                <Button
                    style="height: 100%;"
                    on:click={(e) => {
                        e.stopPropagation()
                        searchValue = ""
                        searchElem?.focus()
                    }}
                >
                    <Icon id="clear" white />
                </Button>
            </div>
        {/if}
    </div>
    
    <div class="content">
        <Resizeable id="leftPanelDrawer">
            <TabletDrawerNavigation id={$activeDrawerTab} />
        </Resizeable>

        <div class="main-content">
            <TabletDrawerContent id={$activeDrawerTab} {searchValue} />
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
        box-shadow: 0 -2px 10px rgba(0,0,0,0.3);
        transition: height 0.1s;
    }

    .top {
        height: 40px;
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: var(--primary);
        border-top: 4px solid var(--primary-lighter);
        cursor: ns-resize;
        padding: 0 10px;
    }

    .tabs {
        display: flex;
        height: 100%;
    }

    .tabs :global(button) {
        height: 100%;
        border-radius: 0;
        padding: 0 15px;
        background: transparent;
        border-bottom: 2px solid transparent;
    }

    .tabs :global(button.active) {
        border-bottom: 2px solid var(--secondary);
        background-color: rgba(255,255,255,0.05);
    }

    .search {
        background-color: rgba(0,0,0,0.2);
        color: white;
        border: none;
        border-radius: 4px;
        padding: 5px 10px;
        width: 200px;
    }

    .hidden {
        display: none;
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
    
    .clearSearch {
        display: flex;
        align-items: center;
    }
</style>
