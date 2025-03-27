<script lang="ts">
    import { slide } from "svelte/transition"
    import { createEventDispatcher } from "svelte"
    import { translate } from "../../utils/language"
    import { language } from "../../stores"
    import type { Option } from "../../../types/Main"
    import Icon from "../helpers/Icon.svelte"

    const dispatch = createEventDispatcher()
    export let options: Option[]
    export let id: string = ""
    export let disabled: boolean = false
    export let center: boolean = false
    export let arrow: boolean = false
    let active: boolean = false
    export let value: string
    export let activeId: string = ""
    export let title: string = ""
    export let flags: boolean = false
    export let up: boolean = false
    let normalizedValue: any = value
    $: (normalizedValue = value || options[0]?.name || "—"), $language

    let self: HTMLDivElement

    let nextScrollTimeout: NodeJS.Timeout | null = null
    function wheel(e: any) {
        if (disabled || arrow || nextScrollTimeout) return
        e.preventDefault()

        let index = options.findIndex((a) => (activeId ? a.id === activeId : a.name === value))
        if (e.deltaY > 0) index = Math.min(options.length - 1, index + 1)
        else index = Math.max(0, index - 1)
        dispatch("click", options[index])

        // don't start timeout if scrolling with mouse
        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    $: if (active) scrollToActive()
    function scrollToActive() {
        let id = formatId(value)
        if (!id) return

        setTimeout(() => {
            // dropdown does not have a scroll bar if not much content, return so parent is not scrolled!
            if (!self || options.length < 10) return
            let activeElem = self.querySelector("#" + id)
            activeElem?.scrollIntoView()
        }, 10)
    }

    function formatId(value: string) {
        return "id_" + value?.replace(/[\W_]+/g, "")
    }

    function mousedown(e: any) {
        if (e.target?.closest(".dropdownElem") !== self && active) {
            active = false
        }
    }
</script>

<svelte:window on:mousedown={mousedown} />

<div class:disabled class:center class:flags bind:this={self} class="dropdownElem {$$props.class || ''}" style="position: relative;{$$props.style || ''}">
    <button style={arrow ? "justify-content: center;" : ""} {id} {title} on:click={() => (disabled ? null : (active = !active))} on:wheel={wheel}>
        {#if arrow}
            <Icon id="expand" size={1.2} white />
        {:else}
            {translate(normalizedValue, { parts: true }) || value}
        {/if}
    </button>
    {#if active}
        <div class="dropdown" class:up class:arrow style={$$props.style || ""} transition:slide={{ duration: 200 }}>
            {#each options as option}
                <span
                    id={formatId(option.name)}
                    style={option.style || ""}
                    on:click={() => {
                        if (disabled) return
                        active = false
                        // allow dropdown to close before updating, so svelte visual bug don't duplicate inputs on close transition in boxstyle edit etc.
                        setTimeout(() => {
                            dispatch("click", option)
                        }, 50)
                    }}
                    class:active={activeId && option?.id ? option.id === activeId : option.name === value}
                >
                    {translate(option.name, { parts: true }) || option.name}
                    {#if option.extra}
                        ({option.extra})
                    {/if}
                </span>
            {/each}
        </div>
    {/if}
</div>

<style>
    .dropdownElem.flags {
        font-family:
            "NotoColorEmojiLimited",
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            Oxygen-Sans,
            Ubuntu,
            Cantarell,
            "Helvetica Neue",
            sans-serif !important;
    }

    div {
        /* width: fit-content;
    min-width: 200px; */
        background-color: var(--primary-darker);
        color: var(--text);
        /* position: relative; */
        border-radius: var(--border-radius);
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

    .dropdown.up {
        top: 0;
        left: 0;
        position: absolute;
        transform: translateY(-100%);
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
        border-radius: var(--border-radius);
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
