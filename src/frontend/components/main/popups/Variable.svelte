<script lang="ts">
    import { uid } from "uid"
    import { drawerTabsData, selected, variables } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { clone, moveToPos } from "../../helpers/array"
    import { createStore, updateStore } from "../../helpers/historyStores"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialMultiChoice from "../../inputs/MaterialMultiChoice.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    let chosenType = ""
    const types = [
        { id: "number", name: translateText("variables.number"), icon: "number" },
        { id: "random_number", name: translateText("variables.random_number"), icon: "unknown" },
        { id: "text", name: translateText("variables.text"), icon: "text" },
        { id: "text_set", name: translateText("variables.text_set"), icon: "increase_text" }
    ]

    const DEFAULT_VARIABLE = {
        name: "",
        type: "number"
    }

    let existing: boolean = $selected.id === "variable" && $selected.data[0]?.id
    let variableId = existing ? $selected.data[0].id : uid()
    let currentVariable = clone($variables[variableId] || DEFAULT_VARIABLE)
    let created = !existing

    function updateValue(e: any, key: string) {
        let value = e?.target?.value ?? e
        if (value === undefined) return

        // update current number if default is changed
        if (key === "default" && Number(currentVariable.number || 0) === Number(currentVariable.default || 0)) currentVariable.number = Number(value)

        if (key === "minValue") {
            if (Number(currentVariable.default || 0) < value) updateValue(value, "default")
            if (max < value) updateValue(value, "maxValue")
        }
        if (key === "maxValue") {
            if (Number(currentVariable.default || 0) > value) updateValue(value, "default")
            if (min > value) updateValue(value, "minValue")
        }

        // can't have the same name as existing
        if (key === "name") {
            let existing
            do {
                existing = Object.entries($variables).find(([id, a]) => id !== variableId && value.toLowerCase() === a.name.toLowerCase())
                if (existing) value += " 2"
            } while (existing)
        }

        currentVariable[key] = value

        if (key === "type") return

        if (existing) {
            updateStore("variables", variableId, currentVariable)
        } else {
            // set tag
            if ($drawerTabsData.functions?.activeSubTab === "variables" && $drawerTabsData.functions?.activeSubmenu) {
                currentVariable.tags = [$drawerTabsData.functions?.activeSubmenu]
            }

            createStore("variables", currentVariable, variableId)
            existing = true
        }
    }

    function updateSet(index: number, e: any, key: string) {
        let value = e?.target?.value ?? e
        if (!value) return

        if (!currentVariable.sets) currentVariable.sets = []
        if (!currentVariable.sets[index]) currentVariable.sets[index] = clone(DEFAULT_SET)

        currentVariable.sets[index][key] = value

        variables.update((a) => {
            a[variableId] = currentVariable
            return a
        })
    }

    function removeSet(index: number) {
        if (!currentVariable.sets?.[index]) return

        currentVariable.sets.splice(index, 1)
        currentVariable = currentVariable

        variables.update((a) => {
            a[variableId] = currentVariable
            return a
        })
    }

    const minAbsolute = -10000000
    const maxAbsolute = 10000000
    const minDefault = 0
    const maxDefault = 1000
    $: console.log(currentVariable.minValue)
    $: min = Number(currentVariable.minValue ?? minDefault)
    $: max = Number(currentVariable.maxValue ?? maxDefault)

    const DEFAULT_SET = { name: "", minValue: 1, maxValue: 1000 }

    // TEXT SET

    function addTextSet() {
        if (!currentVariable.textSets) currentVariable.textSets = [{}]
        currentVariable.textSets.push({})
        currentVariable = currentVariable

        variables.update((a) => {
            a[variableId] = currentVariable
            return a
        })
    }

    function moveTextSetUp(index: number) {
        if (currentVariable.textSets?.[index] === undefined) return

        currentVariable.textSets = moveToPos(currentVariable.textSets, index, index - 1)
        currentVariable = currentVariable

        variables.update((a) => {
            a[variableId] = currentVariable
            return a
        })
    }

    function removeTextSet(index: number) {
        if (currentVariable.textSets?.[index] === undefined) return

        currentVariable.textSets.splice(index, 1)
        currentVariable = currentVariable

        variables.update((a) => {
            a[variableId] = currentVariable
            return a
        })
    }

    function addTextSetVariable() {
        if (!currentVariable.textSetKeys) currentVariable.textSetKeys = [""]
        currentVariable.textSetKeys.push("")
        currentVariable = currentVariable

        variables.update((a) => {
            a[variableId] = currentVariable
            return a
        })
    }

    function moveKeyUp(index: number) {
        if (currentVariable.textSetKeys?.[index] === undefined) return

        currentVariable.textSetKeys = moveToPos(currentVariable.textSetKeys, index, index - 1)
        currentVariable = currentVariable

        variables.update((a) => {
            a[variableId] = currentVariable
            return a
        })
    }

    function removeTextSetVariable(index: number) {
        if (currentVariable.textSetKeys?.[index] === undefined) return

        currentVariable.textSetKeys.splice(index, 1)
        currentVariable = currentVariable

        variables.update((a) => {
            a[variableId] = currentVariable
            return a
        })
    }

    function updateTextSetVariableName(index: number, e: any) {
        if (!currentVariable.textSetKeys) currentVariable.textSetKeys = [""]

        let value = e.detail || ""
        while (currentVariable.textSetKeys.find((name, i) => i !== index && name === value)) value += " 2"
        currentVariable.textSetKeys[index] = value

        variables.update((a) => {
            a[variableId] = currentVariable
            return a
        })
    }
    function textSetKeydown(e: any) {
        if (e.key === "Tab" && e.target?.value) {
            addTextSetVariable()
        }
    }

    function updateTextSetValue(index: number, name: string, e: any) {
        if (!currentVariable.textSets) currentVariable.textSets = [{}]

        if (!currentVariable.textSets[index]) currentVariable.textSets[index] = {}
        const value = e.detail || ""
        currentVariable.textSets[index][name] = value

        variables.update((a) => {
            a[variableId] = currentVariable
            return a
        })
    }

    let showMoreRN = false
</script>

{#if !existing && !chosenType}
    <MaterialMultiChoice
        options={types}
        on:click={(e) => {
            chosenType = e.detail
            updateValue(chosenType, "type")
        }}
    />
{:else}
    {#if !existing}
        <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => (chosenType = "")} />
    {/if}

    <MaterialTextInput label="inputs.name" style="margin-bottom: 10px;" disabled={!created && !!currentVariable.name} value={currentVariable.name} on:change={(e) => updateValue(e.detail, "name")} autofocus={!currentVariable.name} />

    {#if currentVariable.type === "number"}
        <MaterialNumberInput label="variables.default_value" value={currentVariable.default || 0} step={1} {min} {max} on:change={(e) => updateValue(e.detail, "default")} />
        <InputRow>
            <MaterialNumberInput label="variables.minimum" value={currentVariable.minValue ?? minDefault} step={1} min={minAbsolute} max={maxAbsolute} on:change={(e) => updateValue(e.detail, "minValue")} />
            <MaterialNumberInput label="variables.maximum" value={currentVariable.maxValue ?? maxDefault} step={1} min={minAbsolute} max={maxAbsolute} on:change={(e) => updateValue(e.detail, "maxValue")} />
        </InputRow>

        <!-- WIP custom step sizes "1,8:2,10:2" ?? -->
    {:else if currentVariable.type === "random_number"}
        <MaterialButton class="popup-options {showMoreRN ? 'active' : ''}" icon="options" iconSize={1.3} title={showMoreRN ? "actions.close" : "create_show.more_options"} on:click={() => (showMoreRN = !showMoreRN)} white />

        {#if showMoreRN}
            <MaterialToggleSwitch label="popup.animate" checked={currentVariable.animate} defaultValue={false} on:change={(e) => updateValue(e.detail, "animate")} />
            <MaterialToggleSwitch label="edit.each_number_once" checked={currentVariable.eachNumberOnce} defaultValue={false} on:change={(e) => updateValue(e.detail, "eachNumberOnce")} />

            <HRule />
        {/if}

        {#each currentVariable.sets || [DEFAULT_SET] as set, i}
            <InputRow style="border-radius: 4px;overflow: hidden;">
                {#if (currentVariable.sets?.length || 0) > 1}
                    <span style="background-color: var(--primary-darker);font-weight: bold;font-size: 0.8em;display: flex;align-items: center;padding: 0 10px;"><span style="color: var(--secondary);display: flex;align-items: center;">#</span>{i + 1}</span>
                    <MaterialTextInput label="inputs.name" style="flex: 2;" value={set.name} on:change={(e) => updateSet(i, e.detail, "name")} autofocus={!!currentVariable.name && !set.name} />
                {/if}

                <!-- WIP no negative numbers at the moment -->
                <MaterialNumberInput label="variables.minimum" style="flex: 1;" value={set.minValue ?? DEFAULT_SET.minValue} step={1} max={maxAbsolute} on:change={(e) => updateSet(i, e.detail, "minValue")} />
                <MaterialNumberInput label="variables.maximum" style="flex: 1;" value={set.maxValue ?? DEFAULT_SET.maxValue} step={1} max={maxAbsolute} on:change={(e) => updateSet(i, e.detail, "maxValue")} />
                <!-- {#if i > 0 && i === (currentVariable.sets?.length || 0) - 1} -->
                {#if (currentVariable.sets?.length || 1) > 1}
                    <MaterialButton icon="delete" title="actions.delete" on:click={() => removeSet(i)} />
                {/if}
            </InputRow>
        {/each}

        <!-- {#if (currentVariable.sets?.length || 0) < 2 || currentVariable.sets?.[currentVariable.sets?.length - 1]?.name} -->
        <MaterialButton
            variant="outlined"
            icon="add"
            on:click={() => {
                if (!currentVariable.sets) updateSet(0, DEFAULT_SET.minValue, "minValue")
                updateSet(currentVariable.sets?.length || 0, DEFAULT_SET.minValue, "minValue")
            }}
        >
            <T id="variables.add_set" />
        </MaterialButton>
        <!-- {/if} -->

        {#if currentVariable.setLog?.length}
            <HRule title="popup.history" />

            <div class="log" style="overflow: auto;max-height: 250px;">
                {#each currentVariable.setLog as log}
                    <InputRow style="border-radius: 4px;overflow: hidden;background-color: var(--primary-darker);border-bottom: 1px solid var(--primary-lighter);">
                        {#if (currentVariable.sets?.length || 0) > 1}<p style="width: 30%;min-width: initial;padding: 6px 10px;">{log.name}</p>{/if}
                        <p style="border-left: 1px solid var(--primary-lighter);padding: 6px 10px;">{log.number}</p>
                    </InputRow>
                {/each}
            </div>
        {/if}
    {:else if currentVariable.type === "text_set"}
        {#each currentVariable.textSets?.length ? currentVariable.textSets : [{}] as textSet, i}
            <div class="text_set" style={i === 0 ? "" : "margin-top: 10px;"} class:active={(currentVariable.textSets?.length ?? 1) > 1 && (currentVariable.activeTextSet ?? 0) === i}>
                <p style="border-bottom: 1px solid var(--primary-lighter);" class="part"><span style="color: var(--secondary);">#</span>{i + 1}</p>

                {#each currentVariable.textSetKeys ?? [""] as key, keyIndex}
                    <InputRow>
                        {#if i === 0}
                            <MaterialTextInput label="inputs.name" disabled={!!(key && textSet?.[key]) || i > 0} value={key} on:input={(e) => updateTextSetVariableName(keyIndex, e)} on:keydown={textSetKeydown} />
                        {:else}
                            <p style="width: 50%;display: flex;align-items: center;padding: 0 10px;border-bottom: 1px solid var(--primary-lighter);">{key}</p>
                        {/if}

                        <MaterialTextInput label="variables.value" disabled={!key} value={textSet[key] || ""} on:change={(e) => updateTextSetValue(i, key, e)} />

                        {#if (currentVariable.textSetKeys?.length ?? 1) > 1 && i === 0}
                            {#if keyIndex > 0}
                                <MaterialButton icon="up" on:click={() => moveKeyUp(keyIndex)} />
                            {/if}
                            <MaterialButton icon="delete" title="actions.delete" on:click={() => removeTextSetVariable(keyIndex)} />
                        {/if}
                    </InputRow>
                {/each}

                {#if i === 0}
                    <MaterialButton style="width: 100%;" icon="add" disabled={!currentVariable.textSetKeys?.length || currentVariable.textSetKeys.find((a) => !a) === ""} on:click={addTextSetVariable}>
                        <T id="new.variable" />
                    </MaterialButton>
                {/if}
                <!-- removed to clear up confusion in regards to the main variables being editable here -->
                <!-- || (currentVariable.textSets?.length || 1) > 1 -->
                {#if i > 0}
                    <div class="delete">
                        <MaterialButton style="padding: 8px;" icon="up" on:click={() => moveTextSetUp(i)} />
                        <MaterialButton style="padding: 8px;" icon="delete" title="actions.delete" on:click={() => removeTextSet(i)} />
                    </div>
                {/if}
            </div>
        {/each}

        <MaterialButton variant="outlined" style="margin-top: 10px;width: 100%;" icon="add" disabled={!currentVariable.textSets?.length} on:click={addTextSet}>
            <T id="variables.add_set" />
        </MaterialButton>
    {/if}
{/if}

<style>
    /* text set */

    .text_set {
        flex: 1;
        min-height: unset;

        position: relative;

        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);

        border-radius: 8px;
        overflow: hidden;
    }
    .text_set.active {
        border: 2px solid var(--secondary) !important;
    }

    .part {
        width: 100%;
        padding: 5px 10px;
        /* justify-content: center; */
        font-size: 0.8em;
        font-weight: bold;
    }

    .delete {
        position: absolute;
        top: 0;
        right: 0;

        display: flex;
    }
</style>
