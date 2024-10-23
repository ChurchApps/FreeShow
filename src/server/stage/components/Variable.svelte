<script lang="ts">
    import { variables } from "../store"

    export let id: string = ""
    export let style: string = ""

    $: variable = $variables[id] || {}
</script>

<div class="align autoFontSize" {style}>
    <div class="line">
        {#if variable.type === "number"}
            {Number(variable.number || 0)}
        {:else if variable.type === "text"}
            {variable.text || ""}
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
