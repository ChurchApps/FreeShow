<script lang="ts">
    import { overlays } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { actionData } from "../../actions/actionData"
    import { getActionName, getActionTriggerId } from "../../actions/actions"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import Button from "../../inputs/Button.svelte"

    export let columns: number
    export let overlayId = ""

    $: overlay = $overlays[overlayId] || {}

    function changeAction(actionId: string) {
        // don't update until overlay display click has finished
        setTimeout(() => {
            // WIP history
            overlays.update((a) => {
                delete a[overlayId][actionId]
                a[overlayId].modified = Date.now()
                return a
            })
        })
    }

    const actionsList = [
        { id: "locked", title: translateText("context.lock_to_output"), icon: "locked" },
        { id: "placeUnderSlide", title: translateText("context.place_under_slide"), icon: "under" },
        { id: "displayDuration", title: translateText("popup.display_duration"), icon: "clock" }
    ]

    $: zoom = 5 / columns

    function removeAction(e: any, id: string) {
        e.preventDefault()

        let actions = clone(overlay.actions || [])
        let actionIndex = actions.findIndex((a) => a.id === id || getActionTriggerId(a.triggers?.[0]) === id)
        if (actionIndex < 0) return
        actions.splice(actionIndex, 1)

        let newData = { key: "actions", data: actions }
        history({ id: "UPDATE", newData, oldData: { id: overlayId }, location: { page: "drawer", id: "overlay_key", override: `actions_${overlayId}` } })
    }
</script>

<div class="icons" style="zoom: {zoom};">
    <!-- actions -->
    {#if overlay?.actions?.length}
        {#each overlay.actions as action}
            <!-- should be always just one trigger on each action when on a slide -->
            {@const actionId = getActionTriggerId(action.triggers?.[0])}
            {@const customData = actionData[actionId] || {}}
            {@const actionValue = action?.actionValues?.[actionId] || action?.actionValues?.[action.triggers?.[0]] || {}}
            {@const customName = getActionName(actionId, actionValue) || (action.name !== translateText(customData.name) ? action.name : "")}

            <div class="button {customData.red ? '' : 'white'}">
                <Button style="padding: 3px;" redHover title="{translateText('actions.remove')}: <b>{translateText(customData.name)}</b>{action.name && action.name !== translateText(customData.name) ? `\n${action.name}` : ''}" {zoom} on:click={(e) => setTimeout(() => removeAction(e, action.id || actionId))}>
                    {#if customName}<p>{customName}</p>{/if}
                    <Icon id={customData.icon || "actions"} size={0.9} white />
                </Button>
            </div>
        {/each}
    {/if}

    {#each actionsList as action}
        {#if overlay[action.id]}
            <div>
                <div class="button white">
                    <Button style="padding: 3px;" redHover title="{translateText('actions.remove')}: {action.title}" {zoom} on:click={() => changeAction(action.id)}>
                        <Icon id={action.icon} size={0.9} white />
                    </Button>
                </div>
                {#if action.id === "displayDuration" && !isNaN(overlay[action.id] || 0)}
                    <span><p>{overlay[action.id] || 0}s</p></span>
                {/if}
            </div>
        {/if}
    {/each}
</div>

<style>
    .icons {
        pointer-events: none;
        display: flex;
        flex-direction: column;
        position: absolute;
        left: 0;
        /* right: 2px; */
        z-index: 1;
        font-size: 0.9em;

        height: 80%;
        flex-wrap: wrap; /* -reverse; */
        /* place-items: end; */
    }
    .icons div {
        opacity: 0.9;
        display: flex;
    }
    .icons .button {
        background-color: rgb(0 0 0 / 0.6);
        pointer-events: all;
    }
    .icons span {
        pointer-events: all;
        background-color: rgb(0 0 0 / 0.6);
        padding: 3px;
        font-size: 0.75em;
        font-weight: bold;
        display: flex;
        align-items: center;
    }

    .button:not(.white) :global(svg) {
        fill: #ff5050;
    }
</style>
