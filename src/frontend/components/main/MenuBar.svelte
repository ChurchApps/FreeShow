<script lang="ts">
    import { fade } from "svelte/transition"
    import { Main } from "../../../types/IPC/Main"
    import { sendMain } from "../../IPC/main"
    import { saved, topContextActive, windowState } from "../../stores"
    import { initializeClosing } from "../../utils/save"
    import ContextChild from "../context/ContextChild.svelte"
    import ContextItem from "../context/ContextItem.svelte"
    import { contextMenuItems, contextMenuLayouts } from "../context/contextMenus"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import { triggerClickOnEnterSpace } from "../../utils/clickable"

    const menus: string[] = ["file", "edit", "view", "help"]

    let activeID: null | string = null
    let activeMenu: string[] = []
    let x = 0
    let y = 25

    $: maximized = !!$windowState.maximized

    function menu(e: any) {
        let id: string = e.target.id
        topContextActive.set(activeID !== id)
        activeID = activeID === id ? null : id

        if (activeID === null) return
        x = e.target.offsetLeft
        activeMenu = contextMenuLayouts[id] || []
    }

    const click = (e: MouseEvent) => {
        if (e.target?.closest(".menu") || e.target?.closest(".menus")) return

        topContextActive.set(false)
    }

    $: if ($topContextActive === false) activeID = null

    const move = (e: any) => {
        if (!$topContextActive || activeID === e.target.id) return
        ;(document.activeElement as any)?.blur()
        menu(e)
    }
</script>

<svelte:window on:click={click} on:contextmenu={click} />

<main bind:clientHeight={y}>
    {#if $topContextActive}
        <div class="contextMenu menu" style="inset-inline-start: {x}px; top: {y}px;" transition:fade={{ duration: 50 }}>
            {#key activeMenu}
                {#each activeMenu as id}
                    {#if id === "SEPERATOR"}
                        <hr />
                    {:else if contextMenuItems[id]?.items}
                        <ContextChild {id} topBar />
                    {:else}
                        <ContextItem {id} topBar />
                    {/if}
                {/each}
            {/key}
        </div>
    {/if}

    <div class="nocontext menus" role="menubar" tabindex="0" on:mousemove={move} on:click={menu} on:contextmenu={menu} on:keydown={triggerClickOnEnterSpace}>
        {#each menus as menu}
            <Button id={menu} active={activeID === menu} red={menu === "file" && !$saved}>
                <T id="titlebar.{menu}" />
            </Button>
        {/each}
    </div>
    <div class="window">
        <Button on:click={() => sendMain(Main.MINIMIZE)} center>
            <Icon id="remove" size={1.2} white />
        </Button>
        <Button on:click={() => sendMain(Main.MAXIMIZE)} style="transform: rotate(180deg);" center>
            <Icon id={maximized ? "maximized" : "unmaximized"} size={maximized ? 0.8 : 0.9} white />
        </Button>
        <Button id="close" on:click={() => initializeClosing()} center>
            <Icon id="close" size={1.2} white />
        </Button>
    </div>
</main>

<style>
    main :global(button) {
        opacity: 0.7;
        cursor: default !important;
        font-weight: normal !important;
    }

    main {
        display: flex;
        justify-content: space-between;
        background-color: var(--primary-darkest);
        font-size: 0.9em;
        height: 25px;
        -webkit-app-region: drag;
    }

    div,
    div :global(div) {
        display: flex;
        -webkit-app-region: no-drag;
    }

    .window :global(button) {
        width: 48px;
    }

    /* disable styled border radius */
    div :global(button),
    div :global(.menu) {
        border-radius: 0px !important;
    }

    /* close */
    .window :global(#close):hover {
        background-color: rgb(255 0 0 / 0.35);
    }
    .window :global(#close):active,
    .window :global(#close):focus {
        background-color: rgb(255 0 0 / 0.3);
    }
    .window :global(#close):hover :global(svg) {
        fill: white;
    }

    /* menu */
    .menu {
        display: flex;
        flex-direction: column;
        position: fixed;
        min-width: 250px;
        background-color: var(--primary-darker);
        /* border-radius: var(--border-radius); */
        box-shadow: 1px 1px 3px 2px rgb(0 0 0 / 0.2);
        padding: 5px 0;
        z-index: 6000;
        -webkit-app-region: no-drag;
    }

    hr {
        margin: 5px 10px;
        height: 2px;
        border: none;
        background-color: var(--primary);
    }
</style>
