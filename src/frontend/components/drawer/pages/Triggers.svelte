<script lang="ts">
    import { activePopup, dictionary, labelsDisabled, triggers } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { keysToID } from "../../helpers/array"
    import { activateTrigger } from "../../helpers/showActions"
    import Button from "../../inputs/Button.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    export let searchValue
    console.log(searchValue)

    $: globalList = keysToID($triggers)
    $: sortedTriggers = globalList.sort((a, b) => a.name?.localeCompare(b.name))
</script>

{#if sortedTriggers.length}
    <div class="triggers">
        {#each sortedTriggers as trigger}
            <SelectElem id="trigger" data={trigger} draggable>
                <Button class="context #trigger" style="flex: 1;" on:click={() => activateTrigger(trigger.id)}>
                    <div class="trigger">
                        <span style="padding-left: 5px;">
                            <!-- <Icon id={trigger.type} right /> -->
                            <p>{trigger.name}</p>
                        </span>

                        <span style="padding-left: 10px;font-weight: normal;opacity: 0.5;">
                            {trigger.value}
                        </span>
                    </div>
                </Button>
                <!-- <Button
                    on:click={() => {
                        selected.set({ id: "trigger", data: [trigger] })
                        activePopup.set("trigger")
                    }}
                >
                    <Icon id="edit" />
                </Button> -->
            </SelectElem>
        {/each}
    </div>
{:else}
    <Center faded>
        <T id="empty.general" />
    </Center>
{/if}

<div style="display: flex;background-color: var(--primary-darkest);">
    <Button style="flex: 1;" on:click={() => activePopup.set("trigger")} center title={$dictionary.new?.trigger}>
        <Icon id="add" right={!$labelsDisabled} />
        {#if !$labelsDisabled}<T id="new.trigger" />{/if}
    </Button>
</div>

<style>
    .triggers {
        flex: 1;
        overflow: auto;
    }
    .triggers :global(.selectElem) {
        display: flex;
    }
    .triggers :global(.selectElem:not(.isSelected):nth-child(even)) {
        background-color: rgb(0 0 20 / 0.08);
    }

    .trigger {
        padding: 3px 5px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .trigger span {
        display: flex;
        align-items: center;
    }
</style>
