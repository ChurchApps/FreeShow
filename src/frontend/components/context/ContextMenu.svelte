<script lang="ts">
    import { fade } from "svelte/transition"
    import { activePage, activePopup, contextActive, contextData, localeDirection, os, special, spellcheck, theme, themes } from "../../stores"
    import { closeContextMenu } from "../../utils/shortcuts"
    import { getEditItems } from "../edit/scripts/itemHelpers"
    import { hexToRgb } from "../helpers/color"
    import ContextChild from "./ContextChild.svelte"
    import ContextItem from "./ContextItem.svelte"
    import { contextMenuItems, contextMenuLayouts } from "./contextMenus"
    import { quickLoadItems } from "./loadItems"
    import SpellCheckMenu from "./SpellCheckMenu.svelte"

    let contextElem: HTMLDivElement | null = null
    let activeMenu: string[] = []
    let x = 0
    let y = 0
    let side: "right" | "left" = "right"
    let translate = 0

    function onContextMenu(e: MouseEvent) {
        spellcheck.set(null)

        let target: any = e.target
        if (!target || closingMenuTimeout) return

        let input = ["text", "textarea"].includes(target.type) && !target.closest(".numberInput")
        if ((!input && (target.closest(".contextMenu") || $activePopup)) || target.closest(".nocontext")) {
            closeContextMenu()
            return
        }

        x = e.clientX
        y = e.clientY
        side = $localeDirection === "rtl" ? "left" : "right"

        // side = "right"
        translate = 0

        contextElem = target.closest(".context") || document.body
        let id: string | null = contextElem?.classList.length ? [...contextElem?.classList].find((c: string) => c.includes("#")) || null : null

        // don't show drawer context menu in search input
        if (id === "#drawer_top" && input) id = null
        // custom input (paste) menu on Windows
        if (!id && input && $os.platform === "win32") {
            id = "#input"
            contextElem = target
        }

        activeMenu = getContextMenu(id) || contextMenuLayouts.default

        let contextHeight = Object.keys(activeMenu).length * 30 + 10
        if (x + 250 > window.innerWidth) x -= 250
        if (y + contextHeight > window.innerHeight) translate = 100
        if (x + (250 + 150) > window.innerWidth) side = "left"

        contextActive.set(true)
    }

    function getContextMenu(id: string | null) {
        if (!id) return
        if (id.includes("__")) return combineMenus(id)

        let menu = contextMenuLayouts[id.slice(1, id.length)]
        if (id && menu) return menu

        return
    }

    function combineMenus(id: string) {
        let menus = id.slice(1, id.length).split("__")
        let menu: string[] = []

        menus.forEach((c2: string, i: number) => {
            if (contextMenuLayouts[c2]) menu.push(...contextMenuLayouts[c2])
            if (i < menus.length - 1) menu.push("SEPERATOR")
        })

        return menu
    }

    const click = (e: MouseEvent) => {
        if (!e.target?.closest(".contextMenu")) closeContextMenu()
    }

    // prevent duplicated menus (due to Svelte transition bug)
    let closingMenuTimeout: NodeJS.Timeout | null = null
    $: if ($contextActive === false) startCloseTimer()
    function startCloseTimer() {
        closingMenuTimeout = setTimeout(() => (closingMenuTimeout = null), 70)
    }

    // preload data (to check if some of the buttons can be hidden)
    $: if (activeMenu) loadData()
    function loadData() {
        activeMenu.forEach((id) => {
            let items = contextMenuItems[id]?.items || []
            if (!items[0]?.includes("LOAD")) return

            let firstId = items[0].slice(5, items[0].length)
            quickLoadItems(firstId)
        })
    }

    // hide some context menu elements if they are not needed
    function shouldShowMenuWithItems(id: string) {
        if (id === "rearrange") return getEditItems().length > 1

        if (id === "bind_to") return $contextData.outputList
        if (id === "format") return $contextData.textContent || $activePage !== "show"
        if (id === "remove_layers") return $contextData.layers
        if (id === "tag_filter") return $contextData.tags
        if (id === "media_tag_filter") return $contextData.media_tags
        if (id === "action_tag_filter") return $contextData.action_tags
        if (id === "variable_tag_filter") return $contextData.variable_tags

        return true
    }

    let top = false
    $: if ($contextActive && contextElem) updateTop()
    function updateTop() {
        top = false
        // timeout to allow contextMenu to render/update
        setTimeout(() => {
            if (!document.querySelector(".contextMenu")) return
            top = document.querySelector(".contextMenu")!.getBoundingClientRect().top <= 0
        })
    }

    // let light = false
    // $: if ($theme) light = !isDarkTheme()
    let rgb = { r: 35, g: 35, b: 45 }
    $: if ($theme) updateColor()
    function updateColor() {
        const color = $themes[$theme]?.colors["primary"]
        if (!color) return

        const newRgb = hexToRgb(color)
        rgb = { r: Math.max(0, newRgb.r - 1), g: Math.max(0, newRgb.g - 5), b: Math.max(0, newRgb.b - 5) }
    }

    $: isOptimized = $special.optimizedMode
</script>

<svelte:window on:contextmenu={onContextMenu} on:click={click} />

{#if $contextActive}
    <div class="contextMenu" style="left: {x}px; top: {y}px;transform: translateY(-{translate}%);--background: rgb({rgb.r} {rgb.g} {rgb.b} / 0.97);" class:top class:isOptimized transition:fade={{ duration: 60 }}>
        {#key activeMenu}
            <SpellCheckMenu />

            {#each activeMenu as id}
                {#if id === "SEPERATOR"}
                    <hr />
                {:else if contextMenuItems[id]?.items}
                    <!-- conditional menus -->
                    {#if shouldShowMenuWithItems(id)}
                        <!-- {activeMenu.length > 2 ? translate : 0} -->
                        <ContextChild {id} {contextElem} {side} translate={y > 400 ? translate : 0} />
                    {/if}
                {:else}
                    <ContextItem {id} {contextElem} />
                {/if}
            {/each}
        {/key}
    </div>
{/if}

<style>
    .contextMenu {
        position: fixed;
        min-width: 250px;
        box-shadow: 1px 1px 3px 2px rgb(0 0 0 / 0.2);
        padding: 8px 0;
        z-index: 5001;

        border-radius: 6px;

        border: 1px solid var(--primary-lighter);

        --background: rgba(35, 35, 45, 0.97);
        background-color: var(--background);
        backdrop-filter: blur(8px);
    }

    .top {
        top: 0 !important;
        transform: none !important;
    }

    hr {
        margin: 8px 0;
        height: 1px;
        border: none;
        background-color: var(--primary-lighter);
    }
</style>
