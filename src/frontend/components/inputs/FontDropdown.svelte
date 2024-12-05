<script lang="ts">
    import type { Family } from "css-fonts"
    import { createEventDispatcher, onMount } from "svelte"
    import { slide } from "svelte/transition"
    import { MAIN } from "../../../types/Channels"
    import { dictionary, systemFonts } from "../../stores"
    import { awaitRequest } from "../../utils/request"
    import { formatSearch } from "../../utils/search"
    import { removeDuplicates } from "../helpers/array"
    import Dropdown from "./Dropdown.svelte"

    export let value: string
    export let fontStyleValue: string = ""
    export let system: boolean = false

    $: value = value.replaceAll("'", "")

    let fonts: Family[] = [
        { family: "CMGSans", default: 0, fonts: [{ name: "CMGSans", path: "", style: "", css: "font: 1em 'CMGSans'" }] },
        // {family: "Arial"},
        // "Helvetica",
        // "Fantasy",
        // "Monospace",
    ]

    const dispatch = createEventDispatcher()
    function setFont(family: string) {
        dispatch("click", family ? "'" + family + "'" : "")
    }

    onMount(() => {
        if ($systemFonts.length) addFonts($systemFonts)
        else loadSystemFonts()
    })
    async function loadSystemFonts() {
        let fonts: Family[] = (await awaitRequest(MAIN, "GET_SYSTEM_FONTS"))?.fonts
        if (!fonts) return

        systemFonts.set(fonts)
        addFonts(fonts)
    }

    function addFonts(newFonts: Family[]) {
        // join and remove duplicates
        fonts = removeDuplicates([...fonts, ...newFonts])
        // sort
        fonts = fonts.sort((a, b) => a.family.localeCompare(b.family))
        // add default app font
        if (system) {
            const noFont = { family: "", default: 0, fonts: [{ name: "", path: "", style: "", css: "" }] }
            fonts = [noFont, ...fonts]
        }
    }

    let active: boolean = false
    let self: HTMLDivElement

    let nextScrollTimeout: any = null
    function wheel(e: any) {
        if (nextScrollTimeout) return

        e.preventDefault()
        let index = fonts.findIndex((a) => a.family === value)
        if (e.deltaY > 0) index = Math.min(fonts.length - 1, index + 1)
        else index = Math.max(0, index - 1)
        setFont(fonts[index].family)

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
            let firstMatch = fonts.find((a) => formatSearch(a.family, true).slice(0, searchValue.length).includes(searchValue))
            if (!firstMatch) firstMatch = fonts.find((a) => formatSearch(a.family, true).includes(searchValue))
            if (firstMatch) scrollToActive(firstMatch.family)
        }
    }

    let activeFont: Family | null = null
    $: activeFont = fonts.find((a) => a.family === value) || null

    // FONT STYLE

    // remove styles that can already be changed
    // "Regular"
    const commonStyles = ["Bold", "Italic", "Bold Italic"]

    $: fontStyles = (activeFont?.fonts || []).filter((a) => !commonStyles.includes(a.style))
    $: fontDataOptions = fontStyles.map((a) => ({
        name: a.style,
        // id: a.name,
        style: a.css,
        data: a.css
            ?.replace(/^font:\s*(.*);$/, "$1")
            .replace("1em", "100px")
            .trim(),
    }))
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
    <button style={activeFont?.fonts[activeFont.default]?.css || `font-family: ${activeFont};`} on:click={() => (active = !active)} on:wheel={wheel}>
        <p>{value || "—"}</p>
    </button>

    <!-- FONT STYLE -->
    {#if !system && fontStyles.length > 1}
        <Dropdown
            arrow
            value={fontDataOptions.find((a, i) => (fontStyleValue ? a.data === fontStyleValue : i === fonts.find((a) => a.family === value)?.default))?.name || ""}
            style="min-width: 40px !important;"
            options={fontDataOptions}
            title={$dictionary.settings?.font_style}
            on:click={(e) => {
                dispatch("fontStyle", e.detail?.data)
            }}
        />
    {/if}

    {#if active}
        <div class="dropdown" transition:slide={{ duration: 200 }}>
            {#each fonts as font}
                <span
                    id={formatId(font.family)}
                    on:click={() => {
                        active = false
                        // allow dropdown to close before updating, so svelte visual bug don't duplicate inputs on close transition in boxstyle edit etc.
                        setTimeout(() => {
                            setFont(font.family)
                        }, 50)
                    }}
                    class:active={font.family === value}
                    style={font.fonts[font.default]?.css || `font-family: ${font.family};`}
                >
                    <p>{font.family || "—"}</p>
                </span>
            {/each}
        </div>
    {/if}
</div>

<style>
    .dropdownElem {
        position: relative;
        /* display: grid; */

        display: flex;
    }

    .dropdownElem :global(.arrow) {
        width: 130px !important;
        text-transform: capitalize;
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
