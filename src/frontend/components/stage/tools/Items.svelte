<script lang="ts">
    import { uid } from "uid"
    import { Item } from "../../../../types/Show"
    import type { StageItem } from "../../../../types/Stage"
    import { activeStage, dictionary, labelsDisabled, selected, special, stageShows, timers } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getSortedStageItems, rearrangeStageItems, updateSortedStageItems } from "../../edit/scripts/itemHelpers"
    import { getItemText } from "../../edit/scripts/textStyle"
    import { itemBoxes } from "../../edit/values/boxes"
    import Icon from "../../helpers/Icon.svelte"
    import { clone } from "../../helpers/array"
    import { getFileName } from "../../helpers/media"
    import { checkWindowCapture, sortItemsByType } from "../../helpers/output"
    import { getDynamicIds, replaceDynamicValues } from "../../helpers/showActions"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import { getCustomStageLabel, updateStageShow } from "../stage"

    type ItemRef = { id: string; icon?: string; name?: string; maxAmount?: number }
    const dynamicItems: ItemRef[] = [
        { id: "slide_text", icon: "text" },
        // { id: "slide_notes", icon: "notes" }, // added as dynamic value in textbox
        ...($special.optimizedMode ? [] : [{ id: "current_output", icon: "screen", maxAmount: 1 }])
    ]

    const normalItems: ItemRef[] = [
        // { id: "text" }, // video time/countdown ... (preset with dynamic values)
        // { id: "variable" }, // added as dynamic value in textbox
        { id: "media", icon: "image" },
        { id: "camera" },
        { id: "timer" },
        { id: "clock" },
        { id: "slide_tracker", icon: "percentage" }
    ]

    $: stageId = $activeStage.id || ""
    $: stageShow = $stageShows[stageId] || {}
    $: sortedItems = sortItemsByType(Object.values(stageShow.items || {}) as any)

    // check slide text state
    $: slideTextItems = Object.values(stageShow.items || {}).filter((a) => a.type === "slide_text")

    const resolution = { width: 1920, height: 1080 }
    const halfWidth = resolution.width * 0.5
    const halfHeight = resolution.height * 0.5
    const DEFAULT_STYLE = `width: ${halfWidth}px;height: ${halfHeight}px;left: ${halfWidth * 0.5}px;top: ${halfHeight * 0.5}px;`
    const smallItems = ["timer", "clock", "slide_tracker"]

    let timeout: NodeJS.Timeout | null = null
    function addItem(itemType: string, textValue = "") {
        if (!stageId) return

        let itemId = uid(5)
        stageShows.update((a) => {
            let style = DEFAULT_STYLE
            if (smallItems.includes(itemType) || textValue) {
                const width = resolution.width * 0.45
                const left = halfWidth - width * 0.5
                const height = 150
                const top = halfHeight - height * 0.5
                style = `width: ${width}px;height: ${height}px;left: ${left}px;top: ${top}px;`
            }

            let item: StageItem = { type: itemType, style, align: "" }

            if (itemType === "text") item.lines = [{ align: "", text: [{ style: "", value: textValue || "" }] }]
            else if (itemType === "slide_text") {
                item.slideOffset = slideTextItems.length
                item.style += "font-size: 800px;"
            }

            a[stageId].items[itemId] = item
            return a
        })

        updateSortedStageItems()

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

    // ARRANGE

    const getIdentifier = {
        text: (item: StageItem) => {
            let text = getItemText(item as Item)
            return text.slice(0, 10)
        },
        media: (item: StageItem) => {
            let path = item.src
            return getFileName(path || "")
        },
        timer: (item: StageItem) => {
            if (!item.timer?.id) return ""
            let timerName = $timers[item.timer.id]?.name || ""
            return timerName
        },
        clock: () => ""
    }

    $: allItems = getSortedStageItems(stageId, $stageShows)
    $: invertedItemList = Array.isArray(allItems) ? clone(allItems).reverse() : []

    const excludeValues = ["project_", "time_", "audio_", "meta_"]
    const ref = { type: "stage" }
    const dynamicValues = getDynamicIds()
        .filter((id) => !excludeValues.find((v) => id.includes(v))) // || id.startsWith("project_")
        .map((id) => ({ value: `{${id}}`, label: `{${id}}`, data: replaceDynamicValues(`{${id}}`, ref).slice(0, 20) }))
</script>

<div class="tools">
    <!-- <h6 style="margin-top: 10px;"><T id="stage.output" /></h6> -->
    <div class="section">
        {#each dynamicItems as item}
            {@const title = (item.id === "slide_text" && slideTextItems.length === 1 ? "stage.next_slide_text" : "items." + (item.name || item.id)) + (item.id === "slide_text" && slideTextItems.length > 1 ? ` (+${slideTextItems.length})` : "")}
            {@const disabled = !!(item.maxAmount && sortedItems[item.id]?.length >= item.maxAmount)}

            <MaterialButton variant="outlined" {disabled} title="settings.add: <b>{title}</b>" style="width: 100%;padding: 12px 14px;" on:click={() => addItem(item.id)}>
                <Icon id={item.icon || item.id} />
                {#if !$labelsDisabled}{translateText(title)}{/if}
            </MaterialButton>
        {/each}
    </div>

    <!-- common -->

    <!-- <h6><T id="edit.add_items" /></h6> -->
    <!-- <h6><T id="tools.items" /></h6> -->
    <div class="section" style="margin-top: 5px;">
        <InputRow>
            <MaterialButton variant="outlined" icon="text" title="settings.add: <b>items.text</b>" style="width: 100%;" on:click={() => addItem("text")}>
                {#if !$labelsDisabled}{translateText("items.text")}{/if}
            </MaterialButton>

            <MaterialDropdown label="" options={dynamicValues} value="" style="border: 1px solid var(--primary-lighter);" on:change={(e) => addItem("text", e.detail)} title="actions.dynamic_values" onlyArrow />
        </InputRow>
    </div>

    <div class="section">
        {#each normalItems as item}
            <MaterialButton variant="outlined" title="settings.add: <b>items.{item.id}</b>" style="justify-content: left;width: 50%;padding: 12px 14px;" on:click={() => addItem(item.id)}>
                <Icon id={item.icon || item.id} size={0.9} />
                {#if !$labelsDisabled}{translateText("items." + item.id)}{/if}
            </MaterialButton>
        {/each}
    </div>

    {#if invertedItemList.length}
        <div style="margin-top: 10px;">
            <div class="title">
                <span style="display: flex;gap: 8px;align-items: center;padding: 8px 12px;">
                    <Icon id="rearrange" white />
                    <p>{translateText("edit.arrange_items")}</p>
                </span>
            </div>

            <div
                class="items {invertedItemList.length > 1 ? 'context #items_list_item_stage' : ''}"
                style="display: flex;flex-direction: column;"
                on:mousedown={(e) => {
                    if (e.button !== 2) return
                    // select on right click for context menu
                    const itemId = (e.target?.closest(".item_button")?.id || "").slice(1)
                    activeStage.set({ ...$activeStage, items: [itemId] })
                }}
            >
                {#each invertedItemList as currentItem, i}
                    {@const id = currentItem.id}
                    {@const type = currentItem.type || "text"}

                    <MaterialButton
                        id="#{id}"
                        variant="outlined"
                        class="item_button"
                        style="width: 100%;justify-content: space-between;padding: 2px 8px;"
                        isActive={$activeStage.items.includes(id)}
                        tab
                        on:click={(e) => {
                            selected.set({ id: null, data: [] })
                            activeStage.update((ae) => {
                                if (e.detail.ctrl) {
                                    if (ae.items.includes(id)) ae.items.splice(ae.items.indexOf(id), 1)
                                    else ae.items.push(id)
                                } else if (!ae.items.includes(id)) ae.items = [id]
                                else ae.items = []
                                return ae
                            })
                        }}
                    >
                        <span style="display: flex;align-items: center;max-width: 70%;">
                            <p style="opacity: 0.7;margin-inline-end: 10px;">{i + 1}</p>
                            <Icon id={type === "icon" ? id || "" : itemBoxes[type]?.icon || "text"} custom={type === "icon"} size={0.8} />
                            <p style="opacity: 0.9;margin-inline-start: 10px;;">{getCustomStageLabel(currentItem.type || id, currentItem, $dictionary) || translateText("items." + type)}</p>
                            {#if getIdentifier[type]}<p style="margin-inline-start: 10px;max-width: 120px;opacity: 0.5;font-size: 0.8em;max-width: 40%;">{getIdentifier[type](currentItem)}</p>{/if}
                        </span>
                        <span>
                            <MaterialButton disabled={i === allItems.length - 1} icon="down" style="padding: 8px;" on:click={() => rearrangeStageItems("backward", id)} />
                            <MaterialButton disabled={i === 0} icon="up" style="padding: 8px;" on:click={() => rearrangeStageItems("forward", id)} />
                        </span>
                    </MaterialButton>
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .tools {
        padding: 8px 5px;

        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    /* .section {
        border-radius: 8px;
        border: 1px solid var(--primary-lighter);
        overflow: hidden;
    } */
    /* .section :global(button) {
        border: none;
    } */

    /* title */

    .title {
        background-color: var(--primary-darker);
        border-bottom: 1px solid var(--primary-lighter);

        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
        overflow: hidden;
    }
    .title p {
        font-weight: 500;
        font-size: 0.8rem;
        opacity: 0.8;
    }
</style>
