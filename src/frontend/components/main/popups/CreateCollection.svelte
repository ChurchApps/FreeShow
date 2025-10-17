<script lang="ts">
    import { uid } from "uid"
    import { activePopup, scriptures } from "../../../stores"
    import { getShortBibleName } from "../../drawer/bible/scripture"
    import { keysToID } from "../../helpers/array"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialCheckbox from "../../inputs/MaterialCheckbox.svelte"

    $: scripturesList = keysToID($scriptures).filter((a) => !a.collection)
    $: localScripturesList = scripturesList.filter((a) => !a.api)
    $: apiScripturesList = scripturesList.filter((a) => a.api)

    let selectedScriptures: string[] = []

    function toggle(state: boolean, id: string) {
        if (state) {
            if (selectedScriptures.includes(id)) return
            selectedScriptures.push(id)
            selectedScriptures = selectedScriptures
        } else {
            if (!selectedScriptures.includes(id)) return
            selectedScriptures.splice(selectedScriptures.indexOf(id), 1)
            selectedScriptures = selectedScriptures
        }
    }

    function create() {
        let versions: string[] = selectedScriptures

        // remove collections and non-string items
        versions = versions.filter((id) => typeof id === "string") // sometimes the bibles object is added
        versions = versions.filter((id) => !Object.entries($scriptures).find(([tabId, a]) => (tabId === id || a.id === id) && a.collection !== undefined))
        if (versions.length < 2) return

        let name = ""
        versions.forEach((id, i) => {
            if (i > 0) name += " + "
            if (id.length < 5) {
                name += id.toUpperCase()
            } else {
                const bibleName: string = ($scriptures[id] || Object.values($scriptures).find((a) => a.id === id))?.name || ""
                name += getShortBibleName(bibleName)
            }
        })

        scriptures.update((a) => {
            a[uid()] = { name, collection: { versions } }
            return a
        })

        activePopup.set(null)
    }
</script>

<div class="list">
    {#each localScripturesList as scripture}
        <div class="item">
            <MaterialCheckbox style="width: 100%;" label={scripture.customName || scripture.name} on:change={(e) => toggle(e.detail, scripture.id)} />
        </div>
    {/each}

    <HRule title="API" />

    {#each apiScripturesList as scripture}
        <div class="item">
            <MaterialCheckbox style="width: 100%;" label={scripture.customName || scripture.name} on:change={(e) => toggle(e.detail, scripture.id)} />
        </div>
    {/each}
</div>

<MaterialButton variant="contained" disabled={selectedScriptures.length < 2} on:click={create}>
    <T id="timer.create" />
    {#if selectedScriptures.length < 2}<span style="opacity: 0.5;font-size: 0.8em;">{selectedScriptures.length}/2</span>{/if}
</MaterialButton>

<style>
    .list {
        display: flex;
        flex-direction: column;

        padding: 10px 0;
        border-radius: 10px;
        overflow: hidden;

        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);

        margin-bottom: 20px;
    }
    .list .item:nth-child(odd) {
        background-color: var(--primary-darkest);
    }

    .item {
        display: flex;
        gap: 10px;
        /* padding: 4px 12px; */
    }
    .item :global(.checkboxfield .background) {
        background-color: transparent !important;
    }
</style>
