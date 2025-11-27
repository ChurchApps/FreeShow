<script lang="ts">
    import { drawerTabsData, effects, labelsDisabled, overlayCategories, overlays } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import { keysToID, sortObject } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import NavigationSections from "./NavigationSections.svelte"

    const profile = getAccess("overlays")
    $: readOnly = profile.global === "read"

    $: activeSubTab = $drawerTabsData.overlays?.activeSubTab || ""

    $: categoriesList = keysToID($overlayCategories)
    $: unarchivedCategoriesList = categoriesList.filter(a => !a.isArchive && profile[a.id] !== "none")
    $: archivedCategoriesList = categoriesList.filter(a => a.isArchive)

    $: allVisibleOverlays = Object.values($overlays).filter(a => a && profile[a.category || ""] !== "none")
    $: unarchivedOverlays = allVisibleOverlays.filter(a => a.category === null || !$overlayCategories[a.category]?.isArchive)
    $: uncategorizedOverlaysLength = unarchivedOverlays.filter(a => a.category === null || !$overlayCategories[a.category]).length

    $: effectsLength = Object.keys($effects).length

    let sections: any[] = []
    $: sections = [
        [
            { id: "all", label: "category.all", icon: "all", count: unarchivedOverlays.length },
            { id: "unlabeled", label: "category.unlabeled", icon: "noIcon", count: uncategorizedOverlaysLength, hidden: !uncategorizedOverlaysLength && activeSubTab !== "unlabeled" }
        ],
        [{ id: "effects", label: "tabs.effects", icon: "effects", count: effectsLength }],
        [{ id: "TITLE", label: "guide_title.categories" }, ...convertToButton(unarchivedCategoriesList), ...(archivedCategoriesList.length ? [{ id: "SEPARATOR", label: "actions.archive_title" }, ...convertToButton(archivedCategoriesList)] : [])]
    ]

    function convertToButton(categories: any[]) {
        return sortObject(categories, "name").map((a: any) => {
            const count = allVisibleOverlays.reduce((count, overlay) => count + (overlay.category === a.id ? 1 : 0), 0)
            const readOnly = profile.global === "read" || profile[a.id] === "read"
            return { id: a.id, label: a.name, icon: a.icon, count, readOnly }
        })
    }

    function newCategory() {
        history({ id: "UPDATE", location: { page: "drawer", id: "category_overlays" } })
    }

    function updateName(e: any) {
        const { id, value } = e.detail
        overlayCategories.update(a => {
            if (a[id].default) delete a[id].default
            a[id].name = value
            return a
        })
    }
</script>

<NavigationSections {sections} active={activeSubTab} on:rename={updateName}>
    <div slot="section_2" style="padding: 8px;{categoriesList.length ? 'padding-top: 12px;' : ''}">
        <MaterialButton style="width: 100%;" title="new.category" variant="outlined" disabled={readOnly} on:click={newCategory} small>
            <Icon id="add" size={$labelsDisabled ? 0.9 : 1} white={$labelsDisabled} />
            {#if !$labelsDisabled}<T id="new.category" />{/if}
        </MaterialButton>
    </div>
</NavigationSections>
