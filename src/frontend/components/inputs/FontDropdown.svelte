<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import { slide } from "svelte/transition"
    import { MAIN } from "../../../types/Channels"
    import { systemFonts } from "../../stores"
    import { awaitRequest } from "../../utils/request"
    import { formatSearch } from "../../utils/search"
    import { removeDuplicates } from "../helpers/array"

    export let system: boolean = false

    const dispatch = createEventDispatcher()

    let fonts: string[] = [
        "CMGSans",
        "Fantasy",
        "Helvetica",
        // "Monaco",
        "Monospace",
        // "sans-serif",
    ]

    onMount(async () => {
        if ($systemFonts.length) addFonts($systemFonts)
        else {
            let fonts: string[] = (await awaitRequest(MAIN, "GET_SYSTEM_FONTS"))?.fonts
            if (!fonts) return

            systemFonts.set(fonts)
            addFonts(fonts)
        }
    })

    function addFonts(newFonts: string[]) {
        // join and remove duplicates
        fonts = removeDuplicates([...fonts, ...newFonts])
        // sort
        fonts = fonts.sort((a, b) => a.localeCompare(b))
        // add default app font
        if (system) fonts = ["", ...fonts]
    }

    export let value: string
    let active: boolean = false
    let self: HTMLDivElement

    let nextScrollTimeout: any = null
    function wheel(e: any) {
        if (nextScrollTimeout) return

        e.preventDefault()
        let index = fonts.findIndex((a) => a === value)
        if (e.deltaY > 0) index = Math.min(fonts.length - 1, index + 1)
        else index = Math.max(0, index - 1)
        dispatch("click", fonts[index])

        // don't start timeout if scrolling with mouse
        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    $: if (active) scrollToActive(value)
    function scrollToActive(value: string) {
        let id = formatId(value)
        if (!id) return

        setTimeout(() => {
            let activeElem = self.querySelector("#" + id)
            activeElem?.scrollIntoView()
        }, 10)
    }

    function formatId(value: string) {
        return value.replace(/[\W_]+/g, "")
    }

    let searchValue: string = ""
    $: if (active) searchValue = ""
    // "invisible" search
    function keydown(e: any) {
        if (!active) return

        if (e.key === "Backspace") {
            searchValue = ""
            scrollToActive(value)
        } else {
            searchValue = formatSearch(searchValue + e.key, true)

            // scroll to first match
            let firstMatch = fonts.find((a) => formatSearch(a, true).slice(0, searchValue.length).includes(searchValue))
            if (!firstMatch) firstMatch = fonts.find((a) => formatSearch(a, true).includes(searchValue))
            if (firstMatch) scrollToActive(firstMatch)
        }
    }
</script>

<svelte:window
    on:mousedown={(e) => {
        if (e.target?.closest(".dropdownElem") !== self && active) {
            active = false
        }
    }}
    on:keydown={keydown}
/>

<div bind:this={self} class="dropdownElem" title={value || ""} style={$$props.style || ""}>
    <button style="font-family: {value};" on:click={() => (active = !active)} on:wheel={wheel}>
        <p>{value || "—"}</p>
    </button>
    {#if active}
        <div class="dropdown" transition:slide={{ duration: 200 }}>
            {#each fonts as font}
                <span
                    id={formatId(font)}
                    on:click={() => {
                        active = false
                        // allow dropdown to close before updating, so svelte visual bug don't duplicate inputs on close transition in boxstyle edit etc.
                        setTimeout(() => {
                            dispatch("click", font)
                        }, 50)
                    }}
                    class:active={font === value}
                    style="font-family: {font};"
                >
                    <p>{font || "—"}</p>
                </span>
            {/each}
        </div>
    {/if}
</div>

<style>
    .dropdownElem {
        position: relative;
        /* display: grid; */
    }

    div {
        background-color: var(--primary-darker);
        color: var(--text);
    }

    .dropdown {
        max-height: 300px;
        overflow-y: auto;
        overflow-x: hidden;
        /* position: absolute;
    width: 100%; */
        position: fixed;
        display: flex;
        flex-direction: column;
        border: 2px solid var(--primary-lighter);
        transform: translateY(-1px);
        z-index: 10;
    }

    button {
        color: var(--text);
        border: 2px solid var(--primary-lighter);
        text-align: left;
    }

    button,
    span {
        display: table;
        width: 100%;
        /* padding: 8px 12px; */
        background-color: transparent;
        font-family: inherit;
        font-size: 1em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    span {
        display: flex;
        overflow-x: hidden;
        padding: 12px 10px;
    }
    span p,
    button p {
        opacity: 1;
        height: 20px;
        align-self: center;
    }

    button:hover,
    span:hover {
        background-color: var(--hover);
    }
    span.active {
        background-color: var(--focus);
        color: var(--secondary);
    }
</style>
