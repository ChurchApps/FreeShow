<script lang="ts">
    import { categories, drawerTabsData, labelsDisabled, shows } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import { keysToID, sortObject } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import NavigationSections from "./NavigationSections.svelte"

    const profile = getAccess("shows")
    $: readOnly = profile.global === "read"

    $: activeSubTab = $drawerTabsData.shows?.activeSubTab || ""

    $: categoriesList = keysToID($categories)
    $: unarchivedCategoriesList = categoriesList.filter((a) => !a.isArchive && profile[a.id] !== "none")
    $: archivedCategoriesList = categoriesList.filter((a) => a.isArchive)

    $: allVisibleShows = Object.values($shows).filter((a) => a && !a.private && profile[a.category || ""] !== "none")
    $: unarchivedShows = allVisibleShows.filter((a) => a.category === null || !$categories[a.category]?.isArchive)
    // $: archivedShows = Object.values($shows).filter((a) => a.category !== null && $categories[a.category]?.isArchive)
    $: uncategorizedShowsLength = unarchivedShows.filter((a) => a.category === null || !$categories[a.category]).length
    // $: lockedShowsLength = allVisibleShows.filter((a) => a.locked).length
    $: songNumberShowsLength = allVisibleShows.filter((a) => a.quickAccess?.number).length

    let sections: any[] = []
    $: sections = [
        [
            { id: "all", label: "category.all", icon: "all", count: unarchivedShows.length },
            { id: "number", label: "meta.number", icon: "number", count: songNumberShowsLength, hidden: !songNumberShowsLength },
            // { id: "locked", label: "output.state_locked", icon: "locked", count: lockedShowsLength, hidden: !lockedShowsLength },
            { id: "unlabeled", label: "category.unlabeled", icon: "noIcon", count: uncategorizedShowsLength, hidden: !uncategorizedShowsLength && activeSubTab !== "unlabeled" }
        ],
        [{ id: "TITLE", label: "guide_title.categories" }, ...convertToButton(unarchivedCategoriesList), ...(archivedCategoriesList.length ? [{ id: "SEPARATOR", label: "actions.archive_title" }, ...convertToButton(archivedCategoriesList)] : [])]
    ]

    function convertToButton(categories: any[]) {
        return sortObject(categories, "name").map((a: any) => {
            const action = a.action
            const count = allVisibleShows.reduce((count, show) => count + (show.category === a.id ? 1 : 0), 0)
            const readOnly = profile.global === "read" || profile[a.id] === "read"
            return { id: a.id, label: a.name, icon: a.icon, action, count, readOnly }
        })
    }

    function newCategory() {
        history({ id: "UPDATE", location: { page: "drawer", id: "category_shows" } })
    }

    function updateName(e: any) {
        const { id, value } = e.detail
        categories.update((a) => {
            if (a[id].default) delete a[id].default
            a[id].name = value
            return a
        })
    }
</script>

<NavigationSections {sections} active={activeSubTab} on:rename={updateName}>
    <div slot="section_1" style="padding: 8px;{categoriesList.length ? 'padding-top: 12px;' : ''}">
        <MaterialButton style="width: 100%;" title="new.category" variant="outlined" disabled={readOnly} on:click={newCategory} small>
            <Icon id="add" size={$labelsDisabled ? 0.9 : 1} white={$labelsDisabled} />
            {#if !$labelsDisabled}<T id="new.category" />{/if}
        </MaterialButton>
    </div>
</NavigationSections>
