<script lang="ts">
    import { localeDirection } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import ContextItem from "./ContextItem.svelte"
    import { ContextMenuItem, contextMenuItems } from "./contextMenus"
    import { loadItems } from "./loadItems"

    export let contextElem: HTMLDivElement | null = null
    export let topBar = false
    export let id: string
    export let menu: ContextMenuItem = contextMenuItems[id]
    export let translate = 0

    export let side: "right" | "left" = $localeDirection === "rtl" ? "left" : "right"
    $: transform = side === "right" ? "100%" : "-100%"

    let open = false
    let elem: HTMLDivElement
    let timeout: NodeJS.Timeout | null = null
    let duration = 200

    function onMouseOver(e: any) {
        if (elem.contains(e.target)) {
            clearTimeout()
            if (open) return

            timeout = setTimeout(() => {
                open = true
                timeout = null
            }, duration)

            return
        }

        if (open && e.target?.closest(".contextMenu") !== null) {
            if (timeout !== null) return

            timeout = setTimeout(() => {
                open = false
                timeout = null
            }, duration / 2)

            return
        }

        clearTimeout()
    }

    function clearTimeout() {
        if (timeout === null) return

        window.clearTimeout(timeout)
        timeout = null
    }

    function click(e: any) {
        if (e.target?.closest(".submenu") === null) open = true
    }

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter") open = !open
    }
</script>

<svelte:window on:mouseover={onMouseOver} />

<div bind:this={elem} class="item" class:open on:click={click} tabindex={0} on:keydown={keydown} role="menuitem">
    <span style="display: flex;gap: 10px;justify-content: space-between;width: 100%;">
        <div class="left" style="display: flex;align-items: center;gap: 15px;">
            {#if menu?.icon}<Icon style="opacity: 0.7;color: {(topBar ? '' : menu.iconColor) || 'var(--text)'};" id={menu.icon} white />{/if}
            {#key menu}
                <T id={menu?.label || id} />
            {/key}
        </div>
        <div class="right" style="display: flex;align-self: center;opacity: 0.5;">
            <Icon id="arrow_right" size={1.2} white />
        </div>
    </span>

    {#if open}
        <div class="submenu" style="{side}: 0; transform: translate({transform}, {translate ? `calc(-${translate}% + 32px)` : '-14px'});">
            {#if menu?.items?.length}
                {#each menu.items as itemId}
                    {#if itemId === "SEPERATOR"}
                        <hr />
                    {:else if itemId.includes("LOAD_")}
                        {#each loadItems(itemId.slice(5, itemId.length)) as [id, menu]}
                            {#if id === "SEPERATOR" || menu === "SEPERATOR"}
                                <hr />
                            {:else}
                                <ContextItem {id} {contextElem} {menu} disabled={menu.disabled === true} {topBar} />
                            {/if}
                        {/each}
                    {:else}
                        <ContextItem id={itemId} {contextElem} {topBar} />
                    {/if}
                {/each}
            {/if}
        </div>
    {/if}
</div>

<style>
    .item {
        padding: 6px 16px;
        display: flex;
        justify-content: space-between;
    }
    .item:hover,
    .item.open {
        background-color: rgb(0 0 0 / 0.2);
    }

    hr {
        margin: 8px 0;
        height: 1px;
        border: none;
        background-color: var(--primary-lighter);
    }

    .submenu {
        min-width: 150px;
        max-height: 300px;
        overflow: auto;
        position: absolute;
        transform: translate(100%, -14px);
        box-shadow:
            2px 2px 3px rgb(0 0 0 / 0.2),
            inset 4px 0 2px -3px rgb(20 0 0 / 0.15);
        padding: 8px 0;
        z-index: 5000;

        border-radius: 6px;
        border-top-left-radius: 2px;
        border-bottom-left-radius: 2px;

        border: 1px solid var(--primary-lighter);
        /* border-left: none; */

        background-color: var(--background);

        /* this does not work here */
        /* backdrop-filter: blur(8px); */
    }
</style>
