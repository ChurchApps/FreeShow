<script lang="ts">
    import { uid } from "uid"
    import { dictionary, drawerTabsData, selected, variables } from "../../../stores"
    import { translate } from "../../../utils/language"
    import { clone, moveToPos } from "../../helpers/array"
    import { createStore, updateStore } from "../../helpers/historyStores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialMultiChoice from "../../inputs/MaterialMultiChoice.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    let chosenType = ""
    const types = [
        { id: "number", name: translate("variables.number"), icon: "number" },
        { id: "random_number", name: translate("variables.random_number"), icon: "unknown" },
        { id: "text", name: translate("variables.text"), icon: "text" },
        { id: "text_set", name: translate("variables.text_set"), icon: "increase_text" }
    ]

    const DEFAULT_VARIABLE = {
        name: "",
        type: "number"
    }

    let existing: boolean = $selected.id === "variable" && $selected.data[0]?.id
    let variableId = existing ? $selected.data[0].id : uid()
    let currentVariable = clone($variables[variableId] || DEFAULT_VARIABLE)

    function updateValue(e: any, key: string, checkbox = false) {
        let value = e?.target?.value ?? e
        if (checkbox) value = e.target.checked
        if (!value && !checkbox) return

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

        let value = e.target?.value || ""
        while (currentVariable.textSetKeys.find((name, i) => i !== index && name === value)) value += " 2"
        currentVariable.textSetKeys[index] = value

        variables.update((a) => {
            a[variableId] = currentVariable
            return a
        })
    }

    function updateTextSetValue(index: number, name: string, e: any) {
        if (!currentVariable.textSets) currentVariable.textSets = [{}]

        if (!currentVariable.textSets[index]) currentVariable.textSets[index] = {}
        const value = e.target?.value || ""
        currentVariable.textSets[index][name] = value

        variables.update((a) => {
            a[variableId] = currentVariable
            return a
        })
    }
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

    <CombinedInput textWidth={30}>
        <p><T id="inputs.name" /></p>
        <TextInput disabled={!!(existing && currentVariable.name)} value={currentVariable.name} on:change={(e) => updateValue(e, "name")} autofocus={!currentVariable.name} />
    </CombinedInput>

    {#if currentVariable.type === "number"}
        <CombinedInput textWidth={30}>
            <p><T id="variables.default_value" /></p>
            <NumberInput value={currentVariable.default || 0} step={1} decimals={1} {min} {max} fixed={Number(currentVariable.default).toString().includes(".") ? 1 : 0} on:change={(e) => updateValue(e.detail, "default")} buttons={false} />
        </CombinedInput>

        <CombinedInput textWidth={30}>
            <p><T id="variables.minimum" /></p>
            <NumberInput
                value={currentVariable.minValue ?? minDefault}
                step={1}
                decimals={1}
                min={minAbsolute}
                max={maxAbsolute}
                fixed={Number(currentVariable.default).toString().includes(".") ? 1 : 0}
                on:change={(e) => updateValue(e.detail, "minValue")}
                buttons={false}
            />
        </CombinedInput>
        <CombinedInput textWidth={30}>
            <p><T id="variables.maximum" /></p>
            <NumberInput
                value={currentVariable.maxValue ?? maxDefault}
                step={1}
                decimals={1}
                min={minAbsolute}
                max={maxAbsolute}
                fixed={Number(currentVariable.default).toString().includes(".") ? 1 : 0}
                on:change={(e) => updateValue(e.detail, "maxValue")}
                buttons={false}
            />
        </CombinedInput>

        <!-- WIP custom step sizes "1,8:2,10:2" ?? -->
    {:else if currentVariable.type === "random_number"}
        <CombinedInput>
            <p style="flex: 1;"><T id="popup.animate" /></p>
            <span class="alignRight" style="flex: 0;padding: 0 10px;">
                <Checkbox checked={currentVariable.animate} on:change={(e) => updateValue(e, "animate", true)} />
            </span>
        </CombinedInput>

        <CombinedInput>
            <p style="flex: 1;"><T id="edit.each_number_once" /></p>
            <span class="alignRight" style="flex: 0;padding: 0 10px;">
                <Checkbox checked={currentVariable.eachNumberOnce} on:change={(e) => updateValue(e, "eachNumberOnce", true)} />
            </span>
        </CombinedInput>

        <HRule />

        {#each currentVariable.sets || [DEFAULT_SET] as set, i}
            <CombinedInput>
                {#if (currentVariable.sets?.length || 0) > 1}
                    <span style="font-weight: bold;display: flex;align-items: center;margin: 0 8px;"><span style="color: var(--secondary);display: flex;align-items: center;">#</span>{i + 1}</span>
                    <TextInput style="flex: 1;" placeholder={$dictionary.inputs?.name} value={set.name} on:change={(e) => updateSet(i, e, "name")} autofocus={!!currentVariable.name && !set.name} />
                {/if}

                <!-- WIP no negative numbers at the moment -->
                <NumberInput style="flex: 1;" title={$dictionary.variables?.minimum} value={set.minValue ?? DEFAULT_SET.minValue} step={1} max={maxAbsolute} on:change={(e) => updateSet(i, e.detail, "minValue")} buttons={false} />
                <NumberInput style="flex: 1;" title={$dictionary.variables?.maximum} value={set.maxValue ?? DEFAULT_SET.maxValue} step={1} max={maxAbsolute} on:change={(e) => updateSet(i, e.detail, "maxValue")} buttons={false} />
                {#if i > 0 && i === (currentVariable.sets?.length || 0) - 1}
                    <Button on:click={() => removeSet(i)} title={$dictionary.actions?.delete}>
                        <Icon id="delete" />
                    </Button>
                {/if}
            </CombinedInput>
        {/each}

        <!-- {#if (currentVariable.sets?.length || 0) < 2 || currentVariable.sets?.[currentVariable.sets?.length - 1]?.name} -->
        <CombinedInput>
            <Button
                on:click={() => {
                    if (!currentVariable.sets) updateSet(0, DEFAULT_SET.minValue, "minValue")
                    updateSet(currentVariable.sets?.length || 0, DEFAULT_SET.minValue, "minValue")
                }}
                style="width: 100%;"
                center
            >
                <Icon id="add" right />
                <T id="variables.add_set" />
            </Button>
        </CombinedInput>
        <!-- {/if} -->

        {#if currentVariable.setLog?.length}
            <HRule title="popup.history" />

            <div class="log" style="overflow: auto;max-height: 250px;">
                {#each currentVariable.setLog as log}
                    <CombinedInput>
                        {#if (currentVariable.sets?.length || 0) > 1}<p style="width: 30%;min-width: initial;">{log.name}</p>{/if}
                        <p>{log.number}</p>
                    </CombinedInput>
                {/each}
            </div>
        {/if}
    {:else if currentVariable.type === "text_set"}
        {#each currentVariable.textSets?.length ? currentVariable.textSets : [{}] as textSet, i}
            <div class="text_set" style={i === 0 ? "margin-top: 10px;" : "border-top: 2px solid var(--primary-lighter);"} class:active={(currentVariable.textSets?.length ?? 1) > 1 && (currentVariable.activeTextSet ?? 0) === i}>
                <p style="border: none;min-height: unset;" class="part"><span style="color: var(--secondary);">#</span>{i + 1}</p>

                {#each currentVariable.textSetKeys ?? [""] as key, keyIndex}
                    <CombinedInput>
                        {#if i === 0}
                            <TextInput style="flex: 1;" placeholder={$dictionary.inputs?.name} disabled={!!(key && textSet?.[key]) || i > 0} value={key} on:change={(e) => updateTextSetVariableName(keyIndex, e)} />
                        {:else}
                            <p>{key}</p>
                        {/if}
                        <TextInput placeholder={$dictionary.variables?.value} disabled={!key} value={textSet[key] || ""} on:change={(e) => updateTextSetValue(i, key, e)} />

                        {#if (currentVariable.textSetKeys?.length ?? 1) > 1 && i === 0}
                            {#if keyIndex > 0}
                                <Button on:click={() => moveKeyUp(keyIndex)}>
                                    <Icon id="up" white />
                                </Button>
                            {/if}
                            <Button on:click={() => removeTextSetVariable(keyIndex)} title={$dictionary.actions?.delete} style="padding: 8px;">
                                <Icon id="delete" white />
                            </Button>
                        {/if}
                    </CombinedInput>
                {/each}

                {#if i === 0}
                    <CombinedInput>
                        <Button on:click={addTextSetVariable} disabled={!currentVariable.textSetKeys?.length || currentVariable.textSetKeys.find((a) => !a) === ""} style="width: 100%;" center>
                            <Icon id="add" right />
                            <T id="new.variable" />
                        </Button>
                    </CombinedInput>
                {/if}
                <!-- removed to clear up confusion in regards to the main variables being editable here -->
                <!-- || (currentVariable.textSets?.length || 1) > 1 -->
                {#if i > 0}
                    <div class="delete">
                        <Button on:click={() => removeTextSet(i)} title={$dictionary.actions?.delete} style="padding: 8px;">
                            <Icon id="delete" />
                        </Button>
                    </div>
                {/if}
            </div>
        {/each}

        <CombinedInput style="margin-top: 5px;">
            <Button on:click={addTextSet} disabled={!currentVariable.textSets?.length} style="width: 100%;" center>
                <Icon id="add" right />
                <T id="variables.add_set" />
            </Button>
        </CombinedInput>
    {/if}
{/if}

<style>
    /* text set */

    .text_set {
        flex: 1;
        min-height: unset;

        position: relative;

        background-color: var(--primary-darker);
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
    }
</style>
