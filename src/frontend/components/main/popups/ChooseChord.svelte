<script lang="ts">
    import { onMount } from "svelte"
    import { popupData, storedChordsData } from "../../../stores"
    import { chordTensions, chordTypes, keys, keysInverted, romanKeys } from "../../edit/values/chords"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"

    let chordData = {
        key: "C",
        romanKey: "I",
        type: "",
        tension: "",
        bass: "C",
        custom: "",
    }

    let loaded = false
    onMount(() => {
        if ($storedChordsData?.key) {
            chordData = $storedChordsData
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

    function setCustom(e: any) {
        chordData.custom = e.target?.value || ""
    }

    let combinedChord: string = "C"
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

        if (romanKeysActive) {
            combinedChord = chordData.romanKey + chordData.type + chordData.tension
        }
    }

    function selectChord() {
        popupData.set({ id: "choose_chord", value: combinedChord })
    }

    const isChecked = (e: any) => e.target.checked
    let romanKeysActive = false

    let showInvertedChords = false
</script>

<CombinedInput style="margin-bottom: 10px;">
    <p><T id="actions.roman_keys" /></p>
    <div class="alignRight">
        <Checkbox checked={romanKeysActive} on:change={(e) => (romanKeysActive = isChecked(e))} />
    </div>
</CombinedInput>

<div class="chords">
    <div class="list">
        {#if romanKeysActive}
            <p><T id="actions.chord_key" /></p>
            {#each romanKeys as key}
                <Button outline={chordData.romanKey === key} disabled={chordData.custom} on:click={() => updateData("romanKey", key)} center>{key}</Button>
            {/each}
        {:else}
            <p class="invert" on:mousedown={() => (showInvertedChords = !showInvertedChords)}><T id="actions.chord_key" /></p>
            {#each showInvertedChords ? keysInverted : keys as key}
                <Button outline={chordData.key === key} disabled={chordData.custom} on:click={() => updateData("key", key)} center>{key}</Button>
            {/each}
        {/if}
    </div>

    <div class="list">
        <p><T id="actions.chord_type" /></p>
        {#each chordTypes as type}
            <Button outline={chordData.type === type} disabled={chordData.custom} on:click={() => updateData("type", type)} center>
                {#if !type}
                    <span style="opacity: 0;">.</span>
                {:else}
                    {type}
                {/if}
            </Button>
        {/each}
    </div>

    <div class="list">
        <p><T id="actions.chord_tension" /></p>
        {#each chordTensions as tension}
            <Button outline={chordData.tension === tension} disabled={chordData.custom} on:click={() => updateData("tension", tension)} center>
                {#if !tension}
                    <span style="opacity: 0;">.</span>
                {:else}
                    {tension}
                {/if}
            </Button>
        {/each}
    </div>

    {#if !romanKeysActive}
        <div class="list">
            <p class="invert" on:mousedown={() => (showInvertedChords = !showInvertedChords)}><T id="actions.chord_bass" /></p>
            {#each showInvertedChords ? keysInverted : keys as bass}
                <Button outline={chordData.bass === bass} disabled={chordData.custom} on:click={() => updateData("bass", bass)} center>{bass}</Button>
            {/each}
        </div>
    {/if}
</div>

<CombinedInput style="margin-top: 10px;">
    <p><T id="actions.custom_key" /></p>
    <TextInput value={chordData.custom} on:change={setCustom} />
</CombinedInput>

<Button style="margin-top: 12px;" on:click={selectChord} dark center><T id="actions.select_chord" />: <span style="color: var(--secondary);font-weight: bold;margin-left: 5px;">{combinedChord}</span></Button>

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
        border-radius: var(--border-radius);
    }

    .list p {
        padding: 2px;
        font-weight: bold;
        background: var(--primary-darkest);
    }

    .invert:hover {
        background-color: var(--hover);
        cursor: pointer;
    }
</style>
