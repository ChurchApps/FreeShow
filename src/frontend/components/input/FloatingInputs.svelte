<script lang="ts">
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"

    export let side: "right" | "left" = "right"
    export let onlyOne: boolean = false
    export let round: boolean = false
    export let arrow: boolean = false
    export let bottom: number = 10

    let open = false
</script>

<div class="row {side}" class:onlyOne class:round style="bottom: {bottom}px;" on:mousedown>
    {#if arrow}
        <MaterialButton style={open ? "" : "opacity: 0.6;"} class="expand" title={open ? "actions.close" : "create_show.more_options"} isActive={open} on:click={() => (open = !open)}>
            <Icon class="submenu_{open ? 'close' : 'open'}" id="arrow_back_modern" size={0.9} white={!open} />
        </MaterialButton>

        <div class="divider"></div>

        {#if open}
            <!-- transition:slide={{ duration: 500, axis: "x" }} -->
            <div class="menu">
                <slot name="menu" />
            </div>

            <!-- <div class="divider"></div> -->
        {/if}
    {/if}

    <slot {open} />
</div>

<style>
    .row {
        --size: 40px;
        --padding: 10px;

        display: flex;
        background-color: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);
        box-shadow: 1px 1px 6px rgb(0 0 0 / 0.4);

        height: var(--size);

        position: absolute;
        bottom: var(--padding);

        border-radius: var(--size);
        /* padding: 0 18px; */
        overflow: hidden;
        z-index: 3;
    }
    .row:has(.overflow) {
        overflow: visible;
    }

    .row.round {
        border-radius: 50%;

        --size: 45px;
    }

    .row.right {
        right: var(--padding);
    }
    .row.left {
        left: var(--padding);
    }

    .row :global(.divider) {
        height: 100%;
        width: 1px;
        background-color: var(--primary-lighter);
    }

    .row :global(button) {
        background-color: transparent !important;
        height: calc(var(--size) - 2px);
        /* aspect-ratio: 1; */
        padding: 0 12px !important;
        border-radius: 0;
    }
    .row.onlyOne :global(button) {
        padding: 0 20px !important;
    }
    .row.round :global(button) {
        aspect-ratio: 1;
        /* width: var(--size);
        height: var(--size); */
    }

    .row :global(button.expand.isActive) {
        border: none !important;
        cursor: pointer;
    }
    .row :global(button.expand svg) {
        transition: 0.3s transform ease;
    }
    .row :global(button.expand.isActive svg) {
        transform: rotate(180deg);
    }

    .menu {
        display: flex;
        flex-direction: column;
    }
</style>
