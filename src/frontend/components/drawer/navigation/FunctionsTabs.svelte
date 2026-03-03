<script lang="ts">
    import { actions, actionTags, activeActionTagFilter, activeTimerTagFilter, activeVariableTagFilter, drawerTabsData, globalTags, timers, variables, variableTags } from "../../../stores"
    import { resolveAccessLevel } from "../../../utils/profileAccess"
    import { keysToID, sortByName, sortObject } from "../../helpers/array"
    import NavigationSections from "./NavigationSections.svelte"

    $: activeSubTab = $drawerTabsData.functions?.activeSubTab || ""

    $: actionsTagsOnly = Object.values($actions).map((a) => a.tags || [])
    $: variablesTagsOnly = Object.values($variables).map((a) => a.tags || [])
    $: visibleActionTags = sortObject(sortByName(keysToID($actionTags)), "color").filter((a) => resolveAccessLevel("actions", a.id) !== "none")
    $: sortedActions = visibleActionTags.map((a) => ({
        ...a,
        label: a.name,
        icon: "tag",
        openTrigger: (id, add) => activeActionTagFilter.set([...(add ? $activeActionTagFilter : []), id]),
        count: actionsTagsOnly.filter((b) => b.includes(a.id)).length
    }))
    $: timerTagsOnly = Object.values($timers).flatMap((a) => a.tags || [])
    $: allTimerTags = sortByName(
        timerTagsOnly
            .filter((tagId, index, arr) => arr.indexOf(tagId) === index)
            .map((id) => ({ id, name: $globalTags[id]?.name || id || "—" }))
    )
    $: visibleTimerTags = allTimerTags.filter((a) => resolveAccessLevel("timers", a.id) !== "none")
    $: sortedTimers = visibleTimerTags.map((a) => ({
        ...a,
        label: a.name,
        icon: "tag",
        openTrigger: (id, add) => activeTimerTagFilter.set([...(add ? $activeTimerTagFilter : []), id]),
        count: timerTagsOnly.filter((b) => b === a.id).length
    }))
    $: visibleVariableTags = sortObject(sortByName(keysToID($variableTags)), "color").filter((a) => resolveAccessLevel("variables", a.id) !== "none")
    $: sortedVariables = visibleVariableTags.map((a) => ({
        ...a,
        label: a.name,
        icon: "tag",
        openTrigger: (id, add) => activeVariableTagFilter.set([...(add ? $activeVariableTagFilter : []), id]),
        count: variablesTagsOnly.filter((b) => b.includes(a.id)).length
    }))

    $: hiddenActionTags = new Set(sortByName(keysToID($actionTags)).filter((a) => resolveAccessLevel("actions", a.id) === "none").map((a) => a.id))
    $: hiddenTimerTags = new Set(allTimerTags.filter((a) => resolveAccessLevel("timers", a.id) === "none").map((a) => a.id))
    $: hiddenVariableTags = new Set(sortByName(keysToID($variableTags)).filter((a) => resolveAccessLevel("variables", a.id) === "none").map((a) => a.id))
    $: if ($activeActionTagFilter.some((tagId) => hiddenActionTags.has(tagId))) activeActionTagFilter.set($activeActionTagFilter.filter((tagId) => !hiddenActionTags.has(tagId)))
    $: if ($activeTimerTagFilter.some((tagId) => hiddenTimerTags.has(tagId))) activeTimerTagFilter.set($activeTimerTagFilter.filter((tagId) => !hiddenTimerTags.has(tagId)))
    $: if ($activeVariableTagFilter.some((tagId) => hiddenVariableTags.has(tagId))) activeVariableTagFilter.set($activeVariableTagFilter.filter((tagId) => !hiddenVariableTags.has(tagId)))

    let sections: any[] = []
    $: sections = [
        ...(resolveAccessLevel("actions") === "none"
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
        ...(resolveAccessLevel("timers") === "none"
            ? []
            : [
                  [
                      {
                          id: "timer",
                          label: "tabs.timers",
                          icon: "timer",
                          openTrigger: () => activeTimerTagFilter.set([]),
                          submenu: { options: sortedTimers }
                      }
                  ]
              ]),
        ...(resolveAccessLevel("variables") === "none"
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
        ...(resolveAccessLevel("triggers") === "none" ? [] : [[{ id: "triggers", label: "tabs.triggers", icon: "trigger" }]])
    ]
</script>

<NavigationSections {sections} active={activeSubTab} />
