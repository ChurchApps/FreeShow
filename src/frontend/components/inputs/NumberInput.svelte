<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte"
    import Icon from "../helpers/Icon.svelte"
    import Button from "./Button.svelte"
    import TextInput from "./TextInput.svelte"

    export let value: number
    export let title = ""
    export let visibleTitle = false
    export let style = ""
    export let inputMultiplier = 1
    export let decimals = 0
    export let step = 1
    export let min = 0
    export let max = 1000
    export let fixed = 0
    export let outline = false
    export let buttons = true
    export let disabled = false
    export let disableHold = false

    const dispatch = createEventDispatcher()
    const increment = (customStep: number = step) => dispatch("change", Math.min(Number(value) + customStep, max).toFixed(decimals))
    const decrement = (customStep: number = step) => dispatch("change", Math.max(Number(value) - customStep, min).toFixed(decimals))

    const input = (e: any) => {
        let inputValue = e.target.value || 0
        try {
            inputValue = new Function(`return ${inputValue}`)() // calculate without eval()
        } catch (err) {
            inputValue = value
        }

        let newVaule = Math.max(Math.min(inputValue, max * inputMultiplier), min * inputMultiplier) / inputMultiplier
        dispatch("change", newVaule !== null ? newVaule.toFixed(decimals) : value)
    }

    let timeout: NodeJS.Timeout | null = null
    let interval: NodeJS.Timeout | null = null
    function mousedown(e: any) {
        if (disableHold || !e.target.closest("button")) return

        // auto change when holding value
        // slow updates in edit caused this to create infinite loops (value didn't update)
        timeout = setTimeout(() => {
            if (!timeout) return

            let increase = true
            if (e.target.closest("button").id === "decrement") increase = false

            let loopPrevention = 0
            interval = setInterval(() => {
                // stop after 50 updates
                if (loopPrevention > 50) return
                loopPrevention++

                if (increase) increment()
                else decrement()
            }, 100)

            timeout = null
        }, 500)
    }

    onDestroy(() => {
        if (interval) clearInterval(interval)
    })

    let nextScrollTimeout: NodeJS.Timeout | null = null
    function wheel(e: any) {
        if (disabled || nextScrollTimeout) return
        if (!e.ctrlKey && !e.metaKey) return
        e.preventDefault()

        let stepAmount = step * (e.shiftKey ? 10 : 1)

        if (e.deltaY > 0) decrement(stepAmount)
        else increment(stepAmount)

        // don't start timeout if scrolling with mouse
        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }
</script>

<svelte:window
    on:mouseup={() => {
        if (timeout) clearTimeout(timeout)
        if (interval) clearInterval(interval)
        timeout = null
        interval = null
    }}
/>

<span class="numberInput" {style} on:mousedown={mousedown} on:wheel={wheel} class:disabled class:outline>
    {#if buttons}
        <Button id="decrement" on:click={(e) => decrement(e.ctrlKey || e.metaKey ? step * 10 : step)} center style={"flex: 1;"} disabled={disabled || Number(value) <= min}>
            <Icon id="remove" size={1.2} white />
        </Button>
    {/if}

    <span class="input" data-title={title}>
        <TextInput {disabled} value={(value * inputMultiplier).toFixed(fixed)} on:change={input} center />

        {#if visibleTitle}
            <div class="title">
                {title}
            </div>
        {/if}
    </span>

    {#if buttons}
        <Button id="increment" on:click={(e) => increment(e.ctrlKey || e.metaKey ? step * 10 : step)} center style={"flex: 1;"} disabled={disabled || Number(value) >= max}>
            <Icon id="add" size={1.2} white />
        </Button>
    {/if}
</span>

<style>
    .numberInput {
        display: flex;
        /* align-items: center; */
        background-color: var(--primary-darkest);
        border-radius: 4px;
        flex-flow: wrap;
        transition: opacity 0.3s;
    }

    .numberInput.outline,
    .outline :global(input) {
        /* border: 2px solid var(--primary-lighter); */
        background-color: var(--primary);
    }

    .disabled {
        opacity: 0.5;
    }

    .input {
        flex: 2;
        height: 100%;
        /* font-size: 1.5em; */
        /* font-weight: bold; */

        position: relative;
    }

    .input :global(input) {
        padding: 5px;
        background-color: var(--primary-darkest);
        border-radius: 4px;
    }

    .title {
        position: absolute;
        bottom: -20px;
        left: 50%;
        transform: translateX(-50%);

        font-size: 0.18em;

        pointer-events: none;
    }
</style>
