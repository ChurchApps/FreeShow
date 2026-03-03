<script lang="ts">
    import { actions, actionTags, activeActionTagFilter, activeVariableTagFilter, drawerTabsData, variables, variableTags } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import { functionActionTagAccessKey, functionVariableTagAccessKey, resolveAccessLevel } from "../../../utils/profileAccess"
    import { keysToID, sortByName, sortObject } from "../../helpers/array"
    import NavigationSections from "./NavigationSections.svelte"

    const profile = getAccess("functions")

    $: activeSubTab = $drawerTabsData.functions?.activeSubTab || ""

    $: actionsTagsOnly = Object.values($actions).map((a) => a.tags || [])
    $: variablesTagsOnly = Object.values($variables).map((a) => a.tags || [])
    $: visibleActionTags = sortObject(sortByName(keysToID($actionTags)), "color").filter((a) => resolveAccessLevel(profile, functionActionTagAccessKey(a.id)) !== "none")
    $: sortedActions = visibleActionTags.map((a) => ({
        ...a,
        label: a.name,
        icon: "tag",
        openTrigger: (id, add) => activeActionTagFilter.set([...(add ? $activeActionTagFilter : []), id]),
        count: actionsTagsOnly.filter((b) => b.includes(a.id)).length
    }))
    $: visibleVariableTags = sortObject(sortByName(keysToID($variableTags)), "color").filter((a) => resolveAccessLevel(profile, functionVariableTagAccessKey(a.id)) !== "none")
    $: sortedVariables = visibleVariableTags.map((a) => ({
        ...a,
        label: a.name,
        icon: "tag",
        openTrigger: (id, add) => activeVariableTagFilter.set([...(add ? $activeVariableTagFilter : []), id]),
        count: variablesTagsOnly.filter((b) => b.includes(a.id)).length
    }))

    $: hiddenActionTags = new Set(sortByName(keysToID($actionTags)).filter((a) => resolveAccessLevel(profile, functionActionTagAccessKey(a.id)) === "none").map((a) => a.id))
    $: hiddenVariableTags = new Set(sortByName(keysToID($variableTags)).filter((a) => resolveAccessLevel(profile, functionVariableTagAccessKey(a.id)) === "none").map((a) => a.id))
    $: if ($activeActionTagFilter.some((tagId) => hiddenActionTags.has(tagId))) activeActionTagFilter.set($activeActionTagFilter.filter((tagId) => !hiddenActionTags.has(tagId)))
    $: if ($activeVariableTagFilter.some((tagId) => hiddenVariableTags.has(tagId))) activeVariableTagFilter.set($activeVariableTagFilter.filter((tagId) => !hiddenVariableTags.has(tagId)))

    let sections: any[] = []
    $: sections = [
        ...(resolveAccessLevel(profile, "actions") === "none"
            ? []
            : [
                  [
                      {
                          id: "actions",
                          label: "tabs.actions",
                          icon: "actions",
                          openTrigger: () => activeActionTagFilter.set([]),
                          submenu: { options: sortedActions }
                      }
                  ]
              ]),
        ...(resolveAccessLevel(profile, "timers") === "none" ? [] : [[{ id: "timer", label: "tabs.timers", icon: "timer" }]]),
        ...(resolveAccessLevel(profile, "variables") === "none"
            ? []
            : [
                  [
                      {
                          id: "variables",
                          label: "tabs.variables",
                          icon: "variable",
                          openTrigger: () => activeVariableTagFilter.set([]),
                          submenu: { options: sortedVariables }
                      }
                  ]
              ]),
        ...(resolveAccessLevel(profile, "triggers") === "none" ? [] : [[{ id: "triggers", label: "tabs.triggers", icon: "trigger" }]])
    ]
</script>

<NavigationSections {sections} active={activeSubTab} />
