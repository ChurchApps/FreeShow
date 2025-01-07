<script lang="ts">
    import { uid } from "uid"
    import { dictionary, emitters } from "../../../stores"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Center from "../../system/Center.svelte"
    import type { Emitter } from "../../../../types/Show"
    import Dropdown from "../../inputs/Dropdown.svelte"

    $: emittersList = sortByName(sortByName(keysToID($emitters)), "type")

    let editEmitter: string = ""
    $: emitter = $emitters[editEmitter]

    $: emitterTypes = [
        { name: "OSC", id: "osc" },
        { name: "HTTP", id: "http" },
        { name: "MIDI", id: "midi" },
    ]

    const DEFAULT_EMITTER: Emitter = { name: "", type: "osc" }

    function createEmitter() {
        let id = uid()
        emitters.update((a) => {
            a[id] = clone(DEFAULT_EMITTER)
            return a
        })

        editEmitter = id
    }

    function updateValue(key: string, e: any) {
        if (!editEmitter || !$emitters[editEmitter]) return

        let value = e.target?.value ?? e

        emitters.update((a) => {
            a[editEmitter][key] = value
            return a
        })
    }
</script>

{#if editEmitter}
    <Button style="position: absolute;left: 0;top: 0;min-height: 58px;" title={$dictionary.actions?.back} on:click={() => (editEmitter = "")}>
        <Icon id="back" size={2} white />
    </Button>

    <CombinedInput textWidth={30}>
        <p><T id="midi.name" /></p>
        <TextInput value={emitter.name} on:change={(e) => updateValue("name", e)} autofocus={!emitter.name} />
    </CombinedInput>

    <CombinedInput textWidth={30}>
        <p><T id="midi.type" /></p>
        <Dropdown options={emitterTypes} value={emitterTypes.find((a) => a.id === emitter.type)?.name || "—"} on:click={(e) => updateValue("type", e.detail.id)} />
    </CombinedInput>

    <!-- channel/ip -->
    <!-- TEMPLATES: -->
    <!-- fixed message values -->
    <!-- dynamic message values -->
{:else}
    <!-- MIDI / HTTP / OSC ... -->
    <!-- WIP tip -->

    {#if emittersList.length}
        {#each emittersList as emitter}
            <CombinedInput>
                <Button style="width: 100%;" title={$dictionary.timer?.edit} on:click={() => (editEmitter = emitter.id)} bold={false}>
                    <p class="emitter" style="gap: 5px;width: 100%;min-width: auto;"><span style="display: flex;align-items: center;text-transform: uppercase;opacity: 0.7;">[{emitter.type}]</span>{emitter.name || "—"}</p>
                </Button>
            </CombinedInput>
        {/each}
    {:else}
        <Center faded>
            <T id="empty.general" />
        </Center>

        <br />
    {/if}

    <CombinedInput>
        <Button on:click={createEmitter} style="width: 100%;" center>
            <Icon id="add" right />
            <T id="settings.add" />
        </Button>
    </CombinedInput>
{/if}
