<script lang="ts">
    export let id = ""
    export let type = "text"
    export let value: string
    export let placeholder = ""
    export let style = ""

    export let center = false
    export let light = false
    export let disabled = false
    export let autofocus = false
    export let autoselect = false

    function select(elem) {
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
