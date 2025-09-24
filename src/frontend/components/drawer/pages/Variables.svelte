<script lang="ts">
    import { activePopup, activeVariableTagFilter, dictionary, disableDragging, labelsDisabled, randomNumberVariable, selected, variables } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import { resetVariable } from "../../actions/apiHelper"
    import { keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { getSetChars, setRandomValue } from "../../helpers/randomValue"
    import T from "../../helpers/T.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import Button from "../../inputs/Button.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    export let searchValue

    const profile = getAccess("functions")
    const readOnly = profile.variables === "read"

    const typeOrder = { number: 1, text: 2 }
    $: sortedVariables = sortByName(keysToID($variables), "name", true).sort((a, b) => typeOrder[a.type] - typeOrder[b.type])
    $: filteredVariablesTags = sortedVariables.filter((a) => !$activeVariableTagFilter.length || (a.tags?.length && !$activeVariableTagFilter.find((tagId) => !a.tags?.includes(tagId))))
    $: filteredVariablesSearch = searchValue.length > 1 ? filteredVariablesTags.filter((a) => a.name.toLowerCase().includes(searchValue.toLowerCase())) : filteredVariablesTags

    function updateVariable(e: any, id: string, key: string) {
        let value = e?.target?.value ?? e
        if (key === "enabled") value = e?.detail || false

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
        randomNumber: "variables.random_number",
        text: "variables.text",
        text_set: "variables.text_set"
    }

    $: numberVariables = filteredVariablesSearch.filter((a) => a.type === "number")
    $: randomNumberVariables = filteredVariablesSearch.filter((a) => a.type === "random_number")
    $: textSetVariables = filteredVariablesSearch.filter((a) => a.type === "text_set")
    $: otherVariables = filteredVariablesSearch.filter((a) => a.type !== "number" && a.type !== "random_number" && a.type !== "text_set")

    const minDefault = 0
    const maxDefault = 1000
</script>

<svelte:window on:mouseup={() => disableDragging.set(false)} on:mousedown={mousedown} />

<div class="variables context #variables{readOnly ? '_readonly' : ''}">
    {#if filteredVariablesSearch.length}
        <div class="row" style={randomNumberVariables.length + textSetVariables.length + otherVariables.length ? "" : "height: calc(100% - 15px);align-items: center;"}>
            {#each numberVariables as variable}
                {@const number = Number(variable.number) || 0}
                {@const stepSize = Number(variable.step) || 1}
                {@const defaultValue = Number(variable.default) || 0}
                {@const min = Number(variable.minValue ?? minDefault)}
                {@const max = Number(variable.maxValue ?? maxDefault)}

                <SelectElem style="width: calc(25% - 5px);" id="variable" data={variable} draggable>
                    <div class="variable numberBox context #variable{readOnly ? '_readonly' : ''}">
                        <div class="reset">
                            <Button title={$dictionary.actions?.reset} on:click={() => updateVariable(defaultValue, variable.id, "number")}>
                                <Icon id="reset" white />
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
                            <p data-title={variable.name}>
                                {#if variable.name?.length}
                                    {variable.name}
                                {:else}
                                    <span style="opacity: 0.5;font-style: italic;"><T id="main.unnamed" /></span>
                                {/if}
                            </p>
                        </span>

                        <div class="buttons">
                            <Button id="decrement" title={$dictionary.actions?.decrement} on:click={() => updateVariable(Math.max(min, number - 1 * stepSize), variable.id, "number")} center style="flex: 1;" disabled={number <= min} dark>
                                <Icon id="remove" size={2.8} white />
                            </Button>
                            <Button id="increment" title={$dictionary.actions?.increment} on:click={() => updateVariable(Math.min(max, number + 1 * stepSize), variable.id, "number")} center style="flex: 1;" disabled={number >= max} dark>
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

        {#if numberVariables.length && randomNumberVariables.length}
            <h5><T id={typeNames.randomNumber} /></h5>
        {/if}

        <div class="row" style={numberVariables.length + textSetVariables.length + otherVariables.length ? "" : "height: calc(100% - 15px);align-items: center;"}>
            {#each randomNumberVariables as variable}
                {@const number = Number(variable.number) || 0}

                <SelectElem style="min-width: calc(25% - 5px);" id="variable" data={variable} draggable>
                    <div class="variable numberBox context #variable{readOnly ? '_readonly' : ''}">
                        <div class="reset">
                            <Button disabled={$randomNumberVariable[variable.id]} title={$dictionary.actions?.reset} on:click={() => resetVariable(variable.id)}>
                                <Icon id="reset" white />
                            </Button>
                        </div>

                        <div class="bigNumber">
                            {number.toString().padStart(getSetChars(variable.sets), "0")}
                        </div>

                        {#if (variable.sets?.length || 0) > 1}
                            <span style="justify-content: center;padding: 5px;width: 100%;">
                                <p>{variable.setName || "—"}</p>
                            </span>
                        {/if}

                        <span style="justify-content: center;padding: 5px;width: 100%;">
                            <Icon id="unknown" right />
                            <p data-title={variable.name}>
                                {#if variable.name?.length}
                                    {variable.name}
                                {:else}
                                    <span style="opacity: 0.5;font-style: italic;"><T id="main.unnamed" /></span>
                                {/if}
                            </p>
                        </span>

                        <div class="buttons">
                            <Button disabled={$randomNumberVariable[variable.id]} id="randomize" title={$dictionary.variables?.randomize} on:click={() => setRandomValue(variable.id)} center style="flex: 1;" dark>
                                <Icon id="shuffle_play" size={2.8} white />
                            </Button>
                        </div>
                    </div>
                </SelectElem>
            {/each}
        </div>

        {#if numberVariables.length + randomNumberVariables.length && otherVariables.length}
            <h5><T id={typeNames.text} /></h5>
        {/if}

        <div class="list">
            {#each otherVariables as variable, i}
                {@const title = variable.type === otherVariables[i - 1]?.type ? "" : variable.type}
                {#if title && i > 0}
                    <h5><T id={typeNames[title]} /></h5>
                {/if}

                <SelectElem id="variable" data={variable} draggable>
                    <div class="variable context #variable{readOnly ? '_readonly' : ''}">
                        <span style="padding-inline-start: 5px;">
                            <Icon id={variable.type === "text_set" ? "increase_text" : variable.type} right />
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
                                <MaterialToggleSwitch label="" checked={variable.enabled ?? true} style="padding: 8px;height: 35px;" on:change={(e) => updateVariable(e, variable.id, "enabled")} />
                            {/if}
                        </span>
                    </div>
                </SelectElem>
            {/each}
        </div>

        {#if numberVariables.length + randomNumberVariables.length + otherVariables.length && textSetVariables.length}
            <h5><T id={typeNames.text_set} /></h5>
        {/if}

        <div class="list">
            {#each textSetVariables as variable}
                {@const activeSet = variable.activeTextSet ?? 0}

                <SelectElem id="variable" data={variable} draggable>
                    <div class="variable context #variable{readOnly ? '_readonly' : ''}">
                        <span style="padding-inline-start: 5px;">
                            <Icon id={"increase_text"} right />
                            <p style="display: flex;gap: 8px;">
                                {#if variable.name?.length}
                                    {variable.name}
                                {:else}
                                    <span style="opacity: 0.5;font-style: italic;"><T id="main.unnamed" /></span>
                                {/if}

                                {#if variable.textSetKeys?.length ?? 1 > 1}
                                    <span style="opacity: 0.5;font-size: 0.8em;">{variable.textSetKeys?.length ?? 1}</span>
                                {/if}
                            </p>
                        </span>

                        <span style="gap: 5px;width: 70%;">
                            <p style="display: flex;flex: 1;">
                                <span style="color: var(--secondary);">#</span>
                                <NumberInput
                                    title={$dictionary.variables?.set_number}
                                    style="width: 40px;"
                                    value={activeSet + 1}
                                    min={1}
                                    max={variable.textSets?.length ?? 1}
                                    on:change={(e) => updateVariable(e.detail - 1, variable.id, "activeTextSet")}
                                    buttons={false}
                                />
                                <span style="font-size: 0.8em;opacity: 0.5;">/{variable.textSets?.length || 1}</span>
                            </p>

                            <Button disabled={activeSet === 0} on:click={() => updateVariable(Math.max(activeSet - 1, 0), variable.id, "activeTextSet")}>
                                <Icon id="back" right />
                                <T id="media.previous" />
                            </Button>
                            <Button disabled={activeSet === (variable.textSets?.length ?? 1) - 1} on:click={() => updateVariable(Math.min(activeSet + 1, (variable.textSets?.length ?? 1) - 1), variable.id, "activeTextSet")}>
                                <Icon id="arrow_forward" right />
                                <T id="media.next" />
                            </Button>
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

<FloatingInputs onlyOne>
    <MaterialButton
        disabled={readOnly}
        icon="add"
        title="new.variable"
        on:click={() => {
            selected.set({ id: null, data: [] })
            activePopup.set("variable")
        }}
    >
        {#if !$labelsDisabled}<T id="new.variable" />{/if}
    </MaterialButton>
</FloatingInputs>

<style>
    .variables {
        flex: 1;
        overflow: auto;

        padding-bottom: 60px;
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
        inset-inline-end: 5px;
        z-index: 1;
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
