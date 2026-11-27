<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { dictionary } from "../../../stores"
    import { translateText } from "../../../utils/language"

    export let variant: "primary" | "secondary" | "ghost" | "outline" | "danger" = "secondary"
    export let size: "sm" | "md" | "icon" = "md"
    export let title = ""
    export let disabled = false
    export let active = false
    export let full = false

    const dispatch = createEventDispatcher()

    function click(e: MouseEvent) {
        if (disabled) return
        dispatch("click", e)
    }
</script>

<button type="button" class="ui-button {variant} {size} {$$props.class || ''}" class:active class:full {disabled} data-title={translateText(title, $dictionary)} on:click={click}>
    <slot />
</button>

<style>
    .ui-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;

        height: 34px;
        padding: 0 13px;

        font-family: inherit;
        font-size: 13px;
        font-weight: 500;
        line-height: 1;
        letter-spacing: 0.01em;
        white-space: nowrap;

        color: var(--ui-text);
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--ui-radius-sm);

        cursor: pointer;
        user-select: none;

        transition:
            background-color 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease,
            box-shadow 0.15s ease,
            transform 0.06s ease;
    }

    .ui-button.sm {
        height: 28px;
        padding: 0 9px;
        gap: 5px;
        font-size: 12px;
    }

    .ui-button.icon {
        width: 34px;
        min-width: 34px;
        padding: 0;
    }

    .ui-button.full {
        width: 100%;
    }

    .ui-button:disabled {
        opacity: 0.4;
        pointer-events: none;
    }

    .ui-button:active:not(:disabled) {
        transform: translateY(0.5px);
    }

    .ui-button:focus-visible {
        outline: none;
        box-shadow:
            0 0 0 2px var(--ui-panel),
            0 0 0 4px var(--ui-accent-border);
    }

    /* variants */

    .ui-button.primary {
        color: var(--secondary-text);
        background: var(--ui-accent);
        box-shadow: var(--ui-shadow-sm);
    }
    .ui-button.primary:hover:not(:disabled) {
        filter: brightness(1.08);
    }

    .ui-button.secondary {
        background: var(--ui-panel-raised);
        border-color: var(--ui-border);
    }
    .ui-button.secondary:hover:not(:disabled) {
        background: color-mix(in srgb, var(--ui-text) 10%, var(--ui-panel-raised));
        border-color: var(--ui-border-strong);
    }

    .ui-button.outline {
        border-color: var(--ui-border-strong);
    }
    .ui-button.outline:hover:not(:disabled) {
        background: var(--ui-hover);
    }

    .ui-button.ghost:hover:not(:disabled) {
        background: var(--ui-hover);
    }

    .ui-button.danger {
        color: #fff;
        background: #d92d4b;
        box-shadow: var(--ui-shadow-sm);
    }
    .ui-button.danger:hover:not(:disabled) {
        filter: brightness(1.08);
    }

    .ui-button.active {
        background: var(--ui-accent-soft);
        border-color: var(--ui-accent-border);
        color: var(--ui-text);
    }

    .ui-button :global(svg) {
        flex-shrink: 0;
    }
</style>
