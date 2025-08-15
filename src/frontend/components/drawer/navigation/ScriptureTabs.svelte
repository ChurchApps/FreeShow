<script lang="ts">
    import { activePopup, drawerTabsData, labelsDisabled, scriptures } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import { keysToID } from "../../helpers/array"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import NavigationSections from "./NavigationSections.svelte"

    const profile = getAccess("scripture")
    $: readOnly = profile.global === "read"

    $: activeSubTab = $drawerTabsData.scripture?.activeSubTab || ""

    $: scripturesList = keysToID($scriptures)

    $: collections = scripturesList.filter((a) => a.collection)
    $: apiBibles = scripturesList.filter((a) => a.api)
    $: localBibles = scripturesList.filter((a) => !a.collection && !a.api)

            // Ensure we render only the sections that exist. Do not render a Collections
            // section unless there are collections to show — this keeps the UI clean
            let sections: any[] = []
            $: sections = collections.length
                    ? [
                            convertToButton(collections),
                            convertToButton(localBibles),
                            convertToButton(apiBibles)
                        ]
                    : [
                            convertToButton(localBibles),
                            convertToButton(apiBibles)
                        ]

    function convertToButton(categories: any[]) {
        return categories
            .sort((a, b) => (b.customName || b.name).localeCompare(a.customName || a.name))
            .map((a: any) => {
                const icon = a.api ? "scripture_alt" : a.collection ? "collection" : "scripture"
                const length = a.collection?.versions?.length || 0
                return { id: a.id, label: a.customName || a.name, icon, length }
            })
    }

    function newScripture() {
        activePopup.set("import_scripture")
    }

    function updateName(e: any) {
        const { id, value } = e.detail
        scriptures.update((a) => {
            a[id].customName = value
            return a
        })
    }
</script>

{#if collections.length}
    <NavigationSections {sections} active={activeSubTab} on:rename={updateName}>
        <svelte:fragment slot="header_0">
            <div class="sectionTitle"><T id="scripture.collections" /></div>
        </svelte:fragment>

        <svelte:fragment slot="header_1">
            <div class="sectionTitle"><T id="scripture.local_bibles" /></div>
        </svelte:fragment>

        <svelte:fragment slot="header_2">
            <div class="sectionTitle"><T id="scripture.api_bibles" /></div>
        </svelte:fragment>

        <svelte:fragment slot="section_0"></svelte:fragment>
        <svelte:fragment slot="section_1"></svelte:fragment>
        <svelte:fragment slot="section_2"></svelte:fragment>
    </NavigationSections>
{:else}
    <NavigationSections {sections} active={activeSubTab} on:rename={updateName}>
        <svelte:fragment slot="header_0">
            <div class="sectionTitle"><T id="scripture.local_bibles" /></div>
        </svelte:fragment>

        <svelte:fragment slot="header_1">
            <div class="sectionTitle"><T id="scripture.api_bibles" /></div>
        </svelte:fragment>

        <svelte:fragment slot="section_0"></svelte:fragment>
        <svelte:fragment slot="section_1"></svelte:fragment>
    </NavigationSections>
{/if}

<div class="scriptureActions" style="padding: 8px; margin: 6px 5px;">
    <MaterialButton icon="add" style="width: 100%;" title="popup.import_scripture" variant="outlined" disabled={readOnly} on:click={newScripture} small>
        {#if !$labelsDisabled}<T id="new.scripture" />{/if}
    </MaterialButton>
</div>

<style>
    .sectionTitle {
        color: var(--text);
        font-weight: 600;
        padding: 6px 8px;
        border-bottom: 1px solid var(--primary-lighter);
        background: rgba(0,0,0,0.03);
    }
</style>
