<!-- svelte-ignore a11y-autofocus -->
<input
    type={$$props.type || "text"}
    class="edit"
    value={$$props.value}
    placeholder={$$props.placeholder}
    style={$$props.style}
    class:center={$$props.center}
    class:light={$$props.light}
    disabled={$$props.disabled}
    autofocus={$$props.autofocus}
    on:input
    on:change
    on:keydown
/>

<style>
    input {
        background-color: var(--primary-darker);
        color: var(--text);
        width: 100%;
        font-family: inherit;
        font-size: inherit;
        font-weight: inherit;
        border: 0;
        padding: 5px 10px;
        outline-offset: -2px;
    }
    input::placeholder {
        color: var(--text);
        opacity: 0.5;
    }
    input:disabled {
        opacity: 0.5;
    }
    input.center {
        text-align: center;
    }
    input.light {
        background-color: var(--primary);
    }
    input:hover:not(:disabled) {
        background-color: var(--hover);
    }
</style>
