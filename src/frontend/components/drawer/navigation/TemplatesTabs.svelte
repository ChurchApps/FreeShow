<script lang="ts">
    import { drawerTabsData, labelsDisabled, templateCategories, templates } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import { keysToID, sortObject } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import NavigationSections from "./NavigationSections.svelte"

    const profile = getAccess("templates")
    $: readOnly = profile.global === "read"

    $: activeSubTab = $drawerTabsData.templates?.activeSubTab || ""

    $: categoriesList = keysToID($templateCategories)
    $: unarchivedCategoriesList = categoriesList.filter((a) => !a.isArchive && profile[a.id] !== "none")
    $: archivedCategoriesList = categoriesList.filter((a) => a.isArchive)

    $: allVisibleOverlays = Object.values($templates).filter((a) => a && profile[a.category || ""] !== "none")
    $: unarchivedOverlays = allVisibleOverlays.filter((a) => a.category === null || !$templateCategories[a.category]?.isArchive)
    $: uncategorizedOverlaysLength = unarchivedOverlays.filter((a) => a.category === null || !$templateCategories[a.category]).length

    let sections: any[] = []
    $: sections = [
        [
            { id: "all", label: "category.all", icon: "all", count: unarchivedOverlays.length },
            { id: "unlabeled", label: "category.unlabeled", icon: "noIcon", count: uncategorizedOverlaysLength, hidden: !uncategorizedOverlaysLength && activeSubTab !== "unlabeled" }
        ],
        [{ id: "TITLE", label: "guide_title.categories" }, ...convertToButton(unarchivedCategoriesList), ...(archivedCategoriesList.length ? [{ id: "SEPERATOR", label: "actions.archive_title" }, ...convertToButton(archivedCategoriesList)] : [])]
    ]

    function convertToButton(categories: any[]) {
        return sortObject(categories, "name").map((a: any) => {
            const count = allVisibleOverlays.reduce((count, template) => count + (template.category === a.id ? 1 : 0), 0)
            const readOnly = profile.global === "read" || profile[a.id] === "read"
            return { id: a.id, label: a.name, icon: a.icon, count, readOnly }
        })
    }

    function newCategory() {
        history({ id: "UPDATE", location: { page: "drawer", id: "category_templates" } })
    }

    function updateName(e: any) {
        const { id, value } = e.detail
        templateCategories.update((a) => {
            if (a[id].default) delete a[id].default
            a[id].name = value
            return a
        })
    }
</script>

<NavigationSections {sections} active={activeSubTab} on:rename={updateName}>
    <div slot="section_1" style="padding: 8px;{categoriesList.length ? 'padding-top: 12px;' : ''}">
        <MaterialButton icon="add" style="width: 100%;" title="new.category" variant="outlined" disabled={readOnly} on:click={newCategory} small>
            {#if !$labelsDisabled}<T id="new.category" />{/if}
        </MaterialButton>
    </div>
</NavigationSections>
