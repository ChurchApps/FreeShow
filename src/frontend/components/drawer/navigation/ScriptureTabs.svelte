<script lang="ts">
    import { activePopup, activeScripture, drawerTabsData, labelsDisabled, openScripture, scriptures } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import { keysToID } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
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
    $: favoritesList = scripturesList.filter((a) => a.favorite)

    let sections: any[] = []
    $: sections = [
        ...(favoritesList.length ? [[{ id: "TITLE", label: "category.favourites" }, ...convertToButton(favoritesList)]] : []),
        [{ id: "TITLE", label: "scripture.collections" }, ...convertToButton(collections)],
        [{ id: "TITLE", label: "scripture.bibles_section" }, ...convertToButton(localBibles), ...(localBibles.length && apiBibles.length ? [{ id: "SEPARATOR", label: "API" }] : []), ...convertToButton(apiBibles)]
    ]

    function convertToButton(categories: any[]) {
        return categories
            .sort((a, b) => (b.customName || b.name).localeCompare(a.customName || a.name))
            .reverse()
            .map((a: any) => {
                const icon = a.api ? "scripture_alt" : a.collection ? "collection" : "scripture"
                const count = a.collection?.versions?.length || 0
                return { id: a.id, label: a.customName || a.name, icon, count, onDoubleClick: () => startScripture() }
            })
    }

    function startScripture() {
        openScripture.set({ play: true, book: Number($activeScripture.reference?.book || 1), chapter: $activeScripture.reference?.chapters[0], verses: $activeScripture.reference?.verses })
    }

    function newScripture() {
        activePopup.set("import_scripture")
    }

    function createCollection() {
        activePopup.set("create_collection")
    }

    function updateName(e: any) {
        const { id, value } = e.detail
        scriptures.update((a) => {
            a[id].customName = value
            return a
        })
    }
</script>

<NavigationSections {sections} active={activeSubTab} on:rename={updateName}>
    <div slot="section_0" style={favoritesList.length ? "" : "padding: 8px;{collections.length ? 'padding-top: 12px;' : ''}"}>
        {#if !favoritesList.length}
            <MaterialButton disabled={readOnly || (!apiBibles.length && !localBibles.length)} style="width: 100%;" title="popup.import_scripture" variant="outlined" on:click={createCollection} small>
                <Icon id="add" size={$labelsDisabled ? 0.9 : 1} white={$labelsDisabled} />
                {#if !$labelsDisabled}<T id="new.collection" />{/if}
            </MaterialButton>
        {/if}
    </div>
    <div slot="section_1" style="padding: 8px;{apiBibles.length || localBibles.length ? 'padding-top: 12px;' : ''}">
        {#if favoritesList.length}
            <MaterialButton disabled={readOnly || (!apiBibles.length && !localBibles.length)} style="width: 100%;" title="popup.import_scripture" variant="outlined" on:click={createCollection} small>
                <Icon id="add" size={$labelsDisabled ? 0.9 : 1} white={$labelsDisabled} />
                {#if !$labelsDisabled}<T id="new.collection" />{/if}
            </MaterialButton>
        {:else}
            <MaterialButton style="width: 100%;" title="popup.import_scripture" variant="outlined" disabled={readOnly} on:click={newScripture} small>
                <Icon id="add" size={$labelsDisabled ? 0.9 : 1} white={$labelsDisabled} />
                {#if !$labelsDisabled}<T id="new.scripture" />{/if}
            </MaterialButton>
        {/if}
    </div>
    <div slot="section_2" style="padding: 8px;{apiBibles.length || localBibles.length ? 'padding-top: 12px;' : ''}">
        {#if favoritesList.length}
            <MaterialButton style="width: 100%;" title="popup.import_scripture" variant="outlined" disabled={readOnly} on:click={newScripture} small>
                <Icon id="add" size={$labelsDisabled ? 0.9 : 1} white={$labelsDisabled} />
                {#if !$labelsDisabled}<T id="new.scripture" />{/if}
            </MaterialButton>
        {/if}
    </div>
</NavigationSections>
