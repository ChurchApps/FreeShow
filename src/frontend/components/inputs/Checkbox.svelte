<label class="switch" class:disabled={$$props.disabled}>
    <input id={$$props.id} type="checkbox" style={$$props.style} checked={$$props.checked || false} disabled={$$props.disabled} on:change />
    <div class:on={$$props.checked || false} />
</label>

<style>
    .switch input {
        position: absolute;
        opacity: 0;
    }

    .switch {
        display: inline-block;
        min-width: 2em;
        width: 2em;
        height: 1em;
        font-size: 22px;
        background-color: var(--primary-lighter);
        border-radius: var(--border-radius);
    }

    .switch.disabled {
        opacity: 0.3;
    }
    .switch:not(.disabled) {
        cursor: pointer;
    }
    .switch:hover:not(.disabled) {
        background-color: var(--hover);
    }
    .switch:focus:not(.disabled),
    .switch:active:not(.disabled) {
        background-color: var(--focus);
    }

    .switch div {
        width: 1em;
        height: 1em;
        background-color: var(--text);
        border-radius: var(--border-radius);
        transition: all 300ms;
    }
    .switch div.on {
        background-color: var(--secondary);
    }

    .switch input:checked + div {
        transform: translate3d(100%, 0, 0);
    }
    /* There's an open draft for logical css transform https://github.com/w3c/csswg-drafts/issues/1544
     * After that is implemented, this can be removed.
     */
    [dir="rtl"] .switch input:checked + div {
        transform: translate3d(-100%, 0, 0);
    }
</style>
