<script lang="ts">
    import { actions, outputs, scenes } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getAccess } from "../../../utils/profile"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import Button from "../../inputs/Button.svelte"

    export let columns: number
    export let sceneId = ""

    $: scene = $scenes[sceneId] || {}

    $: zoom = 5 / columns

    $: profile = getAccess("scenes")
    $: readOnly = profile.global === "read" || profile[sceneId] === "read"

    function removeCustomAction(e: any) {
        e.preventDefault()
        if (readOnly) return
        let newData = { key: "action", data: "" }
        history({ id: "UPDATE", newData, oldData: { id: sceneId }, location: { page: "drawer", id: "scene_key", override: `action_${sceneId}` } })
    }

    function removeBindings(e: any) {
        e.preventDefault()
        if (readOnly) return
        let newData = { key: "bindings", data: [] }
        history({ id: "UPDATE", newData, oldData: { id: sceneId }, location: { page: "drawer", id: "scene_key", override: `bindings_${sceneId}` } })
    }
</script>

<div class="icons" style="zoom: {zoom};">
    <!-- custom action -->
    {#if scene?.action && $actions[scene.action]}
        {@const act = $actions[scene.action]}
        <div class="button white">
            <Button style="padding: 3px;" redHover title="{translateText('actions.remove')}: <b>{act.name}</b>" {zoom} on:click={removeCustomAction}>
                <Icon id="actions" size={0.9} white />
                <p>{act.name}</p>
            </Button>
        </div>
    {/if}

    <!-- output bindings -->
    {#if scene?.bindings?.length}
        <div>
            <div class="button white">
                <Button style="padding: 3px;" redHover title={translateText("actions.remove_binding")} {zoom} on:click={removeBindings}>
                    <Icon id="bind" size={0.9} white />
                </Button>
            </div>
            {#if scene.bindings.length > 1}
                <span><p>{scene.bindings.length}</p></span>
            {:else}
                <span><p>{$outputs[scene.bindings[0]]?.name || ""}</p></span>
            {/if}
        </div>
    {/if}
</div>

<style>
    .icons {
        pointer-events: none;
        display: flex;
        flex-direction: column;
        position: absolute;
        left: 0;
        top: 0;
        max-width: 100%;
        box-sizing: border-box;
        z-index: 5;
        font-size: 0.9em;

        height: 80%;
        flex-wrap: wrap;
    }
    .icons div {
        opacity: 0.9;
        display: flex;
        max-width: 100%;
        box-sizing: border-box;
    }
    .icons .button {
        background-color: rgb(0 0 0 / 0.6);
        pointer-events: all;
        max-width: 100%;
    }
    .icons .button :global(button) {
        max-width: 100%;
        overflow: hidden;
    }
    .icons p {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .button p {
        padding-inline-start: 4px;
        font-size: 0.8em;
    }
    .icons span {
        pointer-events: all;
        background-color: rgb(0 0 0 / 0.6);
        padding: 3px;
        font-size: 0.75em;
        font-weight: bold;
        display: flex;
        align-items: center;
        max-width: 100%;
        overflow: hidden;
    }

    .button:not(.white) :global(svg) {
        fill: #ff5050;
    }
</style>
