<script lang="ts">
    import { activePopup, dictionary, disableDragging, labelsDisabled, variables } from "../../../stores"
    import { keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    export let searchValue
    console.log(searchValue)

    const typeOrder = { number: 1, text: 2 }
    $: sortedVariables = sortByName(keysToID($variables), "name", true).sort((a, b) => typeOrder[a.type] - typeOrder[b.type])

    function updateVariable(e: any, id: string, key: string) {
        let value = e?.target?.value ?? e
        if (key === "enabled") value = e?.target?.checked || false

        variables.update((a) => {
            a[id][key] = value

            return a
        })
    }

    function mousedown(e: any) {
        if (!e.target?.closest(".variables")) return
        if (e.target?.tagName === "INPUT" || e.target?.closest("button")) disableDragging.set(true)
    }

    const typeNames = {
        number: "variables.number",
        text: "variables.text",
    }

    $: numberVariables = sortedVariables.filter((a) => a.type === "number")
    $: otherVariables = sortedVariables.filter((a) => a.type !== "number")

    const minDefault = 0
    const maxDefault = 1000
</script>

<svelte:window on:mouseup={() => disableDragging.set(false)} on:mousedown={mousedown} />

<div class="variables">
    {#if sortedVariables.length}
        <div class="row" style={otherVariables.length ? "" : "height: calc(100% - 10px);align-items: center;"}>
            {#each numberVariables as variable}
                {@const number = Number(variable.number) || 0}
                {@const stepSize = Number(variable.step) || 1}
                {@const defaultValue = Number(variable.default) || 0}
                {@const min = Number(variable.minValue ?? minDefault)}
                {@const max = Number(variable.maxValue ?? maxDefault)}

                <SelectElem style="width: calc(25% - 5px);" id="variable" data={variable} draggable>
                    <div class="variable numberBox context #variable">
                        <div class="reset">
                            <Button title={$dictionary.actions?.reset} on:click={() => updateVariable(defaultValue, variable.id, "number")}>
                                <Icon id="reset" />
                            </Button>
                        </div>

                        <div class="bigNumber">
                            <NumberInput
                                title={$dictionary.variables?.value}
                                style="width: 100%;"
                                value={number}
                                {min}
                                {max}
                                step={stepSize}
                                decimals={1}
                                fixed={number.toString().includes(".") ? 1 : 0}
                                buttons={false}
                                on:change={(e) => updateVariable(e.detail, variable.id, "number")}
                            />
                        </div>

                        <span style="justify-content: center;padding: 5px;width: 100%;">
                            <Icon id={variable.type} right />
                            <p title={variable.name}>
                                {#if variable.name?.length}
                                    {variable.name}
                                {:else}
                                    <span style="opacity: 0.5;font-style: italic;"><T id="main.unnamed" /></span>
                                {/if}
                            </p>
                        </span>

                        <div class="buttons">
                            <Button id="decrement" title={$dictionary.actions?.decrement} on:click={() => updateVariable(Math.max(min, number - 1 * stepSize), variable.id, "number")} center style={"flex: 1;"} disabled={number <= min} dark>
                                <Icon id="remove" size={2.8} white />
                            </Button>
                            <Button id="increment" title={$dictionary.actions?.increment} on:click={() => updateVariable(Math.min(max, number + 1 * stepSize), variable.id, "number")} center style={"flex: 1;"} disabled={number >= max} dark>
                                <Icon id="add" size={2.8} white />
                            </Button>
                        </div>

                        <div class="inputs">
                            <NumberInput
                                title={$dictionary.variables?.step}
                                style="flex: 1;"
                                value={stepSize}
                                min={0.1}
                                step={1}
                                decimals={1}
                                fixed={stepSize.toString().includes(".") ? 1 : 0}
                                on:change={(e) => updateVariable(e.detail, variable.id, "step")}
                                buttons={false}
                            />
                            <!-- <NumberInput
                                title={$dictionary.variables?.default_value}
                                style="flex: 1;"
                                value={defaultValue}
                                {min}
                                {max}
                                step={1}
                                decimals={1}
                                fixed={defaultValue.toString().includes(".") ? 1 : 0}
                                on:change={(e) => updateVariable(e.detail, variable.id, "default")}
                                buttons={false}
                            /> -->
                        </div>
                    </div>
                </SelectElem>
            {/each}
        </div>

        {#if numberVariables.length && otherVariables.length}
            <h5><T id={typeNames.text} /></h5>
        {/if}

        <div class="list">
            {#each otherVariables as variable, i}
                {@const title = variable.type === otherVariables[i - 1]?.type ? "" : variable.type}
                {#if title && i > 0}
                    <h5><T id={typeNames[title]} /></h5>
                {/if}

                <SelectElem id="variable" data={variable} draggable>
                    <div class="variable context #variable">
                        <span style="padding-left: 5px;">
                            <Icon id={variable.type} right />
                            <p>
                                {#if variable.name?.length}
                                    {variable.name}
                                {:else}
                                    <span style="opacity: 0.5;font-style: italic;"><T id="main.unnamed" /></span>
                                {/if}
                            </p>
                        </span>

                        <span style="gap: 5px;width: 70%;">
                            {#if variable.type === "text"}
                                <TextInput placeholder={$dictionary.variables?.value || ""} value={variable.text || ""} on:change={(e) => updateVariable(e, variable.id, "text")} />
                                <Checkbox checked={variable.enabled ?? true} on:change={(e) => updateVariable(e, variable.id, "enabled")} />
                            {/if}
                        </span>
                    </div>
                </SelectElem>
            {/each}
        </div>
    {:else}
        <Center faded>
            <T id="empty.general" />
        </Center>
    {/if}
</div>

<div style="display: flex;background-color: var(--primary-darkest);">
    <Button style="flex: 1;" on:click={() => activePopup.set("variable")} center title={$dictionary.new?.variable}>
        <Icon id="add" right={!$labelsDisabled} />
        {#if !$labelsDisabled}<T id="new.variable" />{/if}
    </Button>
</div>

<style>
    .variables {
        flex: 1;
        overflow: auto;
    }
    .variables :global(.selectElem:not(.isSelected):nth-child(even)) {
        background-color: rgb(0 0 20 / 0.08);
    }

    .variables .row {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        margin: 5px;
        gap: 5px;
    }
    .variables .list {
        display: flex;
        flex-direction: column;
    }

    .variable {
        padding: 3px 5px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .variables .row .variable {
        padding: 5px;
    }

    .variable span {
        display: flex;
        align-items: center;
    }

    .variable :global(input),
    .variable :global(.numberInput button) {
        background-color: var(--primary-darkest);
    }

    /* div.outline {
        outline-offset: -2px;
        outline: 2px solid var(--secondary) !important;
    } */

    h5 {
        overflow: visible;
        text-align: center;
        padding: 5px;
        background-color: var(--primary-darkest);
        color: var(--text);
        font-size: 0.8em;
        text-transform: uppercase;
    }

    /* number */

    .numberBox {
        display: flex;
        flex-direction: column;
        border: 2px solid var(--focus);

        max-width: 100%;
        position: relative;
    }

    .reset {
        position: absolute;
        top: 5px;
        right: 5px;
    }
    .reset :global(button) {
        padding: 5px !important;
    }

    .bigNumber {
        font-size: 4em;
    }
    /* .bigNumber :global(.numberInput input) {
        background-color: transparent;
        max-width: 200px;
    } */

    .buttons {
        display: flex;
        width: 100%;
    }

    .inputs {
        display: flex;
        width: 100%;
        gap: 3px;

        font-size: 0.8em;
    }
</style>
