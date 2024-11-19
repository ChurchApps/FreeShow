<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import Button from "../../common/components/Button.svelte"
    import Icon from "../../common/components/Icon.svelte"

    export let activeShow: any
    export let show: any
    export let match: null | number = null
    export let icon: string = ""

    // search
    $: style = match !== null ? `background: linear-gradient(to right, var(--secondary-opacity) ${match}%, transparent ${match}%);` : ""

    let dispatch = createEventDispatcher()
    function click() {
        dispatch("click", show.id)
    }
</script>

<div id={show.id} class="main">
    <Button on:click={click} active={activeShow?.id === show.id} class="context {$$props.class}" {style} bold={false} border>
        <span style="display: flex;align-items: center;flex: 1;overflow: hidden;">
            {#if icon}
                <Icon id={icon || "noIcon"} box={icon === "ppt" ? 50 : 24} right />
            {/if}

            <p style="margin: 3px 5px;white-space: nowrap;text-overflow: ellipsis;overflow: hidden;">{show.name}</p>
        </span>

        {#if match}
            <span style="opacity: 0.8;padding-left: 10px;">
                {match}%
            </span>
        {/if}
    </Button>
</div>

<style>
    .main :global(button) {
        width: 100%;
        justify-content: space-between;
    }
</style>
