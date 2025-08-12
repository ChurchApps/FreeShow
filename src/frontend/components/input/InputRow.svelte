<div class="row">
    <slot />
</div>

<style>
    .row {
        display: flex;
    }

    .row :global(button) {
        border-bottom: 1.2px solid var(--primary-lighter) !important;
        background-color: var(--primary-darkest) !important;

        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
    }

    .row :global(.togglefield:not(:first-child)),
    .row :global(.textfield:not(:first-child)),
    .row :global(button:not(:first-child)) {
        border-left: 1px solid var(--primary-lighter) !important;
    }
</style>
