<script lang="ts">
    import { activePopup, drawerTabsData, labelsDisabled, scriptures } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { getAccess } from "../../../utils/profile"
    import { keysToID } from "../../helpers/array"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import NavigationSections from "./NavigationSections.svelte"
    import { uid } from "uid"

    const profile = getAccess("scripture")
    $: readOnly = profile.global === "read"

    $: activeSubTab = $drawerTabsData.scripture?.activeSubTab || ""

    $: scripturesList = keysToID($scriptures)

    $: collections = scripturesList.filter((a) => a.collection)
    $: apiBibles = scripturesList.filter((a) => a.api)
    $: localBibles = scripturesList.filter((a) => !a.collection && !a.api)

    // Organize scriptures into filtered sections for display
    let sections: any[] = []
    // Combine local and api bibles into a single "Bibles" section with an internal separator
    $: {
        const localButtons = convertToButton(localBibles)
        const apiButtons = convertToButton(apiBibles)

        // Only include a separator when there are both local and api buttons
        let biblesSection: any[] = []
        if (localButtons.length && apiButtons.length) {
            biblesSection = [...localButtons, "SEPERATOR", ...apiButtons]
        } else {
            biblesSection = [...localButtons, ...apiButtons]
        }

        sections = collections.length
            ? [convertToButton(collections), biblesSection]
            : [biblesSection]
    }

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

    // Collection creation state
    let creatingCollection = false
    let selectedForCollection: string[] = []

    function toggleSelectForCollection(id: string) {
        const idx = selectedForCollection.indexOf(id)
        
        // Deselect if already selected
        if (idx !== -1) {
            selectedForCollection = selectedForCollection.filter((s) => s !== id)
            return
        }

        // Prevent mixing API and local bibles in the same collection
        const candidate = scripturesList.find((s) => s.id === id)
        const candidateIsApi = !!candidate?.api

        if (selectedForCollection.length) {
            const first = scripturesList.find((s) => s.id === selectedForCollection[0])
            const firstIsApi = !!first?.api
            if (firstIsApi !== candidateIsApi) {
                newToast("Cannot mix API and local Bibles in a single collection")
                return
            }
        }

        selectedForCollection = [...selectedForCollection, id]
    }

    // Determines which items can show selection checkboxes during collection creation
    $: canSelectFor = (id: string) => {
        const candidate = scripturesList.find((s) => s.id === id)
        if (!candidate) return false
        
        // Collections cannot be used to create new collections
        if (candidate.collection) return false
        
        // If no items selected yet, all non-collection items are selectable
        if (!selectedForCollection.length) return true
        
        // Only allow items of the same type (API or local) as the first selection
        const first = scripturesList.find((s) => s.id === selectedForCollection[0])
        if (!first) return true
        
        return (!!first.api) === (!!candidate.api)
    }

    function cancelCreateCollection() {
        creatingCollection = false
        selectedForCollection = []
    }

    function startCreateCollection() {
        creatingCollection = true
        selectedForCollection = []
        
        // Auto-select the currently active scripture if it's not a collection
        if (activeSubTab) {
            const activeScripture = scripturesList.find(s => s.id === activeSubTab)
            if (activeScripture && !activeScripture.collection) {
                selectedForCollection = [activeSubTab]
            }
        }
    }

    function doneCreateCollection() {
        if (!selectedForCollection.length) return

        // Auto-generate collection name from selected scripture names
        const selectedNames = selectedForCollection.map(id => {
            const scripture = scripturesList.find(s => s.id === id)
            return scripture?.customName || scripture?.name || "Scripture"
        })
        const collectionName = selectedNames.join(" + ")

        scriptures.update((store) => {
            const newId = uid()
            store[newId] = { 
                name: collectionName, 
                collection: { versions: selectedForCollection } 
            }
            return store
        })
        
        cancelCreateCollection()
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
    <NavigationSections {sections} active={activeSubTab} on:rename={updateName} showSelectors={creatingCollection} selectHandler={toggleSelectForCollection} isSelected={(id) => selectedForCollection.includes(id)} canSelect={canSelectFor}>
        <svelte:fragment slot="header_0">
            <div class="sectionTitle"><T id="scripture.collections" /></div>
        </svelte:fragment>

        <svelte:fragment slot="header_1">
            <div class="sectionTitle"><T id="scripture.bible" /></div>
        </svelte:fragment>

        <svelte:fragment slot="section_0"></svelte:fragment>
        <svelte:fragment slot="section_1"></svelte:fragment>
    </NavigationSections>
{:else}
    <NavigationSections {sections} active={activeSubTab} on:rename={updateName} showSelectors={creatingCollection} selectHandler={toggleSelectForCollection} isSelected={(id) => selectedForCollection.includes(id)} canSelect={canSelectFor}>
        <svelte:fragment slot="header_0">
            <div class="sectionTitle"><T id="scripture.bible" /></div>
        </svelte:fragment>

        <svelte:fragment slot="section_0"></svelte:fragment>
    </NavigationSections>
{/if}

<div class="scriptureActions" style="padding: 8px; margin: 6px 5px;">
    <MaterialButton icon="add" style="width: 100%;" title="popup.import_scripture" variant="outlined" disabled={readOnly} on:click={newScripture} small>
        {#if !$labelsDisabled}<T id="new.scripture" />{/if}
    </MaterialButton>
    <div style="height: 8px;"></div>
    {#if !creatingCollection}
        <MaterialButton icon="add" style="width: 100%;" title="new.collection" variant="outlined" disabled={readOnly} on:click={startCreateCollection} small>
            {#if !$labelsDisabled}<T id="new.collection" />{/if}
        </MaterialButton>
    {:else}
        <div style="display:flex;gap:8px;">
            <MaterialButton variant="contained" style="flex:1;" on:click={doneCreateCollection} disabled={selectedForCollection.length === 0} small>
                <T id="actions.done" />
            </MaterialButton>
            <MaterialButton variant="outlined" style="flex:1;" on:click={cancelCreateCollection} small>
                <T id="actions.cancel" />
            </MaterialButton>
        </div>

    <!-- Collections are auto-named from selected scriptures -->
    {/if}
</div>

<style>
    .sectionTitle {
        color: var(--text);
        font-weight: 500;
        padding: 2px 4px;
        font-size: 0.9rem;
        border-bottom: 1px solid var(--primary-lighter);
        background: rgba(0,0,0,0.03);
    }
</style>
