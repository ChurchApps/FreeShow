<script lang="ts">
    import type { Output } from "../../../types/Output"
    import type { Show } from "../../../types/Show"
    import { activeShow, groups, outputs, showsCache, special, templates } from "../../stores"
    import { translateText } from "../../utils/language"
    import { actionData } from "../actions/actionData"
    import { getActionName, getActionTriggerId } from "../actions/actions"
    import { clone } from "../helpers/array"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { getFirstActiveOutput } from "../helpers/output"
    import { getLayoutRef } from "../helpers/show"
    import Button from "../inputs/Button.svelte"

    export let columns: number
    export let index = -1
    export let templateId = ""
    export let actions: any

    $: showId = $activeShow?.id || ""
    $: currentShow = $showsCache[showId] || {}

    // highlight slide shortcut or next group shortcut
    $: shortcut = getNextShortcut(actions, currentShow, getFirstActiveOutput($outputs))

    function getNextShortcut(actions: any, show: Show, output?: Output & { id: string }): string {
        // slide shortcut
        if (actions.slide_shortcut?.key) return actions.slide_shortcut.key

        // don't show group shortcut
        if (!$special.groupShortcutPreview) return ""

        const outSlide = output?.out?.slide
        // output is from another show
        if (outSlide && (outSlide?.id !== showId || outSlide?.layout !== show?.settings?.activeLayout)) return ""

        const ref = getLayoutRef(showId)
        const refSlide = ref[index] || {}
        const currentSlideGroup = refSlide.type === "parent" ? show.slides?.[refSlide.id]?.globalGroup : null
        const shortcut = ($groups[currentSlideGroup || ""]?.shortcut || "").toUpperCase()
        if (!shortcut) return ""

        // check if group shortcut is in use as slide shortcut
        const isSlideShortcut = ref.some((a) => {
            const slideShortcut = (a.data?.actions?.slide_shortcut?.key || "").toUpperCase()
            return slideShortcut === shortcut
        })
        if (isSlideShortcut) return ""

        // find first group after the current output index
        const outIndex = outSlide?.index ?? -1
        let nextGroupIndex = ref.findIndex((a) => {
            let slideGroup = show.slides?.[a.id]?.globalGroup
            if (!slideGroup || slideGroup !== currentSlideGroup) return false
            return a.layoutIndex > outIndex
        })

        // if no group after index, get the first
        if (nextGroupIndex === -1) {
            nextGroupIndex = ref.findIndex((a) => {
                let slideGroup = show.slides?.[a.id]?.globalGroup
                return slideGroup && slideGroup === currentSlideGroup
            })
        }

        if (nextGroupIndex !== index) return ""

        return shortcut
    }

    function changeAction(id: string, save = true) {
        if (templateId || currentShow.locked) return

        let data = { ...actions, [id]: actions[id] ? !actions[id] : true }

        if (id === "slide_shortcut") delete data[id]
        else if (id === "outputStyle" && !data[id]) delete data.styleOutputs

        history({ id: "SHOW_LAYOUT", save, newData: { key: "actions", data, indexes: [index] } })
    }

    function deleteSlideAction(e: any, id: string) {
        if (currentShow.locked) return
        e.preventDefault()

        let slideActions = clone(actions.slideActions)
        let actionIndex = slideActions.findIndex((a) => a.id === id || getActionTriggerId(a.triggers?.[0]) === id)
        if (actionIndex < 0) return
        slideActions.splice(actionIndex, 1)

        if (templateId) {
            let templateSettings = $templates[templateId]?.settings || {}
            templateSettings.actions = slideActions

            let newData = { key: "settings", data: templateSettings }
            history({ id: "UPDATE", newData, oldData: { id: templateId }, location: { page: "drawer", id: "template_settings", override: `actions_${templateId}` } })

            return
        }

        let data = { ...actions, slideActions }

        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data, indexes: [index] } })
    }

    const actionsList = [
        { id: "nextAfterMedia", title: translateText("actions.next_after_media"), icon: "forward" },
        { id: "animate", title: translateText("popup.animate"), icon: "stars" },
        { id: "receiveMidi", title: translateText("actions.play_on_midi"), icon: "play" }
    ]

    // WIP MIDI convert into new
    // actionData get slideId and convert into slideActions

    $: zoom = 4 / columns

    function getCustomStyle(customData: { [key: string]: any }) {
        if (!Object.keys(customData || {}).length) return ""
        if (Object.entries(customData).find(([key, value]) => key === "overrideCategoryAction" && value === true)) return "color: #a1faff;"
        return ""
    }
</script>

<div class="icons" style="zoom: {zoom};">
    {#if shortcut}
        <div class="button white" style="border: 1px solid var(--secondary);">
            <Button style="padding: 3px;" redHover title={translateText("actions.remove: actions.play_with_shortcut")} {zoom} on:click={() => changeAction("slide_shortcut")}>
                <p style="font-weight: bold;text-transform: capitalize;padding: 0 4px;font-size: 1.2em;">{shortcut}</p>
            </Button>
        </div>
    {/if}

    {#each actionsList as action}
        {#if actions[action.id]}
            <div class="button white">
                <Button style="padding: 3px;" redHover title={translateText(`actions.remove: ${action.title}`)} {zoom} on:click={() => changeAction(action.id)}>
                    <Icon id={action.icon} size={0.9} white />
                </Button>
            </div>
        {/if}
    {/each}

    <!-- slide actions -->
    {#if actions.slideActions?.length}
        {#each actions.slideActions as action}
            <!-- should be always just one trigger on each action when on a slide -->
            {@const actionId = getActionTriggerId(action.triggers?.[0])}
            {@const customData = actionData[actionId] || {}}
            {@const actionValue = action?.actionValues?.[actionId] || action?.actionValues?.[action.triggers?.[0]] || {}}
            {@const specialData = action?.customData?.[actionId] || action?.customData?.[action.triggers?.[0]] || {}}
            {@const customName = getActionName(actionId, actionValue) || (action.name !== translateText(customData.name) ? action.name : "")}

            <div class="button {customData.red ? '' : 'white'}">
                <Button style="padding: 3px;{getCustomStyle(specialData)}" redHover title="{translateText('actions.remove')}: <b>{translateText(customData.name)}</b>{action.name && action.name !== translateText(customData.name) ? `\n${action.name}` : ''}" {zoom} on:click={(e) => deleteSlideAction(e, action.id || actionId)}>
                    {#if customName}<p>{customName}</p>{/if}
                    <Icon id={customData.icon || "actions"} size={0.9} white />
                </Button>
            </div>
        {/each}
    {/if}
</div>

<style>
    .icons {
        pointer-events: none;
        display: flex;
        flex-direction: column;
        position: absolute;
        inset-inline-end: 2px;
        z-index: 1;
        font-size: 0.9em;

        height: 80%;
        flex-wrap: wrap-reverse;
        place-items: end;
    }
    .icons div {
        opacity: 0.9;
        display: flex;
    }
    .icons .button {
        background-color: rgb(0 0 0 / 0.6);
        pointer-events: all;
    }

    .button:not(.white) :global(svg) {
        fill: #ff5050;
    }

    .button p {
        pointer-events: all;
        background-color: rgb(0 0 0 / 0.4);
        padding-inline-end: 5px;
        font-size: 0.8em;
        font-weight: normal;
        max-width: 60px;
    }
</style>
