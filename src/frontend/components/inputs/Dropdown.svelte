<script lang="ts">
    import { slide } from "svelte/transition"
    import { createEventDispatcher } from "svelte"
    import { translate } from "../../utils/language"
    import { language } from "../../stores"
    import type { Option } from "../../../types/Main"
    import Icon from "../helpers/Icon.svelte"

    const dispatch = createEventDispatcher()
    export let options: Option[]
    export let disabled: boolean = false
    export let center: boolean = false
    export let arrow: boolean = false
    let active: boolean = false
    export let value: any
    export let title: string = ""
    let normalizedValue: any = value
    $: (normalizedValue = value || options[0]?.name || "—"), $language
    // TODO: disable active on click anywhere

    let self: HTMLDivElement

    let nextScrollTimeout: any = null
    function wheel(e: any) {
        if (disabled) return
        if (nextScrollTimeout) return

        e.preventDefault()
        let index = options.findIndex((a) => a.name === (value.name || value))
        if (e.deltaY > 0) index = Math.min(options.length - 1, index + 1)
        else index = Math.max(0, index - 1)
        dispatch("click", options[index])

        // don't start timeout if scrolling with mouse
        if (e.deltaY > 100 || e.deltaY < -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    // TODO: scroll don't work with multiple of the same name (e.g. EditTimer.svelte)

    $: if (active) scrollToActive()
    function scrollToActive() {
        let id = formatId(value)
        if (!id) return

        setTimeout(() => {
            let activeElem = self.querySelector("#" + id)
            activeElem?.scrollIntoView()
        }, 10)
    }

    function formatId(value: string) {
        return "id_" + value.replace(/[\W_]+/g, "")
    }
</script>

<svelte:window
    on:mousedown={(e) => {
        if (e.target?.closest(".dropdownElem") !== self && active) {
            active = false
        }
    }}
/>

<div class:disabled class:center bind:this={self} class="dropdownElem" style="position: relative;{$$props.style || ''}">
    <button {title} on:click={() => (disabled ? null : (active = !active))} on:wheel={wheel}>
        {#if arrow}
            <Icon id="expand" size={1.2} white />
        {:else}
            {translate(normalizedValue, { parts: true }) || value}
            <!-- <T id={value} /> -->
        {/if}
    </button>
    {#if active}
        <div class="dropdown" class:arrow style={$$props.style || ""} transition:slide={{ duration: 200 }}>
            {#each options as option}
                <!-- {#if option.name !== value} -->
                <span
                    id={formatId(option.name)}
                    on:click={() => {
                        if (disabled) return
                        dispatch("click", option)
                        active = false
                    }}
                    class:active={option.name === value}
                >
                    {translate(option.name, { parts: true }) || option.name}
                    {#if option.extra}
                        ({option.extra})
                    {/if}
                    <!-- <T id={option.name} /> -->
                </span>
                <!-- {/if} -->
            {/each}
        </div>
    {/if}
</div>

<style>
    div {
        /* width: fit-content;
    min-width: 200px; */
        background-color: var(--primary-darker);
        color: var(--text);
        /* position: relative; */
    }

    div.disabled {
        opacity: 0.5;
    }

    .dropdown {
        max-height: 300px;
        overflow: auto;
        /* position: absolute;
    width: 100%; */
        position: fixed;
        display: flex;
        flex-direction: column;
        border: 2px solid var(--primary-lighter);
        transform: translateY(-1px);
        /* transform: translateX(-25%); */
        z-index: 10;
    }

    .dropdown.arrow {
        right: 0;
        width: 300px;
    }

    .center button {
        text-align: center;
        justify-content: center;
    }

    .center .dropdown span {
        text-align: center;
    }

    button,
    span {
        display: table;
        width: 100%;
        padding: 8px 12px;
        background-color: transparent;
        font-family: inherit;
        /* text-transform: uppercase; */
        font-size: 1em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    button {
        /* width: 200px; */
        color: var(--text);
        border: 2px solid var(--primary-lighter);
        /* font-weight: bold; */
        text-align: left;

        display: flex;
        align-items: center;
    }

    button:hover:not(.disabled button),
    span:hover:not(.disabled span) {
        background-color: var(--hover);
    }
    span.active {
        background-color: var(--focus);
        color: var(--secondary);
    }
</style>
