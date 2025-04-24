<script lang="ts">
    import { uid } from "uid"
    import { dictionary, selected, variables } from "../../../stores"
    import { clone } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"

    let chosenType = ""
    const types = [
        { id: "number", name: "$:variables.number:$", icon: "number" },
        { id: "random_number", name: "$:variables.random_number:$", icon: "unknown" },
        { id: "text", name: "$:variables.text:$", icon: "text" },
    ]

    const DEFAULT_VARIABLE = {
        name: "",
        type: "number",
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

        variables.update((a) => {
            a[variableId] = currentVariable
            return a
        })
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
</script>

{#if !existing && !chosenType}
    <div class="buttons">
        {#each types as type}
            <Button
                on:click={() => {
                    chosenType = type.id
                    updateValue(type.id, "type")
                }}
                style={type.id === "counter" ? "border: 2px solid var(--focus);" : ""}
            >
                <Icon id={type.icon} size={5} white />
                <p><T id={type.name} /></p>
            </Button>
        {/each}
    </div>
{:else}
    {#if !existing}
        <Button class="popup-back" title={$dictionary.actions?.back} on:click={() => (chosenType = "")}>
            <Icon id="back" size={2} white />
        </Button>
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
                <T id="settings.add" />
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
    {/if}
{/if}

<style>
    .buttons p {
        display: flex;
        align-items: center;
    }

    div.buttons {
        display: flex;
        gap: 10px;
        align-self: center;
    }

    div.buttons :global(button) {
        width: 200px;
        height: 200px;

        display: flex;
        gap: 10px;
        flex-direction: column;
        justify-content: center;
    }
</style>
