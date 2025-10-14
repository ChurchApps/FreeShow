<script lang="ts">
    import { onMount } from "svelte"
    import { popupData, storedChordsData } from "../../../stores"
    import { chordTensions, chordTypes, keys, keysInverted, romanKeys } from "../../edit/values/chords"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    let chordData = {
        key: "C",
        romanKey: "I",
        type: "",
        tension: "",
        bass: "C",
        custom: "",

        romanKeysActive: false
    }

    let loaded = false
    onMount(() => {
        if ($storedChordsData?.key) {
            chordData = $storedChordsData
        } else if ($storedChordsData?.romanKeysActive) {
            chordData.romanKeysActive = true
        }
        loaded = true
    })

    function updateData(key: string, value: string) {
        // set bass note to same as key if not changed or clicking on the active key
        if (key === "key" && (chordData.bass === chordData[key] || chordData[key] === value)) chordData.bass = value
        // reset to no value if clicking on the active value
        if ((key === "type" || key === "tension") && chordData[key] === value) value = ""

        chordData[key] = value
    }

    let combinedChord = "C"
    $: if (chordData) combineChord()
    function combineChord() {
        if (!loaded) return
        storedChordsData.set(chordData)

        if (chordData.custom) {
            combinedChord = chordData.custom
            return
        }

        let bassKey = chordData.bass !== chordData.key ? "/" + chordData.bass : ""
        combinedChord = chordData.key + chordData.type + chordData.tension + bassKey

        if (chordData.romanKeysActive) {
            combinedChord = chordData.romanKey + chordData.type + chordData.tension
        }
    }

    function selectChord() {
        popupData.set({ id: "choose_chord", value: combinedChord })
    }

    let showInvertedChords = false
</script>

<MaterialToggleSwitch label="actions.roman_keys" checked={chordData.romanKeysActive} on:change={(e) => (chordData.romanKeysActive = e.detail)} />
<MaterialTextInput label="actions.custom_key" value={chordData.custom} defaultValue="" on:input={(e) => (chordData.custom = e.detail)} />

<div class="chords" style="margin: 10px 0;">
    <div class="list">
        {#if chordData.romanKeysActive}
            <p><T id="actions.chord_key" /></p>
            {#each romanKeys as key}
                <MaterialButton showOutline={chordData.romanKey === key} disabled={!!chordData.custom} on:click={() => updateData("romanKey", key)}>{key}</MaterialButton>
            {/each}
        {:else}
            <p class="invert" on:mousedown={() => (showInvertedChords = !showInvertedChords)}>
                <Icon id="arrow_{showInvertedChords ? 'up' : 'down'}" size={1.1} white={!showInvertedChords} />
                <T id="actions.chord_key" />
            </p>
            {#each showInvertedChords ? keysInverted : keys as key}
                <MaterialButton showOutline={chordData.key === key} disabled={!!chordData.custom} on:click={() => updateData("key", key)}>{key}</MaterialButton>
            {/each}
        {/if}
    </div>

    <div class="list">
        <p><T id="actions.chord_type" /></p>
        {#each chordTypes as type}
            <MaterialButton showOutline={chordData.type === type} disabled={!!chordData.custom} on:click={() => updateData("type", type)}>
                {#if !type}
                    <span style="opacity: 0;">.</span>
                {:else}
                    {type}
                {/if}
            </MaterialButton>
        {/each}
    </div>

    <div class="list">
        <p><T id="actions.chord_tension" /></p>
        {#each chordTensions as tension}
            <MaterialButton showOutline={chordData.tension === tension} disabled={!!chordData.custom} on:click={() => updateData("tension", tension)}>
                {#if !tension}
                    <span style="opacity: 0;">.</span>
                {:else}
                    {tension}
                {/if}
            </MaterialButton>
        {/each}
    </div>

    {#if !chordData.romanKeysActive}
        <div class="list">
            <p class="invert" on:mousedown={() => (showInvertedChords = !showInvertedChords)}>
                <Icon id="arrow_{showInvertedChords ? 'up' : 'down'}" size={1.1} white={!showInvertedChords} />
                <T id="actions.chord_bass" />
            </p>
            {#each showInvertedChords ? keysInverted : keys as bass}
                <MaterialButton showOutline={chordData.bass === bass} disabled={!!chordData.custom} on:click={() => updateData("bass", bass)}>{bass}</MaterialButton>
            {/each}
        </div>
    {/if}
</div>

<MaterialButton variant="outlined" on:click={selectChord}>
    <T id="actions.select_chord" />: <span style="color: var(--secondary);font-weight: bold;">{combinedChord}</span>
</MaterialButton>

<style>
    .chords {
        display: flex;
        justify-content: center;
        gap: 8px;
    }

    .list {
        flex: 1;
        display: flex;
        flex-direction: column;
        text-align: center;

        background-color: var(--primary-darker);

        border-radius: 8px;
        padding-bottom: 8px;
        overflow: hidden;
    }

    .list :global(button) {
        padding: 5px 40px;
        font-weight: normal;
        justify-content: left;
    }

    .list p {
        padding: 2px;
        font-weight: bold;
        font-size: 0.8em;
        background: var(--primary-darkest);
    }

    .invert {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;

        cursor: pointer;

        transition: 0.1s background-color;
    }

    .invert:hover {
        background-color: var(--hover);
    }
</style>
