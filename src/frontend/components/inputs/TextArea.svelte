<script lang="ts">
    export let value: string
    export let placeholder: string = ""
    export let style: string = ""

    export let center: boolean = false
    export let disabled: boolean = false
    export let autofocus: boolean = false
</script>

<textarea class="edit" {placeholder} {value} {style} class:center {disabled} {autofocus} on:input />

<style>
    textarea {
        background-color: var(--primary-darker);
        border-radius: var(--border-radius);
        color: var(--text);
        height: 100%;
        width: 100%;
        font-family: inherit;
        font-size: inherit;
        font-weight: inherit;
        border: 0;
        padding: 10px;
        outline-offset: -2px;
        resize: none;
    }
    textarea.center {
        text-align: center;
    }
    textarea:hover:not(:disabled) {
        background-color: var(--hover);
    }

    textarea::placeholder {
        color: var(--text);
        opacity: 0.3;
    }
</style>
