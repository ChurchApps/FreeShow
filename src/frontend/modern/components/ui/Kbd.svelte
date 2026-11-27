<kbd class="ui-kbd {$$props.class || ''}">
    <slot />
</kbd>

<style>
    .ui-kbd {
        display: inline-flex;
        align-items: center;
        justify-content: center;

        min-width: 20px;
        height: 20px;
        padding: 0 5px;
        white-space: nowrap;
        flex-shrink: 0;

        font-family: var(--ui-font-mono);
        font-size: 10px;
        font-weight: 500;
        color: var(--ui-subtle);

        background: var(--ui-panel-raised);
        border: 1px solid var(--ui-border);
        border-radius: 5px;
    }
</style>
