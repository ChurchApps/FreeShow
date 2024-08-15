<script lang="ts">
    import { OUTPUT } from "../../../types/Channels"
    import type { TabsObj } from "../../../types/Tabs"
    import { send } from "../../utils/request"
    import { activeStage, outputs, stageShows } from "../../stores"
    import { keysToID } from "../helpers/array"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { getResolution } from "../helpers/output"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import Tabs from "../main/Tabs.svelte"
    import BoxStyle from "./tools/BoxStyle.svelte"
    import Items from "./tools/Items.svelte"
    import ItemStyle from "./tools/ItemStyle.svelte"
    import SlideStyle from "./tools/SlideStyle.svelte"

    // $: allSlideItems = $activeStage.id !== null ? $stageShows[$activeStage?.id!].items : []
    // // select active items or all items
    // $: items = $activeStage.items.length ? $activeStage.items : allSlideItems
    // // select last item
    // $: item = items.length ? items[items.length - 1] : null

    const tabs: TabsObj = {
        text: { name: "items.text", icon: "text", disabled: true },
        item: { name: "tools.item", icon: "item", disabled: true },
        items: { name: "tools.items", icon: "items" },
        slide: { name: "tools.slide", icon: "options", overflow: true },
    }

    let active: string = $activeStage.items.length ? "item" : "items"

    activeStage.subscribe((as) => {
        if (as.items.length && active !== "item" && active !== "text") {
            tabs.text.disabled = tabs.item.disabled = false
            active = "text"
        } else if (!as.items.length && (active === "item" || active === "text")) {
            tabs.text.disabled = tabs.item.disabled = true
            active = "items"
        }
    })

    function resetStageStyle() {
        let resolution = getResolution()
        let defaultItemStyle = `
            width: ${resolution.width / 2}px;
            height: ${resolution.height / 2}px;
            left: ${resolution.width / 4}px;
            top: ${resolution.height / 4}px;
        `

        let stageId = $activeStage.id
        if (!stageId) return

        if (active === "text") {
            // this will not reset text css style
            const resetData = { auto: true, chords: false, chordsData: {} }
            Object.entries(resetData).forEach(([subkey, data]) => {
                history({
                    id: "UPDATE",
                    newData: { data, key: "items", subkey, keys: $activeStage.items },
                    oldData: { id: stageId },
                    location: { page: "stage", id: "stage_item_content", override: stageId + "_reset_text" },
                })
            })
        } else if (active === "item") {
            // this will also reset any text style
            history({
                id: "UPDATE",
                newData: { data: defaultItemStyle, key: "items", subkey: "style", keys: $activeStage.items },
                oldData: { id: stageId },
                location: { page: "stage", id: "stage_item_style", override: stageId + "_reset_item" },
            })
        } else if (active === "slide") {
            if ($stageShows[stageId]?.settings?.outputScreen) removeOutput(stageId)
            history({ id: "UPDATE", newData: { data: {}, key: "settings" }, oldData: { id: stageId }, location: { page: "stage", id: "stage", override: "stage_reset" } })
        }
    }

    function removeOutput(stageId: string) {
        outputs.update((a) => {
            let outputWithStageId = keysToID(a).find((output) => output.stageOutput === stageId)?.id
            if (!outputWithStageId) return a

            delete a[outputWithStageId]
            send(OUTPUT, ["REMOVE"], { id: outputWithStageId })

            return a
        })
    }
</script>

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
