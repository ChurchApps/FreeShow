<script lang="ts">
    export let side: "right" | "left" | "center" = "right"
    export let bottom = 10
</script>

<div class="row {side}" style="bottom: {bottom}px;">
    <slot />
</div>

<style>
    .row {
        --size: 40px;
        --padding: 12px;

        display: flex;
        background-color: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);
        box-shadow: 1px 1px 6px rgb(0 0 0 / 0.4);

        height: var(--size);

        position: absolute;
        bottom: var(--padding);

        border-radius: var(--size);
        overflow: hidden;
        z-index: 199;

        max-width: calc(100% - 22px);
    }

    .row.right {
        right: var(--padding);
    }
    .row.left {
        left: var(--padding);
    }
    .row.center {
        left: 50%;
        transform: translateX(-50%);
    }

    .row :global(.divider) {
        height: 100%;
        width: 1px;
        background-color: var(--primary-lighter);
    }

    .row :global(button) {
        background-color: transparent !important;
        height: calc(var(--size) - 2px);
        padding: 0 12px !important;
        border-radius: 0;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 0.5em;
    }

    .row :global(button) :global(svg) {
        flex-shrink: 0;
    }

    .row :global(button) :global(span) {
        white-space: nowrap;
    }

    /* Mobile - account for bottom navigation bar */
    @media screen and (max-width: 1000px) {
        .row {
            bottom: 60px !important;
        }
    }
</style>
