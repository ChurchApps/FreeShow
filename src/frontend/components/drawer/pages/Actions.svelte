<script lang="ts">
    import { actions, actionTags, activeActionTagFilter, activePopup, labelsDisabled, popupData, runningActions } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getAccess } from "../../../utils/profile"
    import { getActionIcon, runAction } from "../../actions/actions"
    import { customActionActivations } from "../../actions/customActivation"
    import { convertOldMidiToNewAction, midiToNote, receivedMidi } from "../../actions/midi"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { keysToID, sortByName } from "../../helpers/array"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import Button from "../../inputs/Button.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    export let searchValue

    const profile = getAccess("functions")
    const readOnly = profile.actions === "read"

    function newAction() {
        popupData.set({})
        activePopup.set("action")
    }

    $: sortedActions = sortByName(keysToID($actions), "name", true).map(convertOldMidiToNewAction)
    $: filteredActionsTags = sortedActions.filter(a => !$activeActionTagFilter.length || (a.tags?.length && !$activeActionTagFilter.find(tagId => !a.tags?.includes(tagId))))
    $: filteredActionsSearch = searchValue.length > 1 ? filteredActionsTags.filter(a => a.name.toLowerCase().includes(searchValue.toLowerCase())) : filteredActionsTags
</script>

<div class="context #actions{readOnly ? '_readonly' : ''}" style="position: relative;height: 100%;overflow-y: auto;">
    {#if filteredActionsSearch.length}
        <div class="actions">
            {#each filteredActionsSearch as action}
                <div class="action context #action{readOnly ? '_readonly' : ''}">
                    <SelectElem id="action" data={action} style="display: flex;flex: 1;" draggable>
                        <!-- WIP MIDI if slide action.action ... -->
                        <Button
                            title={translateText("media.play")}
                            on:click={e => {
                                if (e.ctrlKey || e.metaKey) return
                                action.shows?.length ? receivedMidi({ id: action.id, bypass: true }) : runAction(action)
                            }}
                            outline={$runningActions.includes(action.id)}
                            bold={false}
                            dark
                        >
                            <span style="display: flex;align-items: center;justify-content: space-between;width: 100%;">
                                <p style="font-size: 1.03em;display: flex;align-items: center;" class:customActivation={action.customActivation || action.startupEnabled}>
                                    {#if action.shows?.length}
                                        <Icon id="slide" white right />
                                    {:else if action.triggers?.length !== 1}
                                        <Icon id="actions" right />
                                    {:else}
                                        <Icon id={getActionIcon(action.id)} right />
                                    {/if}

                                    <span style="display: flex;align-items: center;gap: 8px;">
                                        {#if action.shows?.length}
                                            <T id="actions.play_on_midi" />
                                        {:else}
                                            {action.name || "—"}
                                        {/if}

                                        {#if action.keypressActivate}
                                            <span class="key">{action.keypressActivate}</span>
                                        {/if}
                                    </span>
                                </p>

                                <p style="opacity: 0.8;display: flex;gap: 20px;" class:deactivated={action.enabled === false}>
                                    {#if action.customActivation || action.startupEnabled}
                                        <span>
                                            {#key action.customActivation}
                                                <T id={customActionActivations.find(a => a.id === action.customActivation)?.name || "actions.custom_activation"} />
                                            {/key}
                                        </span>
                                    {/if}

                                    {#if action.midiEnabled && action.midi}
                                        <span>
                                            <!-- ({action.midi.input || "—"}) -->
                                            <!-- <T id="midi.note" />: {action.midi.values?.note} - {midiToNote(action.midi.values?.note)}, -->
                                            <T id="midi.note" />: {action.midi.type === "control" ? action.midi.values?.controller || 0 : midiToNote(action.midi.values?.note)},
                                            {#if action.midi.type === "control"}
                                                <T id="variables.value" />: {action.midi.values?.value},
                                            {:else if action.midi.values?.velocity > -1}
                                                <T id="midi.velocity" />: {action.midi.values?.velocity},
                                            {/if}
                                            <T id="midi.channel" />: {action.midi.values?.channel}
                                            {#if action.midi.type !== "noteon"}
                                                — {action.midi.type}{/if}
                                        </span>
                                    {/if}
                                </p>
                            </span>

                            <!-- this is probably not in use: -->
                            <p style="opacity: 0.5;font-style: italic;">{action.shows?.length > 1 ? action.shows.length : ""}</p>

                            <!-- tags -->
                            {#if $activeActionTagFilter.length}
                                <span class="tags">
                                    {#each action.tags as tagId}
                                        {@const tag = $actionTags[tagId] || {}}

                                        {#if !$activeActionTagFilter.includes(tagId)}
                                            <span class="tag" style="--color: {tag.color || 'white'};">
                                                <p>{tag.name}</p>
                                            </span>
                                        {/if}
                                    {/each}
                                </span>
                            {/if}
                        </Button>
                    </SelectElem>
                </div>
            {/each}
        </div>
    {:else}
        <Center faded>
            <T id="empty.general" />
        </Center>
    {/if}
</div>

<FloatingInputs onlyOne>
    <MaterialButton disabled={readOnly} icon="add" title="new.action" on:click={newAction}>
        {#if !$labelsDisabled}<T id="new.action" />{/if}
    </MaterialButton>
</FloatingInputs>

<style>
    .actions {
        flex: 1;
        overflow: auto;

        padding-bottom: 60px;
    }
    .actions :global(.action:nth-child(even)) {
        background-color: rgb(0 0 20 / 0.08);
    }
    .actions :global(.selectElem button:not(.hover)) {
        background: transparent;
    }

    .action {
        display: flex;
        flex-direction: row;
        width: 100%;
        min-height: 35px;
    }
    /* .customActivation {
        color: var(--secondary);
    } */

    .action :global(button:nth-child(1)) {
        width: 100%;
        justify-content: space-between;
        text-align: start;
    }

    .key {
        color: var(--secondary);
        font-weight: bold;
        text-transform: uppercase;
    }

    .deactivated {
        opacity: 0.5 !important;
        text-decoration: line-through;
    }

    /* tags */

    .tags {
        display: flex;
        gap: 5px;
        padding-left: 10px;
    }

    .tag {
        --color: white;

        display: flex;
        padding: 0px 5px;

        color: var(--color);
        font-weight: 600;

        border-radius: 20px;
        border: 2px solid var(--color);
    }
</style>
