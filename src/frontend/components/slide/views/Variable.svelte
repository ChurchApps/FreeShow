<script lang="ts">
    import { onDestroy } from "svelte"
    import type { Item } from "../../../../types/Show"
    import { activeDrawerTab, drawer, variables } from "../../../stores"
    import { setDrawerTabData } from "../../helpers/historyHelpers"
    import { replaceDynamicValues } from "../../helpers/showActions"

    export let id = ""
    export let item: null | Item = null
    export let style = ""
    export let edit = false
    export let hideText = true
    export let ref: any = {}

    $: variable = $variables[id || item?.variable?.id] || {}

    function openInDrawer() {
        if (!edit) return

        setDrawerTabData("functions", "variables")
        activeDrawerTab.set("functions")

        // open drawer if closed
        if ($drawer.height <= 40) drawer.set({ height: $drawer.stored || 300, stored: null })
    }

    // UPDATE DYNAMIC VALUES e.g. {time_} EVERY SECOND
    let updateDynamic = 0
    const dynamicInterval = setInterval(() => {
        updateDynamic++
    }, 1000)
    onDestroy(() => clearInterval(dynamicInterval))
</script>

<div class="align autoFontSize" style="{style}{item?.align || ''}" class:hidden={variable.enabled === false} on:dblclick={openInDrawer}>
    <div class="line">
        {#if variable.type === "number"}
            {Number(variable.number || 0)}
        {:else if variable.type === "text"}
            {variable.enabled === false && hideText ? "" : replaceDynamicValues(variable.text || "", ref, updateDynamic)}
        {/if}
    </div>
</div>

<style>
    .align {
        display: flex;
        justify-content: center;
        width: 100%;
        height: 100%;
        align-items: center;

        text-align: center;
    }

    .align.hidden {
        opacity: 0.2;
    }

    .line {
        width: 100%;
    }
</style>
