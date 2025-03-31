<script lang="ts">
    import { uid } from "uid"
    import type { StageItem } from "../../../../types/Stage"
    import { activeStage, dictionary, labelsDisabled, stageShows } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { checkWindowCapture, sortItemsByType } from "../../helpers/output"
    import IconButton from "../../inputs/IconButton.svelte"
    import Panel from "../../system/Panel.svelte"
    import { updateStageShow } from "../stage"

    type ItemRef = { id: string; icon?: string; name?: string; maxAmount?: number }
    const dynamicItems: ItemRef[] = [
        { id: "slide_text", icon: "text" },
        // { id: "slide_notes", icon: "notes" }, // added as dynamic value in textbox
        { id: "current_output", icon: "screen", maxAmount: 1 },
    ]

    const normalItems: ItemRef[] = [
        { id: "text" }, // video time/countdown ... (preset with dynamic values)
        // { id: "variable" }, // added as dynamic value in textbox
        { id: "slide_tracker", icon: "percentage" },
        { id: "media", icon: "image" },
        { id: "camera" },
        { id: "timer" },
        { id: "clock" },
    ]

    $: stageShow = $stageShows[$activeStage.id || ""] || {}
    $: sortedItems = sortItemsByType(Object.values(stageShow.items || {}) as any)

    const resolution = { width: 1920, height: 1080 }
    const DEFAULT_STYLE = `width: ${resolution.width / 2}px;height: ${resolution.height / 2}px;left: ${resolution.width / 4}px;top: ${resolution.height / 4}px;`

    let timeout: NodeJS.Timeout | null = null
    function addItem(itemType: string) {
        const stageId = $activeStage.id
        if (!stageId) return

        let itemId = uid(5)
        stageShows.update((a) => {
            let item: StageItem = { type: itemType, style: DEFAULT_STYLE, align: "" }

            if (itemType === "text") item.lines = [{ align: "", text: [{ style: "", value: "" }] }]
            else if (itemType === "slide_text") {
                let slideTextItems = Object.values(a[stageId].items).filter((a) => a.type === "slide_text")
                item.slideOffset = slideTextItems.length
            }

            a[stageId].items[itemId] = item
            return a
        })

        // select item
        if (Object.keys($stageShows[stageId]?.items).length > 1) {
            activeStage.update((a) => {
                a.items = [itemId]
                return a
            })
        }

        if (itemType === "current_output") checkWindowCapture()

        // WIP:
        if (!timeout) {
            updateStageShow()
            timeout = setTimeout(() => {
                updateStageShow()
                timeout = null
            }, 500)
        }
    }
</script>

<div class="main">
    <Panel>
        <h6 style="margin-top: 10px;"><T id="stage.output" /></h6>

        <div class="grid">
            {#each dynamicItems as item}
                {#if item.id === "current_output"}
                    <hr class="divider" />
                {/if}

                <IconButton style="min-width: 100%;" name title={$dictionary.items?.[item.name || item.id]} icon={item.icon || item.id} disabled={item.maxAmount && sortedItems[item.id]?.length >= item.maxAmount} on:click={() => addItem(item.id)} />
            {/each}
        </div>

        <hr class="divider" />
        <!-- <h6><T id="edit.add_items" /></h6> -->
        <h6><T id="tools.items" /></h6>

        <div class="grid normal">
            {#each normalItems as item}
                <!-- i === 0 ? "min-width: 100%;" :  -->
                <IconButton
                    style={$labelsDisabled ? "" : "justify-content: start;padding-left: 15px;"}
                    name
                    title={$dictionary.items?.[item.name || item.id]}
                    icon={item.icon || item.id}
                    disabled={item.maxAmount && sortedItems[item.id]?.length >= item.maxAmount}
                    on:click={() => addItem(item.id)}
                />

                <!-- {#if i === 0}<hr class="divider" />{/if} -->
            {/each}
        </div>
    </Panel>
</div>

<style>
    .grid {
        display: flex;
        /* gap: 10px; */
        flex-wrap: wrap;
    }

    .grid :global(#icon) {
        flex: 1;
        background-color: var(--primary-darker);
        padding: 9px;

        /* min-width: 100%; */
    }
    .grid :global(#icon:hover) {
        background-color: var(--primary-lighter);
    }

    /* .normal */
    .grid :global(#icon) {
        min-width: 49%;
    }

    .divider {
        height: 2px;
        width: 100%;
        background-color: var(--primary);
        margin: 0;
    }

    /*  */

    .main :global(button.active) {
        font-weight: 600;
    }
</style>
