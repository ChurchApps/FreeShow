<script lang="ts">
    import { actions, actionTags, activeActionTagFilter, activeVariableTagFilter, drawerTabsData, variables, variableTags } from "../../../stores"
    import { keysToID, sortByName, sortObject } from "../../helpers/array"
    import NavigationSections from "./NavigationSections.svelte"

    // const profile = getAccess("functions")
    // $: readOnly = profile.global === "read"

    $: activeSubTab = $drawerTabsData.functions?.activeSubTab || ""

    $: actionsTagsOnly = Object.values($actions).map((a) => a.tags || [])
    $: variablesTagsOnly = Object.values($variables).map((a) => a.tags || [])
    $: sortedActions = sortObject(sortByName(keysToID($actionTags)), "color").map((a) => ({
        ...a,
        label: a.name,
        icon: "tag",
        openTrigger: (id, add) => activeActionTagFilter.set([...(add ? $activeActionTagFilter : []), id]),
        count: actionsTagsOnly.filter((b) => b.includes(a.id)).length
    }))
    $: sortedVariables = sortObject(sortByName(keysToID($variableTags)), "color").map((a) => ({
        ...a,
        label: a.name,
        icon: "tag",
        openTrigger: (id, add) => activeVariableTagFilter.set([...(add ? $activeVariableTagFilter : []), id]),
        count: variablesTagsOnly.filter((b) => b.includes(a.id)).length
    }))

    let sections: any[] = []
    $: sections = [
        [
            {
                id: "actions",
                label: "tabs.actions",
                icon: "actions",
                openTrigger: () => activeActionTagFilter.set([]),
                submenu: { options: sortedActions }
            }
        ],
        [{ id: "timer", label: "tabs.timers", icon: "timer" }],
        [
            {
                id: "variables",
                label: "tabs.variables",
                icon: "variable",
                openTrigger: () => activeVariableTagFilter.set([]),
                submenu: { options: sortedVariables }
            }
        ],
        [{ id: "triggers", label: "tabs.triggers", icon: "trigger" }]
    ]
</script>

<NavigationSections {sections} active={activeSubTab} />
