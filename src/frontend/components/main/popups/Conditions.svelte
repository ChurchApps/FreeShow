<script lang="ts">
    import { onMount } from "svelte"
    import type { Condition } from "../../../../types/Show"
    import { activeEdit, activeShow, activeStage, dictionary, overlays, popupData, showsCache, stageShows, templates, timers, variables } from "../../../stores"
    import { clone, convertToOptions, keysToID } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { getLayoutRef } from "../../helpers/show"
    import { getDynamicIds } from "../../helpers/showActions"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    const obj = $popupData.obj || {}
    onMount(() => popupData.set({}))

    const DEFAULT_CONDITION: Condition = { scenario: "all", values: [] }
    const DEFAULT_CONDITIONS: { [key: string]: Condition } = { showItem: DEFAULT_CONDITION }

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

    let conditions = item?.conditions || clone(DEFAULT_CONDITIONS)

    const scenarios = [
        { id: "all", name: "$:conditions.all_conditions:$" },
        { id: "some", name: "$:conditions.some_conditions:$" },
        { id: "none", name: "$:conditions.none_conditions:$" }
    ]

    const conditionValues = {
        element: [
            { id: "text", name: "$:edit.text:$" },
            { id: "timer", name: "$:items.timer:$" },
            { id: "variable", name: "$:items.variable:$" },
            { id: "dynamicValue", name: "$:actions.dynamic_value:$" }
        ],
        operator: [
            { id: "is", name: "$:conditions.is:$" },
            { id: "isNot", name: "$:conditions.is_not:$" },
            { id: "has", name: "$:conditions.has:$" },
            { id: "hasNot", name: "$:conditions.has_not:$" }
        ],
        data: [{ id: "value", name: "$:conditions.value:$" }] // { id: "state" }
    }

    // WIP time_hours/video_time etc. should be treated as number like timer, instead of string

    const customOperators = {
        timer: [
            { id: "isAbove", name: "$:conditions.is_above:$" },
            { id: "isBelow", name: "$:conditions.is_below:$" },
            { id: "is", name: "$:conditions.is:$" },
            { id: "isNot", name: "$:conditions.is_not:$" }
        ]
        // text: [{ id: "has_text", name: "$:conditions.has_text:$" }, ...conditions.operator],
    }
    const customData = {
        timer: [{ id: "seconds", name: "$:conditions.seconds:$" }]
    }
    const noData: string[] = [] // ["has_text"]

    const elementOptions = {
        timer: convertToOptions($timers),
        variable: [
            ...convertToOptions($variables),
            ...keysToID($variables)
                .filter((a) => a.type === "random_number" && (a.sets?.length || 0) > 1)
                .map(({ id, name }) => ({ id, name: `Set: ` + name }))
        ],
        dynamicValue: getDynamicIds(true).map((a) => ({ id: a, name: a }))
    }

    // UPDATE

    function setScenario(conditionType: string, e: any) {
        if (!conditions[conditionType]) conditions[conditionType] = clone(DEFAULT_CONDITION)

        conditions[conditionType].scenario = e.detail.id

        updateItem()
    }

    function setValue(conditionType: string, e: any, conditionId: string, index: number) {
        if (!conditions[conditionType]) conditions[conditionType] = clone(DEFAULT_CONDITION)
        if (!conditions[conditionType].values[index]) conditions[conditionType].values[index] = {}

        const value = e.detail?.id ?? e.target?.value ?? e
        conditions[conditionType].values[index][conditionId] = value

        // remove following values
        let conditionFound = false
        Object.keys(conditionValues).forEach((key) => {
            if (key === conditionId) {
                conditionFound = true
                return
            } else if (!conditionFound) {
                return
            }

            delete conditions[conditionType].values[index][key]
        })

        // change data type
        if (conditionId === "element") {
            if (value === "timer") conditions[conditionType].values[index].data = "seconds"
        }

        updateItem()
    }

    function removeValue(conditionType: string, index: number) {
        if (!conditions[conditionType]) conditions[conditionType] = clone(DEFAULT_CONDITION)

        conditions[conditionType].values.splice(index, 1)

        conditions[conditionType].values = conditions[conditionType].values
        updateItem()
    }

    function addValue(conditionType: string) {
        if (!conditions[conditionType]) conditions[conditionType] = clone(DEFAULT_CONDITION)

        conditions[conditionType].values.push({})

        conditions[conditionType].values = conditions[conditionType].values
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

    $: showItemValues = conditions.showItem?.values?.length ? conditions.showItem.values : [{}]
</script>

<div style="position: relative;height: 100%;min-height: 250px;width: calc(100vw - (var(--navigation-width) + 20px) * 2);overflow-y: auto;">
    <!-- SHOW ITEM IF -->
    <HRule title="conditions.show_item" />
    <CombinedInput>
        <Dropdown style="width: 100%;" value={(scenarios.find((a) => a.id === conditions.showItem?.scenario) || scenarios[0]).name} options={scenarios} on:click={(e) => setScenario("showItem", e)} />
    </CombinedInput>

    {#each showItemValues as input, i}
        {@const elementId = input.element ?? conditionValues.element[0]?.id}
        {@const operatorOptions = customOperators[elementId] ? customOperators[elementId] : conditionValues.operator}
        {@const operatorId = input.operator ? input.operator : operatorOptions[0]?.id}

        <CombinedInput>
            {#each Object.entries(conditionValues) as [conditionId, condition]}
                {#if conditionId !== "data" || !noData.includes(operatorId)}
                    {@const options = conditionId === "operator" ? operatorOptions : conditionId === "data" && customData[elementId] ? customData[elementId] : condition}
                    {@const value = options.find((a) => a.id === input[conditionId]) || options[0]}

                    <Dropdown style="min-width: 150px;" value={value.name} {options} on:click={(e) => setValue("showItem", e, conditionId, i)} />

                    {#if conditionId === "element" && elementOptions[value.id]}
                        <Dropdown style="min-width: 150px;" value={elementOptions[value.id].find((a) => a.id === input.elementId)?.name || "—"} options={elementOptions[value.id]} on:click={(e) => setValue("showItem", e, "elementId", i)} />
                    {/if}

                    {#if conditionId === "data"}
                        {#if value.id === "value"}
                            <TextInput placeholder={$dictionary.conditions?.empty} value={typeof input.value === "string" ? input.value : ""} on:change={(e) => setValue("showItem", e, "value", i)} />
                        {:else if value.id === "seconds"}
                            <NumberInput value={typeof input.seconds === "number" ? input.seconds : 0} on:change={(e) => setValue("showItem", Number(e.detail), "seconds", i)} />
                        {/if}
                    {/if}
                {/if}
            {/each}

            {#if i > 0 && i === showItemValues.length - 1}
                <Button on:click={() => removeValue("showItem", i)} title={$dictionary.actions?.delete}>
                    <Icon id="delete" />
                </Button>
            {/if}
        </CombinedInput>
    {/each}

    <CombinedInput>
        <Button on:click={() => addValue("showItem")} style="width: 100%;" center>
            <Icon id="add" right />
            <T id="settings.add" />
        </Button>
    </CombinedInput>
</div>

<style>
    div :global(.title) {
        margin-top: 0;
    }
</style>
