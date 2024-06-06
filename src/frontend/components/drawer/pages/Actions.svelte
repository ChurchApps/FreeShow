<script lang="ts">
    import { MAIN } from "../../../../types/Channels"
    import { activePopup, dictionary, labelsDisabled, midiIn, popupData } from "../../../stores"
    import { send } from "../../../utils/request"
    import { actionData } from "../../actions/actionData"
    import { runAction } from "../../actions/actions"
    import { convertOldMidiToNewAction, midiToNote } from "../../actions/midi"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { keysToID, sortByName } from "../../helpers/array"
    import Button from "../../inputs/Button.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    export let searchValue
    console.log(searchValue)

    function openMidi(id: string) {
        popupData.set({ id })
        activePopup.set("action")
    }

    function deleteMidi(id: string) {
        midiIn.update((a) => {
            delete a[id]
            return a
        })

        send(MAIN, ["CLOSE_MIDI"], { id })
    }

    function addMidi() {
        popupData.set({})
        activePopup.set("action")
    }

    $: actions = sortByName(keysToID($midiIn)).map(convertOldMidiToNewAction)
</script>

<div style="position: relative;height: 100%;overflow-y: auto;">
    {#if actions.length}
        <div class="actions">
            {#each actions as action}
                <div class="action">
                    <SelectElem id="action" data={action} style="display: flex;flex: 1;" draggable>
                        <!-- WIP MIDI if slide action.action ... -->
                        <Button title={$dictionary.media?.play} on:click={() => runAction(action)} dark>
                            <span style="display: flex;align-items: center;width: 100%;">
                                {#if action.triggers === undefined}
                                    <Icon id="slide" right />
                                {:else if action.triggers.length !== 1}
                                    <Icon id="actions" right />
                                {:else}
                                    <Icon id={actionData[action.triggers[0]]?.icon || "actions"} right />
                                {/if}

                                <p style="width: 350px;" class:startup={action.startupEnabled}>
                                    {action.name}

                                    {#if action.midi}
                                        ({action.midi.input || "—"})
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

                            <!-- WIP MIDI remove this way shows midi action... -->
                            <p style="opacity: 0.5;font-style: italic;">{action.triggers === undefined ? action.shows.length : ""}</p>
                        </Button>
                    </SelectElem>

                    <!-- WIP MIDI , !!action.shows?.length -->
                    <Button title={$dictionary.timer?.edit} on:click={() => openMidi(action.id)}>
                        <Icon id="edit" />
                    </Button>
                    <Button title={$dictionary.actions?.delete} on:click={() => deleteMidi(action.id)}>
                        <Icon id="delete" />
                    </Button>
                </div>
            {/each}
        </div>
    {:else}
        <p style="text-align: center;opacity: 0.5;padding: 10px;">
            <T id="empty.general" />
        </p>
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
    .startup {
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
</style>
