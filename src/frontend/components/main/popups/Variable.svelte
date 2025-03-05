<script lang="ts">
    import { uid } from "uid"
    import { dictionary, selected, variables } from "../../../stores"
    import { clone } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"

    let chosenType = ""
    const types = [
        { id: "number", name: "$:variables.number:$", icon: "number" },
        { id: "text", name: "$:variables.text:$", icon: "text" },
    ]

    const DEFAULT_VARIABLE = {
        name: "",
        type: "number",
    }

    let existing: boolean = $selected.id === "variable" && $selected.data[0]?.id
    let variableId = existing ? $selected.data[0].id : uid()
    let currentVariable = clone($variables[variableId] || DEFAULT_VARIABLE)

    function updateValue(e: any, key: string) {
        let value = e?.target?.value ?? e
        if (!value) return

        // update current number if default is changed
        if (key === "default" && Number(currentVariable.number || 0) === Number(currentVariable.default || 0)) currentVariable.number = Number(value)

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
        <Button style="position: absolute;left: 0;top: 0;min-height: 58px;" title={$dictionary.actions?.back} on:click={() => (chosenType = "")}>
            <Icon id="back" size={2} white />
        </Button>
    {/if}

    <CombinedInput textWidth={30}>
        <p><T id="inputs.name" /></p>
        <TextInput disabled={existing && currentVariable.name} value={currentVariable.name} on:change={(e) => updateValue(e, "name")} autofocus={!currentVariable.name} />
    </CombinedInput>

    {#if currentVariable.type === "number"}
        <CombinedInput textWidth={30}>
            <p><T id="variables.default_value" /></p>
            <NumberInput value={currentVariable.default || 0} step={1} decimals={1} fixed={Number(currentVariable.default).toString().includes(".") ? 1 : 0} on:change={(e) => updateValue(e.detail, "default")} buttons={false} />
        </CombinedInput>
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
