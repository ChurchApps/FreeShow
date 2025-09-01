<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import type { Condition, ConditionValue } from "../../../../types/Show"
    import { activeEdit, activeShow, activeStage, overlays, popupData, showsCache, stageShows, templates } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { checkConditionValue, isConditionMet } from "../../edit/scripts/itemHelpers"
    import { getItemText } from "../../edit/scripts/textStyle"
    import { clone } from "../../helpers/array"
    import { getLayoutRef } from "../../helpers/show"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialZoom from "../../inputs/MaterialZoom.svelte"
    import Textbox from "../../slide/Textbox.svelte"
    import Stagebox from "../../stage/Stagebox.svelte"
    import ConditionsBox from "./ConditionsBox.svelte"
    import { getSlideTextItems } from "../../stage/stage"

    const obj = $popupData.obj || {}
    onMount(() => popupData.set({}))

    const DEFAULT_CONDITIONS: { [key: string]: Condition } = { showItem: [] }

    let edit = $activeEdit
    let showId = $activeShow?.id || ""
    let ref = getLayoutRef(showId)
    let slideId = ref[edit.slide || 0]?.id || ""

    const isStage = !!obj.contextElem?.classList.contains("stage_item")
    const isOverlay = edit.type === "overlay"
    const isTemplate = edit.type === "template"

    let itemIndex = (isStage ? $activeStage : edit).items[0]
    let slide = isStage ? $stageShows[$activeStage.id || ""] : isOverlay ? $overlays[edit.id!] : isTemplate ? $templates[edit.id!] : $showsCache[showId]?.slides?.[slideId]
    let item = slide?.items[itemIndex]
    let itemText = getItemText(item)

    let conditions = item?.conditions || clone(DEFAULT_CONDITIONS)

    const itemOptions = Object.entries(slide?.items)?.map(([a, i]) => ({ value: a, label: getItemText(i).slice(0, 30) || i.type, data: (isStage ? "" : Number(a) + 1).toString() }))
    function updateItemIndex(e: any) {
        itemIndex = isStage ? e.detail : Number(e.detail)
        slide = isStage ? $stageShows[$activeStage.id || ""] : isOverlay ? $overlays[edit.id!] : isTemplate ? $templates[edit.id!] : $showsCache[showId]?.slides?.[slideId]
        item = slide?.items[itemIndex]
        itemText = getItemText(item)

        conditions = item?.conditions || clone(DEFAULT_CONDITIONS)
    }

    onMount(() => {
        if (item?.conditions) return
        // guess most likely condition

        // timer
        if (item?.type === "timer") {
            setLikelyValue("timer", "element")
            setLikelyValue(item?.timer?.id || "", "elementId")
            setLikelyValue("isRunning", "operator")
            return
        }

        const text = itemText

        // dynamic value / variable
        if (text.includes("{")) {
            const isVariable = text.includes("{$") || text.includes("{variable_")
            setLikelyValue(isVariable ? "variable" : "dynamicValue", "element")

            let valueId = text.replace("{", "").replace("}", "")
            // if (isVariable) valueId = valueId.replace("$", "").replace("variable_", "")
            // const variableId = keysToID($variables).find((a) => getVariableNameId(a.name) === valueId)?.id || ""
            // setLikelyValue(isVariable ? variableId : valueId, "elementId")
            setLikelyValue(valueId, "elementId")

            setLikelyValue("isNot", "operator")

            let emptyValue = ""
            if (text.includes("{video_")) emptyValue = "00:00"
            setLikelyValue(emptyValue, "value")
            return
        }
    })

    function setLikelyValue(value: string, key: string) {
        updateContent(key, value, 0, 0, 0, 0)
    }

    // UPDATE

    function updateValue(conditionType: string = "showItem", values: Condition) {
        conditions[conditionType] = values
        updateItem()
    }

    function updateItem() {
        if (obj.contextElem?.classList.contains("stage_item")) {
            const stageId = $activeStage.id || ""
            stageShows.update((a) => {
                if (!a[stageId]?.items[itemIndex]) return a
                a[stageId].items[itemIndex].conditions = conditions
                return a
            })
            return
        }

        if (!obj.contextElem?.classList.contains("editItem")) return
        if (itemIndex === undefined) return

        if (isOverlay) {
            overlays.update((a) => {
                if (!a[edit.id!]?.items?.[itemIndex]) return a
                a[edit.id!].items[itemIndex].conditions = conditions
                return a
            })
        } else if (isTemplate) {
            templates.update((a) => {
                if (!a[edit.id!]?.items?.[itemIndex]) return a
                a[edit.id!].items[itemIndex].conditions = conditions
                return a
            })
        } else {
            showsCache.update((a) => {
                if (!a[showId]?.slides?.[slideId]?.items?.[itemIndex]) return a
                a[showId].slides[slideId].items[itemIndex].conditions = conditions
                return a
            })
        }
    }

    // SHOW ITEM

    let showItemValues: Condition = []
    $: showItemValues = Array.isArray(conditions.showItem) ? conditions.showItem : conditions.showItem?.values?.length ? [[[conditions.showItem.values]]] : []

    function addContent(fromClipboard: boolean = false, a: number | null = null, b: number | null = null, c: number | null = null, d: number | null = null) {
        if (!showItemValues) showItemValues = []
        if (a !== null && !showItemValues[a]) showItemValues[a] = []
        if (b !== null && !showItemValues[a!][b]) showItemValues[a!][b] = []
        if (c !== null && !showItemValues[a!][b!][c]) showItemValues[a!][b!][c] = []

        const content = fromClipboard ? clone(clipboard || {}) : {}

        if (a === null) showItemValues.push([[[content]]])
        else if (b === null) showItemValues[a].push([[content]])
        else if (c === null) showItemValues[a][b].push([content])
        else if (d === null) showItemValues[a][b][c].push(content)

        updateValue("showItem", showItemValues)
    }

    function updateContent(key: string, value: string, a: number, b: number, c: number, d: number) {
        if (!showItemValues) showItemValues = []
        if (!showItemValues[a]) showItemValues[a] = []
        if (!showItemValues[a][b]) showItemValues[a][b] = []
        if (!showItemValues[a][b][c]) showItemValues[a][b][c] = []
        if (!showItemValues[a][b][c][d] || key === "element") showItemValues[a][b][c][d] = {}

        showItemValues[a][b][c][d][key] = value

        updateValue("showItem", showItemValues)
    }

    function deleteContent(a: number, b: number, c: number, d: number) {
        if (showItemValues[a]?.[b]?.[c]?.[d]) showItemValues[a][b][c].splice(d, 1)

        if (showItemValues[a]?.[b]?.[c] && !showItemValues[a][b][c].length) showItemValues[a][b].splice(c, 1)
        if (showItemValues[a]?.[b] && !showItemValues[a][b].length) showItemValues[a].splice(b, 1)
        if (showItemValues[a] && !showItemValues[a].length) showItemValues.splice(a, 1)

        updateValue("showItem", showItemValues)
    }

    let clipboard: ConditionValue | null = null
    function copyContent(content: ConditionValue) {
        clipboard = clone(content)
    }

    $: OUTER_OR = showItemValues?.length ? showItemValues : [[]]
    // only show if multiple "outer and" (& it has content)
    // $: addMoreOuter = showItemValues?.length > 1 || showItemValues?.[0]?.length > 1 || (showItemValues?.[0]?.[0]?.[0]?.[0] && (showItemValues?.[0]?.[0]?.[0]?.[1] || showItemValues?.[0]?.[0]?.[1]?.[0]))
    $: addMoreOuter = showItemValues?.[0]?.length > 1 || showItemValues?.length > 1

    let updater = 0
    const updaterInterval = setInterval(() => updater++, 2000)
    onDestroy(() => clearInterval(updaterInterval))

    $: currentItemText =
        isStage && item.type === "slide_text"
            ? getSlideTextItems(slide as any, item)
                  .map(getItemText)
                  .join("")
            : itemText
    $: showItemState = isConditionMet(OUTER_OR, currentItemText, isStage ? "stage" : "default", updater)

    let zoom = 1
</script>

{#if itemOptions.length > 1}
    <MaterialDropdown label="tools.item" style="margin-bottom: 10px;" options={itemOptions} value={itemIndex.toString()} on:change={updateItemIndex} />

    <div class="preview" style={showItemState ? "" : "opacity: 0.2;"}>
        <div class="slide">
            {#if isStage}
                <Stagebox id={showId} {item} ratio={1} />
            {:else}
                <Textbox {item} ref={{ id: showId }} />
            {/if}
        </div>
    </div>
{/if}

<div class="zoom center">
    <div class="nodes checkered" style="zoom: {zoom};">
        <div class="node root" class:isActive={showItemState}>
            <p>{translateText("conditions.show_item")}</p>
        </div>

        {#each OUTER_OR as outerAnd, a}
            {@const OUTER_AND = outerAnd?.length ? outerAnd : [[]]}
            <!-- only show if multiple "inner or" (& it has content) -->
            <!-- && outerAnd?.[0]?.[0]?.[0] && (outerAnd?.[0]?.[0]?.[1] || outerAnd?.[0]?.[1]?.[0]) -->
            {@const addMoreOuter = outerAnd?.[0]?.length > 1 || outerAnd?.length > 1}

            <div class="node or outer trail" class:first={a === 0} style={OUTER_AND[0]?.length < 2 && !addMoreOuter ? "padding: 0;" : ""}>
                {#each OUTER_AND || [[]] as innerOr, b}
                    {@const INNER_OR = innerOr?.length ? innerOr : [[]]}
                    {@const addMore = innerOr?.[0]?.[0]}

                    <div class="node and outer" class:trail={b > 0} style={INNER_OR[0]?.length < 2 && !addMore ? "padding: 0;" : ""}>
                        {#each INNER_OR as innerAnd, c}
                            {@const INNER_AND = innerAnd?.length ? innerAnd : [{}]}
                            <!-- {@const addMore = innerAnd?.[0]} -->

                            <div class="node or" class:trail={c > 0}>
                                {#each INNER_AND as content, d}
                                    {@const CONTENT = content || {}}

                                    <div class="node and" class:trail={d > 0} class:isActive={checkConditionValue(content, currentItemText, isStage ? "stage" : "default", updater)}>
                                        {#if innerAnd?.length || a !== 0 || b !== 0 || c !== 0 || d !== 0}
                                            <div class="delete">
                                                <MaterialButton variant="outlined" icon="delete" title="actions.delete" style="padding: 8px;border-radius: 50%;" on:click={() => deleteContent(a, b, c, d)} />
                                            </div>
                                            <div class="copy">
                                                <MaterialButton
                                                    variant="outlined"
                                                    showOutline={JSON.stringify(CONTENT) === JSON.stringify(clipboard)}
                                                    icon="copy"
                                                    title="actions.copy"
                                                    style="padding: 8px;border-radius: 50%;"
                                                    on:click={() => copyContent(CONTENT)}
                                                />
                                            </div>
                                        {/if}

                                        <ConditionsBox input={CONTENT} on:change={(e) => updateContent(e.detail.key, e.detail.value, a, b, c, d)} />
                                    </div>
                                {/each}

                                {#if addMore}
                                    <div class="buttons node and trail">
                                        <MaterialButton variant="outlined" icon="add" title="settings.add" on:click={() => addContent(false, a, b, c)} />
                                        {#if clipboard}
                                            <MaterialButton variant="outlined" icon="paste" title="actions.paste" on:click={() => addContent(true, a, b, c)} />
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        {/each}

                        {#if addMore}
                            <div class="buttons node or trail">
                                <MaterialButton variant="outlined" icon="add" title="settings.add" on:click={() => addContent(false, a, b)} />
                                {#if clipboard}
                                    <MaterialButton variant="outlined" icon="paste" title="actions.paste" on:click={() => addContent(true, a, b)} />
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/each}

                {#if addMoreOuter}
                    <div class="buttons node and trail">
                        <MaterialButton variant="outlined" icon="add" title="settings.add" on:click={() => addContent(false, a)} />
                        {#if clipboard}
                            <MaterialButton variant="outlined" icon="paste" title="actions.paste" on:click={() => addContent(true, a)} />
                        {/if}
                    </div>
                {/if}
            </div>
        {/each}

        {#if addMoreOuter}
            <div class="buttons node or trail">
                <MaterialButton variant="outlined" icon="add" title="settings.add" on:click={() => addContent(false)} />
                {#if clipboard}
                    <MaterialButton variant="outlined" icon="paste" title="actions.paste" on:click={() => addContent(true)} />
                {/if}
            </div>
        {/if}
    </div>

    <FloatingInputs style={addMoreOuter ? "" : "border: none;"} round>
        <MaterialZoom hidden={!addMoreOuter} columns={zoom} min={0.5} max={1.5} defaultValue={1} addValue={-0.1} on:change={(e) => (zoom = e.detail)} />
    </FloatingInputs>
</div>

<style>
    .preview {
        max-height: 180px;
        margin-bottom: 10px;

        display: flex;
        justify-content: center;
    }
    .preview .slide {
        zoom: 0.25;
        background-color: black;
        border-radius: 18px;
        padding: 20px;
        /* aspect-ratio: 16/9; */

        position: relative;
        overflow: hidden;

        display: flex;
        align-items: center;
    }

    .nodes {
        --gap: 50px;

        display: flex;
        align-items: center;
        gap: var(--gap);
        padding: 30px;

        background-color: var(--primary);
        border: 2px solid var(--primary-lighter);
        border-radius: 8px;

        min-height: 350px;

        overflow: auto;
    }

    .node {
        position: relative;

        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--gap);
        padding: 15px;

        box-shadow: 0 0 3px rgb(0 0 0 / 0.3);
        background-color: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);
        border-radius: 4px;

        /* max-width: 100%;
        max-height: 100%; */
        /* aspect-ratio: 1; */
    }

    .node.root {
        border-color: var(--disconnected);
    }
    .node.isActive {
        border-color: var(--connected);
    }

    .node.outer {
        padding: 20px;
    }
    .node.outer.or {
        /* background-color: rgb(0 0 18 / 0.03); */
        background-color: var(--primary);
    }
    .node.outer.and {
        background-color: rgb(0 0 18 / 0.08);
    }
    .node.or {
        background-color: rgb(0 0 18 / 0.15);
        flex-direction: column;
    }

    .delete,
    .copy {
        position: absolute;
        top: 0;
        right: 0;

        transform: translate(30%, -30%);

        z-index: 1;
    }
    .copy {
        transform: translate(-80%, -30%);
    }

    /* trail */

    .node.trail::before {
        content: "";
        position: absolute;
        background-color: var(--primary-lighter);

        display: flex;
        align-items: center;
        justify-content: center;

        font-size: 0.6em;
        font-weight: bold;
        text-shadow: 0 0 4px rgb(0 0 18 / 0.4);
    }
    .node.trail.and::before {
        content: "AND";
        top: 0;
        left: 50%;
        width: 2px;
        height: var(--gap);
        transform: translate(-50%, -100%);
    }
    .node.trail.or::before {
        content: "OR";
        top: 50%;
        left: 0;
        width: var(--gap);
        height: 2px;
        transform: translate(-100%, -50%);
    }
    .node.trail.first::before {
        content: "";
    }

    /* add */

    .buttons.node {
        position: relative;
        display: flex;
        gap: 5px;

        border-radius: 22px;
        padding: 4px;
    }
    .buttons :global(button) {
        border-radius: 50%;
        padding: 8px;
    }
    .buttons.node.or {
        flex-direction: column;
    }
</style>
