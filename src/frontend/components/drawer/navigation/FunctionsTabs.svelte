<script lang="ts">
    import { onMount } from "svelte"
    import { actions, actionTags, activeActionTagFilter, activeVariableTagFilter, drawerTabsData, variables, variableTags, timers, timerTags, activeTimerTagFilter, obsData } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import { keysToID, sortByName, sortObject } from "../../helpers/array"
    import NavigationSections from "./NavigationSections.svelte"

    const actionsAccess = getAccess("actions")
    const variablesAccess = getAccess("variables")
    const timersAccess = getAccess("timers")

    $: activeSubTab = $drawerTabsData.functions?.activeSubTab || ""

    $: actionsTagsOnly = Object.values($actions).map((a) => a?.tags || [])
    $: visibleActionTags = sortObject(sortByName(keysToID($actionTags)), "color").filter((a) => actionsAccess[a.id] !== "none")
    $: sortedActions = visibleActionTags.map((a) => ({
        ...a,
        label: a.name,
        icon: "tag",
        openTrigger: (id, add) => activeActionTagFilter.set([...(add ? $activeActionTagFilter : []), id]),
        count: actionsTagsOnly.filter((b) => b.includes(a.id)).length
    }))

    $: variablesTagsOnly = Object.values($variables).map((a) => a?.tags || [])
    $: visibleVariableTags = sortObject(sortByName(keysToID($variableTags)), "color").filter((a) => variablesAccess[a.id] !== "none")
    $: sortedVariables = visibleVariableTags.map((a) => ({
        ...a,
        label: a.name,
        icon: "tag",
        openTrigger: (id, add) => activeVariableTagFilter.set([...(add ? $activeVariableTagFilter : []), id]),
        count: variablesTagsOnly.filter((b) => b.includes(a.id)).length
    }))

    $: timersTagsOnly = Object.values($timers).map((a) => a?.tags || [])
    $: visibleTimerTags = sortObject(sortByName(keysToID($timerTags)), "color").filter((a) => timersAccess[a.id] !== "none")
    $: sortedTimers = visibleTimerTags.map((a) => ({
        ...a,
        label: a.name,
        icon: "tag",
        openTrigger: (id, add) => activeTimerTagFilter.set([...(add ? $activeTimerTagFilter : []), id]),
        count: timersTagsOnly.filter((b) => b.includes(a.id)).length
    }))

    onMount(() => {
        // const hiddenActionTags = new Set(keysToID($actionTags).filter((a) => actionsAccess[a.id] === "none").map((a) => a.id))
        // const hiddenVariableTags = new Set(keysToID($variableTags).filter((a) => variablesAccess[a.id] === "none").map((a) => a.id))

        if ($activeActionTagFilter.length) activeActionTagFilter.set($activeActionTagFilter.filter((tagId) => visibleActionTags.some((tag) => tag.id === tagId)))
        if ($activeVariableTagFilter.length) activeVariableTagFilter.set($activeVariableTagFilter.filter((tagId) => visibleVariableTags.some((tag) => tag.id === tagId)))
        if ($activeTimerTagFilter.length) activeTimerTagFilter.set($activeTimerTagFilter.filter((tagId) => visibleTimerTags.some((tag) => tag.id === tagId)))
    })

    let sections: any[] = []
    $: sections = [
        ...(actionsAccess.global === "none"
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
        ...(timersAccess.global === "none"
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
        ...(variablesAccess.global === "none"
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

        ...($obsData.enabled ? [[{ id: "obs", label: "OBS Studio", icon: "player" }]] : [])
    ]
</script>

<NavigationSections {sections} active={activeSubTab} />
