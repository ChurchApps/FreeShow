<script lang="ts">
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"

    export let arrow = false

    export let open = false
</script>

<div class="row" style={$$props.style || null}>
    <slot />

    {#if arrow}
        <MaterialButton style="padding: 0.75rem;min-width: 50px;" title={open ? "actions.close" : "main.open"} on:click={() => (open = !open)}>
            {#if open}
                <Icon class="submenu_open" id="arrow_down" size={1.4} />
            {:else}
                <Icon class="submenu_open" id="arrow_right" size={1.4} white />
            {/if}
        </MaterialButton>
    {/if}
</div>

{#if arrow && open}
    <div class="menu">
        <slot name="menu" />
    </div>
{/if}

<style>
    .row {
        display: flex;
    }

    .row > :global(button) {
        background-color: var(--primary-darkest) !important;

        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
    }
    .row > :global(button:not(.isActive):not(:disabled)) {
        border-bottom: 1.2px solid var(--primary-lighter) !important;
    }

    .row :global(.togglefield:not(:first-child)),
    .row :global(.checkboxfield:not(:first-child)),
    .row :global(.textfield:not(:first-child)),
    .row :global(button:not(:first-child)) {
        border-left: 1px solid var(--primary-lighter) !important;
    }

    .menu {
        display: flex;
        flex-direction: column;

        border-left: 4px solid var(--primary-lighter);
    }
</style>
