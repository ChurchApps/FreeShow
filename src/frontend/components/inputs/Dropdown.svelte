<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { slide } from "svelte/transition"
    import type { Option } from "../../../types/Main"
    import { language } from "../../stores"
    import { triggerClickOnEnterSpace } from "../../utils/clickable"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"

    const dispatch = createEventDispatcher()
    export let options: Option[]
    export let id = ""
    export let disabled = false
    export let center = false
    export let arrow = false
    let active = false
    export let value: string
    export let activeId = ""
    export let title = ""
    export let flags = false
    export let up = false
    let normalizedValue: any = value
    $: (normalizedValue = value || options[0]?.name || "—"), $language

    let self: HTMLDivElement

    let nextScrollTimeout: NodeJS.Timeout | null = null
    function wheel(e: any) {
        const ctrl = e.ctrlKey || e.metaKey
        if (disabled || arrow || nextScrollTimeout || !ctrl) return
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
    <button style={arrow ? "justify-content: center;" : ""} {id} data-title={title} on:click={() => (disabled ? null : (active = !active))} on:wheel={wheel}>
        {#if arrow}
            <Icon id="expand" size={1.2} white />
        {:else}
            {translateText(normalizedValue) || value}
        {/if}
    </button>
    {#if active}
        <div class="dropdown" class:up class:arrow style={$$props.style || ""} transition:slide={{ duration: 200 }}>
            {#each options as option}
                <span
                    id={formatId(option.name)}
                    style={option.style || ""}
                    role="option"
                    aria-selected={activeId ? option.id === activeId : option.name === value}
                    tabindex="0"
                    on:click={() => {
                        if (disabled) return
                        active = false
                        // allow dropdown to close before updating, so svelte visual bug don't duplicate inputs on close transition in boxstyle edit etc.
                        setTimeout(() => {
                            dispatch("click", option)
                        }, 50)
                    }}
                    on:keydown={triggerClickOnEnterSpace}
                    class:active={activeId && option?.id ? option.id === activeId : option.name === value}
                >
                    {translateText(option.name) || option.name}
                    {#if option.extra}
                        ({option.extra})
                    {/if}

                    {#if option.extraInfo}
                        <div class="extra">
                            {option.extraInfo}
                        </div>
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
        inset-inline-start: 0;
        position: absolute;
        transform: translateY(-100%);
    }

    .dropdown.arrow {
        inset-inline-end: 0;
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

        position: relative;
    }

    button {
        /* width: 200px; */
        color: var(--text);
        border: 2px solid var(--primary-lighter);
        /* font-weight: bold; */
        text-align: start;

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

    .dropdown .extra {
        position: absolute;
        right: 0;
        top: 50%;
        transform: translateY(-50%);

        display: flex;
        justify-content: end;
        align-items: center;
        padding: 0 10px;

        font-size: 0.8em;
        background-color: transparent;
        opacity: 0.5;

        pointer-events: none;
    }
</style>
