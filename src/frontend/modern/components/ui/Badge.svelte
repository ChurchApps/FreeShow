<script lang="ts">
    export let variant: "default" | "accent" | "live" | "success" | "muted" = "default"
</script>

<span class="badge {variant} {$$props.class || ''}">
    <slot />
</span>

<style>
    .badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;

        height: 20px;
        padding: 0 7px;

        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        white-space: nowrap;

        color: var(--ui-muted);
        background: var(--ui-hover);
        border: 1px solid var(--ui-border);
        border-radius: 999px;
    }

    .badge.accent {
        color: var(--ui-accent);
        background: var(--ui-accent-soft);
        border-color: var(--ui-accent-border);
    }

    .badge.success {
        color: #4ade80;
        background: rgb(34 197 94 / 0.14);
        border-color: rgb(34 197 94 / 0.3);
    }

    .badge.live {
        color: #fff;
        background: #d92d4b;
        border-color: transparent;
    }

    .badge.muted {
        background: transparent;
    }
</style>
