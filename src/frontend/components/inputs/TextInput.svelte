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
</script>

<!-- svelte-ignore a11y-autofocus -->
<input {id} {type} class="edit" {value} {placeholder} {style} class:center class:light {disabled} {autofocus} on:input on:change on:keydown />

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
