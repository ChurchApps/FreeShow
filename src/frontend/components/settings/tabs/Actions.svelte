<script lang="ts">
    import { uid } from "uid"
    import { MAIN } from "../../../../types/Channels"
    import { activePopup, dictionary, midiIn, popupData } from "../../../stores"
    import { playMidiIn } from "../../../utils/midi"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"

    function openMidi(id: string, action: boolean) {
        popupData.set({ id, type: "in", action })
        activePopup.set("midi")
    }

    function deleteMidi(id: string) {
        midiIn.update((a) => {
            delete a[id]
            return a
        })

        send(MAIN, ["CLOSE_MIDI"], { id })
    }

    function addMidi() {
        popupData.set({ id: uid(), type: "in", action: true })
        activePopup.set("midi")
    }
</script>

<h3 style="margin-top: 10px;">
    <T id="popup.midi" />
    <T id="midi.input" />
</h3>

{#if Object.keys($midiIn).length}
    {#each Object.entries($midiIn) as [id, input]}
        <div class="midi">
            <Button title={$dictionary.media?.play} on:click={() => playMidiIn({ id, ...input })} dark>
                <span style="display: flex;align-items: center;width: 100%;">
                    <Icon id={input.action === undefined ? "slide" : "actions"} right />
                    <p style="width: 350px;">{input.name} ({input.input || "—"})</p>
                    <p style="opacity: 0.8;display: inline;">
                        <T id="midi.note" />: {input.values.note}, <T id="midi.velocity" />: {input.values.velocity}, <T id="midi.channel" />: {input.values.channel} — {input.type}
                    </p>
                </span>
                <p style="opacity: 0.5;font-style: italic;">{input.action === undefined ? input.shows.length : ""}</p>
            </Button>

            <Button title={$dictionary.timer?.edit} on:click={() => openMidi(id, !input.shows?.length)}>
                <Icon id="edit" />
            </Button>
            <Button title={$dictionary.actions?.delete} on:click={() => deleteMidi(id)}>
                <Icon id="delete" />
            </Button>
        </div>
    {/each}
{:else}
    <T id="empty.general" />
{/if}

<CombinedInput>
    <Button on:click={addMidi} style="width: 100%;" center>
        <Icon id="add" right />
        <T id="settings.add" />
    </Button>
</CombinedInput>

<br />

<style>
    div {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    /* div:hover {
        background-color: var(--hover);
    } */

    h3 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    }

    .midi {
        flex-direction: row;
        width: 100%;
        min-height: 40px;
        border-bottom: 2px solid var(--primary-lighter);
    }

    .midi :global(button) {
        min-height: inherit;
    }

    .midi :global(button:nth-child(1)) {
        width: 100%;
        justify-content: space-between;
        text-align: left;
    }
</style>
