<script lang="ts">
    import { activeActionTagFilter, activePopup, dictionary, labelsDisabled, midiIn, popupData, runningActions } from "../../../stores"
    import { actionData } from "../../actions/actionData"
    import { runAction } from "../../actions/actions"
    import { convertOldMidiToNewAction, midiToNote, receivedMidi } from "../../actions/midi"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { keysToID, sortByName } from "../../helpers/array"
    import Button from "../../inputs/Button.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    export let searchValue
    console.log(searchValue)

    function addMidi() {
        popupData.set({})
        activePopup.set("action")
    }

    $: actions = sortByName(keysToID($midiIn), "name", true)
        .map(convertOldMidiToNewAction)
        .filter((a) => !$activeActionTagFilter.length || (a.tags?.length && !$activeActionTagFilter.find((tagId) => !a.tags?.includes(tagId))))
</script>

<div class="context #actions" style="position: relative;height: 100%;overflow-y: auto;">
    {#if actions.length}
        <div class="actions">
            {#each actions as action}
                <div class="action context #action">
                    <SelectElem id="action" data={action} style="display: flex;flex: 1;" draggable>
                        <!-- WIP MIDI if slide action.action ... -->
                        <Button
                            style={action.enabled === false ? "opacity: 0.6;" : ""}
                            title={$dictionary.media?.play}
                            on:click={() => (action.shows?.length ? receivedMidi({ id: action.id, bypass: true }) : runAction(action))}
                            outline={$runningActions.includes(action.id)}
                            bold={false}
                            dark
                        >
                            <span style="display: flex;align-items: center;justify-content: space-between;width: 100%;">
                                <p style="font-size: 1.03em;display: flex;align-items: center;" class:customActivation={action.customActivation || action.startupEnabled}>
                                    {#if action.shows?.length}
                                        <Icon id="slide" white right />
                                    {:else if action.triggers.length !== 1}
                                        <Icon id="actions" right />
                                    {:else}
                                        <Icon id={actionData[action.triggers[0]]?.icon || "actions"} right />
                                    {/if}

                                    {#if action.shows?.length}
                                        <T id="actions.play_on_midi" />
                                    {:else}
                                        {action.name || "—"}
                                    {/if}

                                    {#if action.midi}
                                        ({action.midi.input || "—"})
                                    {/if}

                                    {#if action.keypressActivate}
                                        <span class="faded">
                                            ({action.keypressActivate})
                                        </span>
                                    {/if}
                                </p>

                                {#if action.midiEnabled && action.midi}
                                    <p style="opacity: 0.8;display: inline;">
                                        <T id="midi.note" />: {action.midi.values?.note} - {midiToNote(action.midi.values?.note)},
                                        {#if action.midi.values?.velocity > -1}<T id="midi.velocity" />: {action.midi.values?.velocity},{/if}
                                        <T id="midi.channel" />: {action.midi.values?.channel}
                                        {#if action.midi.type !== "noteon"}
                                            — {action.midi.type}{/if}
                                    </p>
                                {/if}
                            </span>

                            <!-- this is probably not in use: -->
                            <p style="opacity: 0.5;font-style: italic;">{action.shows?.length > 1 ? action.shows.length : ""}</p>
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

<div class="tabs">
    <Button style="width: 100%;" on:click={addMidi} title={$dictionary.new?.action} center>
        <Icon id="add" right={!$labelsDisabled} />
        {#if !$labelsDisabled}<T id="new.action" />{/if}
    </Button>
</div>

<style>
    .actions {
        flex: 1;
        overflow: auto;
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
    .customActivation {
        color: var(--secondary);
    }

    .action :global(button:nth-child(1)) {
        width: 100%;
        justify-content: space-between;
        text-align: left;
    }

    .tabs {
        display: flex;
        background-color: var(--primary-darkest);
    }

    .faded {
        opacity: 0.5;
    }
</style>
