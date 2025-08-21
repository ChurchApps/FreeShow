<script lang="ts">
    import { activePopup, labelsDisabled, triggers } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import T from "../../helpers/T.svelte"
    import { keysToID, sortByName } from "../../helpers/array"
    import { activateTrigger } from "../../helpers/showActions"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import Button from "../../inputs/Button.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    export let searchValue

    const profile = getAccess("functions")
    const readOnly = profile.triggers === "read"

    $: sortedTriggers = sortByName(keysToID($triggers))
    $: filteredTriggersSearch = searchValue.length > 1 ? sortedTriggers.filter((a) => a.name.toLowerCase().includes(searchValue.toLowerCase())) : sortedTriggers

    let status = { id: "", type: "" }
    async function buttonClick(id) {
        // give feedback
        status = { id, type: "" }
        status.type = await activateTrigger(id)

        setTimeout(() => {
            if (status.id === id) status = { id: "", type: "" }
        }, 1000)
    }

    function formatTriggerValue(value: string) {
        // bug in pre 1.3.3 where trigger value is an event if changed to empty
        if (typeof value !== "string") return

        // value = e.g. http://192.168.10.50/?preset=1&cam=3 -> Preset: 1
        if (!value) return ""

        let urlData = value.indexOf("?")
        if (urlData < 0) return ""

        let text = value.slice(urlData + 1)

        let extraData = value.indexOf("&")
        if (extraData > -1) text = text.slice(0, extraData)

        let values = text.split("=")
        if (values.length < 2) return text

        return values.join(": ")
    }
</script>

{#if filteredTriggersSearch.length}
    <div class="triggers" class:center={filteredTriggersSearch.length <= 10}>
        {#each filteredTriggersSearch as trigger}
            <SelectElem class={status.id === trigger.id ? status.type || "pending" : ""} id="trigger" data={trigger} draggable>
                <Button
                    style="flex: 1;padding: 0;"
                    class="context #trigger{readOnly ? '_readonly' : ''}"
                    title={formatTriggerValue(trigger.value)}
                    on:click={(e) => {
                        if (e.ctrlKey || e.metaKey) return
                        buttonClick(trigger.id)
                    }}
                >
                    <p>
                        {#if trigger.name?.length}
                            {trigger.name}
                        {:else}
                            <span style="opacity: 0.5;font-style: italic;"><T id="main.unnamed" /></span>
                        {/if}
                        <!-- {#if trigger.name.length < 18}
                            <span>{formatTriggerValue(trigger.value)}</span>
                        {/if} -->
                    </p>
                </Button>
            </SelectElem>
        {/each}
    </div>
{:else}
    <Center faded>
        <T id="empty.general" />
    </Center>
{/if}

<FloatingInputs onlyOne>
    <MaterialButton disabled={readOnly} icon="add" title="new.trigger" on:click={() => activePopup.set("trigger")}>
        {#if !$labelsDisabled}<T id="new.trigger" />{/if}
    </MaterialButton>
</FloatingInputs>

<style>
    .triggers {
        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
        justify-content: space-evenly;

        gap: 5px;
        padding: 5px;

        flex: 1;
        overflow: auto;
    }
    .triggers.center {
        align-content: center;
    }
    .triggers :global(.selectElem) {
        display: flex;
        border: 2px solid rgb(255 255 255 / 0.4);
        border-radius: var(--border-radius);
    }

    .triggers :global(.selectElem.pending) {
        border: 2px solid var(--secondary);
    }

    .triggers :global(.selectElem.error) {
        border: 2px solid rgb(255, 35, 35);
    }

    .triggers :global(.selectElem.success) {
        border: 2px solid rgb(35, 175, 35);
    }

    .triggers :global(.selectElem) {
        width: 100px;
        height: 100px;
        background-color: var(--primary-darkest);
        transition: 0.2s border;
    }

    .triggers p {
        font-size: 1.2em;
        width: 100%;
        height: 100%;
        max-width: calc(100px - 3px);
        padding: 5px;
        white-space: normal;
        align-content: center;
    }

    .triggers p span {
        text-transform: capitalize;
        font-size: 0.9em;
        opacity: 0.7;
        display: block;
        margin-top: 5px;
    }
</style>
