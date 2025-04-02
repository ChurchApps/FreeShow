<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { dictionary } from "../../../stores"

    export let value: string
    export let placeholder: string = ""
    export let disabled: boolean = false
    export let lines: number = 4
    // convert from old value
    value = value?.replaceAll("<br>", "\n")

    const TIME = 100
    let dispatch = createEventDispatcher()
    let timeout: NodeJS.Timeout | null = null

    function input() {
        if (timeout !== null) return
        timeout = setTimeout(() => {
            dispatch("edit", value)
            timeout = null
        }, TIME)
    }

    function change() {
        // timeout so textarea value can update on context paste
        setTimeout(() => {
            dispatch("change", value)
        })
    }
</script>

<div class="paper">
    <textarea placeholder={placeholder || $dictionary.empty?.text + "..."} class="edit {$$props.class}" name="" id="" cols="1" rows={lines} style={$$props.style || ""} bind:value on:input={input} on:change={change} {disabled} />
</div>

<style>
    .paper {
        /* background-color: white;
    color: black; */
        /* overflow-y: auto; */
        display: flex;
        flex: 1;
        height: 100%;
        overflow: hidden;
        /* box-shadow: inset 0 0 10px 0px rgb(0 0 0 / 30%); */

        border-radius: var(--border-radius);
    }

    .edit {
        height: 100%;
        width: 100%;
        padding: 10px;
        outline: none;
        border: none;
        color: inherit;
        font-size: inherit;
        font-family: inherit;
        background-color: inherit;
        resize: none;
    }

    textarea::placeholder {
        color: inherit;
        opacity: 0.5;
    }

    textarea:disabled {
        opacity: 0.5;
    }
</style>
