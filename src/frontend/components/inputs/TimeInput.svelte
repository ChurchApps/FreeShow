<script lang="ts">
    export let value
    export let title: string = ""
    export let style: string = ""
    export let disabled: boolean = false
</script>

<input {value} {style} {disabled} type="time" {title} on:change />

<style>
    input[type="time"] {
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
