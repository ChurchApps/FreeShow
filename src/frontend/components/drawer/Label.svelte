<script lang="ts">
    import { fullColors } from "../../stores"
    import { getContrast } from "../helpers/color"
    import Icon from "../helpers/Icon.svelte"

    export let label: string
    export let title: string = ""
    export let icon: null | string = null
    export let color: null | string = null
    export let white: boolean = false
    export let mode: "grid" | "list" | "lyrics" = "grid"
</script>

<div class="label" {title} class:list={mode !== "grid"} style={$fullColors ? `background-color: ${color};color: ${getContrast(color || "")};` : mode !== "list" ? `border-bottom: 2px solid ${color};` : ""}>
    {#if icon}
        <Icon id={icon} class="icon" {white} />
    {/if}
    <span class:alignRight={icon}>{label}</span>
</div>

<style>
    .label {
        position: relative;
        display: flex;
        align-items: center;
        background-color: var(--primary-darkest);

        padding: 4px 5px;
        padding-bottom: 3px;
        font-size: 0.8em;
        /* font-weight: bold; */

        height: 25px;
        flex: 1;

        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;

        width: 100%;
        text-align: center;
    }

    div.list {
        height: 100%;
        font-size: inherit;
        padding: 4px 16px;
        background-color: var(--primary);
    }

    div :global(.icon) {
        position: absolute;
    }

    div span {
        width: 100%;
        margin: 0 5px;
        text-align: center;
        overflow-x: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    div span.alignRight {
        margin: 0;
        margin-left: 24px;
    }
    div.list span {
        text-align: left;
        padding: 0 10px;
    }
</style>
