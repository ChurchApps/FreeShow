<script lang="ts">
    export let id: string = ""
    export let type: string = "text"
    export let value: string
    export let placeholder: string = ""
    export let style: string = ""

    export let center: boolean = false
    export let light: boolean = false
    export let disabled: boolean = false
    export let autofocus: boolean = false
    export let autoselect: boolean = false

    function select(elem: any) {
        if (autoselect) elem.select()
    }
</script>

<!-- svelte-ignore a11y-autofocus -->
<input {id} {type} class="edit" {value} {placeholder} {style} class:center class:light {disabled} {autofocus} use:select on:input on:change on:keydown />

<style>
    input {
        background-color: var(--primary-darker);
        color: var(--text);
        width: 100%;
        font-family: inherit;
        font-size: inherit;
        font-weight: inherit;
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        padding: 8px 12px;
        outline-offset: -2px;
        transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            background-color 0.2s ease;
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
        border-color: color-mix(in oklab, var(--primary-lighter) 60%, var(--secondary));
        background-color: var(--hover);
    }
    input:focus {
        border-color: var(--secondary);
        box-shadow: 0 0 0 3px var(--secondary-opacity);
        background-color: var(--primary-darker);
    }
</style>
