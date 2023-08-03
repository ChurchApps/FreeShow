<script lang="ts">
    import { activePopup, dictionary, labelsDisabled, variables } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import NumberInput from "../inputs/NumberInput.svelte"
    import TextInput from "../inputs/TextInput.svelte"
    import Center from "../system/Center.svelte"
    import SelectElem from "../system/SelectElem.svelte"

    export let searchValue
    console.log(searchValue)

    $: globalList = Object.entries($variables).map(([id, a]) => ({ ...a, id }))
    $: sortedVariables = globalList.sort((a, b) => a.name?.localeCompare(b.name))

    function updateVariable(e: any, id: string, key: string) {
        let value = e?.target?.value ?? e

        variables.update((a) => {
            a[id][key] = value

            return a
        })
    }
</script>

{#if sortedVariables.length}
    <div class="variables">
        {#each sortedVariables as variable}
            <SelectElem id="variable" data={variable}>
                <div class="variable context #variable">
                    <span style="padding-left: 5px;">
                        <Icon id={variable.type} right />
                        <p>{variable.name}</p>
                    </span>

                    <span style="gap: 5px;width: 70%;">
                        {#if variable.type === "text"}
                            <TextInput placeholder={$dictionary.variables?.value || ""} value={variable.text || ""} on:change={(e) => updateVariable(e, variable.id, "text")} />
                        {:else if variable.type === "number"}
                            <NumberInput
                                title={$dictionary.variables?.step}
                                style="max-width: 80px;"
                                value={variable.step || 1}
                                min={0.1}
                                step={0.1}
                                decimals={1}
                                fixed={1}
                                on:change={(e) => updateVariable(e.detail, variable.id, "step")}
                                buttons={false}
                            />
                            <NumberInput
                                title={$dictionary.variables?.value}
                                style="width: 100%;"
                                value={variable.number || 0}
                                min={-10000000}
                                step={Number(variable.step) || 1}
                                decimals={1}
                                fixed={1}
                                max={10000000}
                                on:change={(e) => updateVariable(e.detail, variable.id, "number")}
                            />
                            <Button title={$dictionary.actions?.reset} on:click={() => updateVariable(0, variable.id, "number")}>
                                <Icon id="reset" />
                            </Button>
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
        background-color: var(--primary);
    }

    .variable {
        padding: 3px 5px;
        display: flex;
        align-items: center;
        justify-content: space-between;
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
</style>
