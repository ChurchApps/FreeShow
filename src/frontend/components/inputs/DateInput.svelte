<script lang="ts">
    export let value
    export let title = ""
    export let style = ""
    export let disabled = false
</script>

<input {value} {style} {disabled} type="date" {title} on:change />

<style>
    input[type="date"] {
        background-color: var(--primary-darker);
        color: inherit;
        /* width: 100%; */
        font-size: inherit;
        font-family: inherit;
        border: 0;
        padding: 5px;

        transition: opacity 0.2s;
    }

    input:disabled {
        opacity: 0.5;
    }

    input::-webkit-calendar-picker-indicator {
        cursor: pointer;
        opacity: 0.8;
        filter: invert(1);
    }
    input::-webkit-calendar-picker-indicator:hover {
        background-color: rgb(0 0 0 / 0.1);
    }
</style>
