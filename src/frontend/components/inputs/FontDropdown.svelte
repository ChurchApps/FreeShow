<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import { slide } from "svelte/transition"
    import { dictionary } from "../../stores"
    import { triggerClickOnEnterSpace } from "../../utils/clickable"
    import { formatSearch } from "../../utils/search"
    import { Family, getFontsList } from "../helpers/fonts"
    import Dropdown from "./Dropdown.svelte"

    export let value: string
    export let fontStyleValue = ""
    export let system = false

    $: value = value ? value.replaceAll("'", "") : ""

    // web fonts
    const defaultFonts = ["CMGSans", "Arial", "Verdana", "Tahoma", "Trebuchet MS", "Times New Roman", "Georgia", "Garamond", "Courier New", "Brush Script MT", "Helvetica", "Fantasy", "monospace"]
    // does not work with ''
    const noQuotes = ["Fantasy", "monospace"]

    function getFontName(value: string) {
        if (!value) return ""
        if (noQuotes.includes(value)) return value
        return `'${value}'`
    }

    let fonts: Family[] = []

    const dispatch = createEventDispatcher()
    function setFont(family: string) {
        dispatch("click", getFontName(family))
    }

    onMount(() => {
        // { family: "CMGSans", default: 0, fonts: [{ name: "CMGSans", path: "", style: "", css: "font: 1em 'CMGSans'" }] }
        fonts = defaultFonts.map((name) => {
            const css = `font: 1em ${getFontName(name)}`
            return { family: name, default: 0, fonts: [{ name, path: "", style: "", css }] }
        })

        loadSystemFonts()
    })

    async function loadSystemFonts() {
        let loadedFonts = await getFontsList()
        if (!loadedFonts.length) return

        addFonts(loadedFonts)
    }

    function addFonts(newFonts: Family[]) {
        // join and remove duplicates
        fonts = fonts.filter((font1) => !newFonts.find((font2) => font2.family === font1.family))
        fonts = [...newFonts, ...fonts]
        // sort
        fonts = fonts.sort((a, b) => a.family.localeCompare(b.family))
        // add default app font
        if (system) {
            const noFont = { family: "", default: 0, fonts: [{ name: "", path: "", style: "", css: "" }] }
            fonts = [noFont, ...fonts]
        }
    }

    let active = false
    let self: HTMLDivElement

    let nextScrollTimeout: NodeJS.Timeout | null = null
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
        if (!value) return

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

    let searchValue = ""
    $: if (active) searchValue = ""
    // "invisible" search
    function keydown(e: KeyboardEvent) {
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

    $: fontStyles = activeFont?.fonts || []
    $: fontDataOptions = fontStyles.map((a) => ({
        name: a.style,
        // id: a.name,
        style: a.css,
        data: a.css
            ?.replace(/^font:\s*(.*);$/, "$1")
            .replace("1em", "100px")
            .trim()
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
    <button style={activeFont?.fonts[activeFont.default]?.css || `font-family: ${typeof activeFont === "string" ? activeFont : activeFont?.fonts[0]?.name};`} on:click={() => (active = !active)} on:wheel={wheel}>
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
                    role="option"
                    aria-selected={font.family === value}
                    tabindex="0"
                    on:click={() => {
                        active = false
                        // allow dropdown to close before updating, so svelte visual bug don't duplicate inputs on close transition in boxstyle edit etc.
                        setTimeout(() => {
                            setFont(font.family)
                        }, 50)
                    }}
                    on:keydown={triggerClickOnEnterSpace}
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

        width: 180%;
        inset-inline-end: 0;
    }
    .dropdownElem :global(.dropdownElem .dropdown.arrow) {
        /* this is currently relative to 40px anyway */
        width: 520% !important;
    }

    button {
        color: var(--text);
        border: 2px solid var(--primary-lighter);
        text-align: start;
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
