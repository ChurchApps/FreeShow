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

    let sections: any[] = []
    $: sections = [
        ...(collections.length ? [convertToButton(collections)] : []),
        [...convertToButton(localBibles), ...(localBibles.length && apiBibles.length ? ["SEPERATOR"] : []), ...convertToButton(apiBibles)]
        // ...(apiBibles.length ? [convertToButton(apiBibles)] : []),
        // ...(localBibles.length ? [convertToButton(localBibles)] : [])
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

<NavigationSections {sections} active={activeSubTab} on:rename={updateName}>
    <div slot="section_0" style={!collections.length ? `padding: 8px;${apiBibles.length || localBibles.length ? "padding-top: 12px;" : ""}` : ""}>
        {#if !collections.length}
            <MaterialButton icon="add" style="width: 100%;" title="popup.import_scripture" variant="outlined" disabled={readOnly} on:click={newScripture} small>
                {#if !$labelsDisabled}<T id="new.scripture" />{/if}
            </MaterialButton>
        {/if}
    </div>
    <div slot="section_1" style="padding: 8px;{apiBibles.length || localBibles.length ? 'padding-top: 12px;' : ''}">
        <MaterialButton icon="add" style="width: 100%;" title="popup.import_scripture" variant="outlined" disabled={readOnly} on:click={newScripture} small>
            {#if !$labelsDisabled}<T id="new.scripture" />{/if}
        </MaterialButton>
    </div>
</NavigationSections>
