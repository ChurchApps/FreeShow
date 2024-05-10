<script lang="ts">
    import type { Item } from "../../../../types/Show"
    import { activeDrawerTab, drawer, variables } from "../../../stores"
    import { setDrawerTabData } from "../../helpers/historyHelpers"

    export let id: string = ""
    export let item: null | Item = null
    export let style: string = ""
    export let edit: boolean = false
    export let hideText: boolean = true

    $: variable = $variables[id || item?.variable?.id] || {}

    function openInDrawer() {
        if (!edit) return

        setDrawerTabData("calendar", "variables")
        activeDrawerTab.set("overlays")

        // open drawer if closed
        if ($drawer.height <= 40) drawer.set({ height: $drawer.stored || 300, stored: null })
    }
</script>

<div class="align" style="{style}{item?.align || ''}" on:dblclick={openInDrawer}>
    <div class="line">
        {#if variable.type === "number"}
            {Number(variable.number || 0)}
        {:else if variable.type === "text"}
            {variable.enabled === false && hideText ? "" : variable.text || ""}
        {/if}
    </div>
</div>

<style>
    .align {
        display: flex;
        justify-content: center;
        height: 100%;
        align-items: center;

        text-align: center;
    }

    .line {
        width: 100%;
    }
</style>
