<script lang="ts">
    import type { TabsObj } from "../../../types/Tabs"
    import { activeStage, outputs, stageShows } from "../../stores"
    import { getItemKeys } from "../edit/scripts/itemClipboard"
    import { addStyleString } from "../edit/scripts/textStyle"
    import { boxes } from "../edit/values/boxes"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { getStageOutputId, getStageResolution } from "../helpers/output"
    import { getStyles } from "../helpers/style"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import Tabs from "../main/Tabs.svelte"
    import BoxStyle from "./tools/BoxStyle.svelte"
    import Items from "./tools/Items.svelte"
    import ItemStyle from "./tools/ItemStyle.svelte"
    import SlideStyle from "./tools/SlideStyle.svelte"

    const tabs: TabsObj = {
        text: { name: "items.text", icon: "text", disabled: true },
        item: { name: "tools.item", icon: "item", disabled: true },
        items: { name: "tools.items", icon: "items" },
        slide: { name: "edit.options", icon: "options", overflow: true } // tools.slide
    }

    let selectedItemIds: string[] = []
    $: selectedItemIds = $activeStage.items || []
    $: stageItems = $stageShows[$activeStage.id!]?.items || {}
    $: activeItemId = selectedItemIds[0] || Object.keys(stageItems)[0] || ""

    $: item = activeItemId ? stageItems[activeItemId] : null

    let active: string = selectedItemIds.length ? "item" : "items"
    $: type = item?.type || "text"
    $: if (type === "slide_text" || type === "slide_notes" || type === "current_output") type = "text"
    $: tabs.text.name = "items." + type
    $: tabs.text.icon = boxes[type]?.icon || "text"

    $: if (item !== undefined) updateTabs()
    function updateTabs() {
        if (item?.type === "current_output") {
            tabs.text.disabled = true
            if (active === "text") active = "items"
            return
        }

        if (activeItemId && selectedItemIds.length === 1 && active === "items") {
            tabs.text.disabled = tabs.item.disabled = false
            // WIP don't change if clicking in "Arrange items"
            if ($activeStage.items?.length) active = "text"
        } else if (!activeItemId) {
            tabs.text.disabled = tabs.item.disabled = true
            if (!$activeStage.items?.length && (active === "item" || active === "text")) active = "items"
        }
    }

    function resetStageStyle() {
        let stageOutputId = getStageOutputId($outputs)
        let resolution = getStageResolution(stageOutputId, $outputs)
        let defaultItemStyle = {
            width: `${resolution.width / 2}px`,
            height: `${resolution.height / 2}px`,
            left: `${resolution.width / 4}px`,
            top: `${resolution.height / 4}px`
        }

        let stageId = $activeStage.id
        if (!stageId) return

        const itemKeys = getItemKeys()
        const activeItems = $activeStage.items?.length ? $activeStage.items : Object.keys($stageShows[stageId].items)
        let textStyles: { [key: string]: string } = {}
        let itemStyles: { [key: string]: string } = {}
        activeItems.forEach((key) => {
            let item = $stageShows[stageId].items[key]
            const styles = getStyles(item.style)

            let textStyle = ""
            let itemStyle = ""
            let defaultStyle = ""

            // split text/item styles
            Object.entries(styles).forEach(([key, value]) => {
                if (Object.keys(defaultItemStyle).includes(key) && active === "item") defaultStyle += `${key}: ${defaultItemStyle[key]};`
                else if (!itemKeys.includes(key)) textStyle += `${key}: ${value};`
                else itemStyle += `${key}: ${value};`
            })

            textStyles[key] = itemStyle
            itemStyles[key] = textStyle + defaultStyle
        })

        if (active === "text") {
            // this will not reset text css style
            const resetData = { auto: true, chords: {}, timer: {}, clock: {}, tracker: {}, variable: {}, device: {} }
            Object.entries(resetData).forEach(([subkey, data]) => {
                history({
                    id: "UPDATE",
                    newData: { data, key: "items", subkey, keys: activeItems },
                    oldData: { id: stageId },
                    location: { page: "stage", id: "stage_item_content", override: stageId + "_reset_text" }
                })
            })

            history({
                id: "UPDATE",
                newData: { data: textStyles, key: "items", subkey: "style", keys: activeItems },
                oldData: { id: stageId },
                location: { page: "stage", id: "stage_item_style", override: stageId + "_reset_item_text" }
            })
        } else if (active === "item") {
            history({
                id: "UPDATE",
                newData: { data: itemStyles, key: "items", subkey: "style", keys: activeItems },
                oldData: { id: stageId },
                location: { page: "stage", id: "stage_item_style", override: stageId + "_reset_item" }
            })
        } else if (active === "slide") {
            history({ id: "UPDATE", newData: { data: {}, key: "settings" }, oldData: { id: stageId }, location: { page: "stage", id: "stage", override: "stage_reset" } })
        }
    }

    // KEYDOWN EVENT

    function keydown(e: KeyboardEvent) {
        if (document.activeElement?.closest(".edit")) return

        let stageId = $activeStage.id
        let activeItems = $activeStage.items

        if (!stageId || !activeItems.length) return

        if (e.key === "Escape") {
            // give time so output don't clear
            setTimeout(() => {
                activeStage.set({ ...$activeStage, items: [] })
            })
            return
        }

        // move items with arrow keys
        if (!e.key.includes("Arrow")) return
        e.preventDefault()

        const key = ["ArrowLeft", "ArrowRight"].includes(e.key) ? "left" : "top"
        let value = ["ArrowLeft", "ArrowUp"].includes(e.key) ? -1 : 1
        if (e.ctrlKey || e.metaKey) value *= 10

        let itemStyles: { [key: string]: string } = {}

        activeItems.forEach((itemId) => {
            let item = $stageShows[stageId]?.items?.[itemId] || {}
            let style = item.style
            // if (Array.isArray(style)) style = style[0]
            console.log(style)
            let previousItemValue = Number(getStyles(style, true)?.[key] || "0")
            let newValue = previousItemValue + value + "px"

            itemStyles[itemId] = addStyleString(style, [key, newValue])
        })

        history({
            id: "UPDATE",
            newData: { data: itemStyles, key: "items", subkey: "style", keys: activeItems },
            oldData: { id: stageId },
            location: { page: "stage", id: "stage_item_style", override: stageId + "_reset_item" }
        })
    }
</script>

<svelte:window on:keydown={keydown} />

<div class="main border stageTools">
    <Tabs {tabs} bind:active />
    <!-- labels={false} -->
    {#if active === "text"}
        <div class="content">
            <BoxStyle />
        </div>
    {:else if active === "item"}
        <div class="content">
            <ItemStyle />
        </div>
    {:else if active === "items"}
        <div class="content">
            <Items />
        </div>
    {:else if active === "slide"}
        <div class="content">
            <SlideStyle />
        </div>
    {/if}

    <span style="display: flex;flex-wrap: wrap;white-space: nowrap;">
        {#if active !== "items"}
            <Button style="flex: 1;" on:click={resetStageStyle} dark center>
                <Icon id="reset" right />
                <T id={"actions.reset"} />
            </Button>
        {/if}
    </span>
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        height: 100%;
    }

    .content {
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
    }
    .content :global(section) {
        padding: 10px;
        height: 100%;
        /* flex: 1; */
    }
    /* .content :global(section div) {
    display: flex;
    justify-content: space-between;
  } */
</style>
