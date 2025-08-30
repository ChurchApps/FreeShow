<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { timers } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { sortByName } from "../../helpers/array"
    import { getDynamicIds, getVariablesIds } from "../../helpers/showActions"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    // import type { Condition } from "../../../../types/Show"

    export let input: { [key: string]: string }

    $: elementId = input.element ?? conditionValues.element[0]?.value
    $: operatorOptions = customOperators[elementId] ? customOperators[elementId] : conditionValues.operator
    $: operatorId = input.operator ? input.operator : operatorOptions[0]?.value

    const conditionValues = {
        element: [
            { value: "text", label: translateText("edit.text") },
            { value: "timer", label: translateText("items.timer") },
            { value: "variable", label: translateText("items.variable") },
            { value: "dynamicValue", label: translateText("actions.dynamic_value") }
        ],
        operator: [
            { value: "is", label: translateText("conditions.is") },
            { value: "isNot", label: translateText("conditions.is_not") },
            { value: "has", label: translateText("conditions.has") },
            { value: "hasNot", label: translateText("conditions.has_not") }
        ],
        data: [{ value: "value", label: translateText("conditions.value") }] // { id: "state" }
    }

    // WIP time_hours/video_time etc. should be treated as number like timer, instead of string

    const customOperators = {
        timer: [
            { value: "isRunning", label: translateText("conditions.is_running") },
            { value: "isAbove", label: translateText("conditions.is_above") },
            { value: "isBelow", label: translateText("conditions.is_below") },
            { value: "is", label: translateText("conditions.is") },
            { value: "isNot", label: translateText("conditions.is_not") }
        ]
        // text: [{ value: "has_text", name: translateText("conditions.has_text") }, ...conditions.operator],
    }
    const customData = {
        timer: [{ value: "seconds", label: translateText("conditions.seconds") }]
    }
    const noData: string[] = ["isRunning"] // ["has_text"]

    const elementOptions = {
        timer: [{ value: "", label: translateText("stage.first_active_timer") }, ...convertToOptions($timers)],
        variable: getVariables(),
        dynamicValue: getDynamicIds(true).map((a) => ({ value: a, label: a }))
    }
    export function convertToOptions(object) {
        const options = Object.keys(object).map((id) => ({ value: id, label: object[id].name }))
        return sortByName(options, "label")
    }

    function getVariables() {
        const variablesList = getVariablesIds()

        return variablesList.map((id) => {
            let name = id.replace("$", "").replace("variable_set_", "Set: ").replaceAll("__", ": ").replaceAll("_", " ")
            name = name[0].toUpperCase() + name.slice(1)
            return { value: id, label: name }
        })
    }

    // UPDATE

    const dispatch = createEventDispatcher()
    function setValue(conditionId: string, e: any) {
        dispatch("change", { key: conditionId, value: e.detail })
    }
</script>

<div class="box">
    {#each Object.entries(conditionValues) as [conditionId, condition]}
        {#if (conditionId === "element" || input.element) && (conditionId !== "data" || !noData.includes(operatorId))}
            {@const options = conditionId === "operator" ? operatorOptions : conditionId === "data" && customData[elementId] ? customData[elementId] : condition}
            {@const value = options.find((a) => a.value === input[conditionId]) || options[0]}
            {@const label = conditionId === "operator" ? "actions.mode" : conditionId === "data" ? "variables.value" : "sort.type"}

            {#if conditionId !== "data" || options.length > 1}
                <MaterialDropdown {label} {options} value={conditionId === "element" ? input[conditionId] : value?.value} on:change={(e) => setValue(conditionId, e)} />
            {/if}

            {#if conditionId === "element" && elementOptions[value.value]}
                <MaterialDropdown label="tools.item" options={elementOptions[value.value]} value={input.elementId} on:change={(e) => setValue("elementId", e)} />
            {/if}

            {#if conditionId === "data"}
                {#if value.value === "value"}
                    <MaterialTextInput label="variables.value" placeholder={translateText("conditions.empty")} value={typeof input.value === "string" ? input.value : ""} on:change={(e) => setValue("value", e)} />
                {:else if value.value === "seconds"}
                    <MaterialNumberInput label="timer.seconds" value={typeof input.seconds === "number" ? input.seconds : 0} max={800000} on:change={(e) => setValue("seconds", e)} />
                {/if}
            {/if}
        {/if}
    {/each}
</div>

<style>
    .box {
        display: flex;
        flex-direction: column;

        min-width: 220px;
    }
</style>
