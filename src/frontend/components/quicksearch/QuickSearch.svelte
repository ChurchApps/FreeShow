<!-- Quickly find shows/elements globally in the program -->

<script lang="ts">
    import { fade, fly } from "svelte/transition"
    import { quickSearchActive, special, theme, themes } from "../../stores"
    import { translateText } from "../../utils/language"
    import { hexToRgb } from "../helpers/color"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import TextInput from "../inputs/TextInput.svelte"
    import Center from "../system/Center.svelte"
    import { quicksearch, quickSearchCategoryNames, selectQuicksearchValue, type SearchCategory } from "./quicksearch"
    import { getNormalizedKey } from "../../utils/shortcuts"

    let values: any[] = []
    let searchValue = ""
    let activeCategory: SearchCategory | null = null
    let actualSearchText = ""

    let searchId = 0
    async function search(e: any) {
        const inputValue = e.target.value

        let value = inputValue

        // choose specific categories with colon or space syntax
        // SearchCategory ids with a few excluded, including singular forms
        let categoryMatch = value.match(/^(settings?|stage|overlays?|projects?|actions?|faq|shows?|media|audio|bible)[:| ]\s*/i)
        if (categoryMatch) {
            let matchedCategory = categoryMatch[1].toLowerCase()

            // add 's' to singular forms that should be plural
            if (!matchedCategory.endsWith("s") && !["stage", "faq", "media", "audio", "bible"].includes(matchedCategory)) matchedCategory += "s"

            activeCategory = matchedCategory as SearchCategory
            value = value.replace(categoryMatch[0], "").trim()
            actualSearchText = value
            searchValue = inputValue
        } else if (activeCategory) {
            actualSearchText = inputValue
            value = inputValue
        } else {
            activeCategory = null
            actualSearchText = inputValue
            searchValue = inputValue
        }

        if (!value) {
            values = []
            return
        }

        const currentId = ++searchId
        const results = await quicksearch(value, activeCategory)
        if (currentId !== searchId) return

        values = results
        selectedIndex = 0
    }

    function openCategory(category: SearchCategory) {
        if (activeCategory) return
        activeCategory = category
        search({ target: { value: actualSearchText } })
    }

    function removeCategoryTag() {
        activeCategory = null
        searchValue = actualSearchText
        search({ target: { value: actualSearchText } })
    }

    let selectedIndex = 0

    function keydown(e: KeyboardEvent) {
        // CTRL + G or F8
        let key = getNormalizedKey(e)
        if (((e.ctrlKey || e.metaKey) && key === "g") || e.key === "F8") {
            // toggle quick search
            quickSearchActive.set(!$quickSearchActive)
            return
        }

        if (!$quickSearchActive) return

        if (e.key === "Enter" && values.length) {
            selectQuicksearchValue(values[selectedIndex], e.ctrlKey || e.metaKey)
            selectedIndex = 0
        } else if (e.key === "ArrowDown" && values.length) {
            e.preventDefault()
            selectedIndex = Math.min(values.length - 1, selectedIndex + 1)
        } else if (e.key === "ArrowUp" && values.length) {
            e.preventDefault()
            selectedIndex = Math.max(0, selectedIndex - 1)
        } else if (e.key === "Backspace" && activeCategory && (!actualSearchText.trim() || (e.target === document.querySelector(".quicksearch input") && (e.target as any)?.selectionStart === 0 && (e.target as any)?.selectionEnd === 0))) {
            // remove category tag when backspacing on empty search or at the beginning of input
            removeCategoryTag()
            e.preventDefault()
        }
    }

    // let light = false
    // $: if ($theme) light = !isDarkTheme()

    let rgb = { r: 35, g: 35, b: 45 }
    $: if ($theme) updateColor()
    function updateColor() {
        const color = $themes[$theme]?.colors["primary"]
        if (!color) return

        const newRgb = hexToRgb(color)
        rgb = { r: Math.max(0, newRgb.r - 1), g: Math.max(0, newRgb.g - 5), b: Math.max(0, newRgb.b - 5) }
    }

    $: isOptimized = $special.optimizedMode

    // auto-scroll to selected item
    $: if (values.length && selectedIndex >= 0) {
        const selectedEl = document.getElementById(`qs-item-${selectedIndex}`)
        if (selectedEl) selectedEl.scrollIntoView({ block: "nearest" })
    }

    // highlight matching text
    function highlightMatch(text: string, search: string): string {
        if (!search || !text) return text

        // Strict phrase match first (highest priority highlight)
        const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        const strictRegex = new RegExp(`(${escapedSearch})`, "gi")
        if (strictRegex.test(text)) {
            return text.replace(strictRegex, "<mark>$1</mark>")
        }

        // Token match: highlight individual words
        const words = search.split(/\s+/).filter((w) => w.length >= 1)
        if (words.length > 0) {
            // Sort by length descending to match longer words first
            words.sort((a, b) => b.length - a.length)
            const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
            const regex = new RegExp(`(${pattern})`, "gi")
            return text.replace(regex, "<mark>$1</mark>")
        }

        return text
    }

    let centered = true
    let showValues = false
    $: if (values !== undefined) valuesChanged()
    function valuesChanged() {
        if (values.length || actualSearchText || activeCategory) {
            centered = false
            setTimeout(() => (showValues = true), 60)
        } else {
            showValues = false
            setTimeout(() => (centered = true), 50)
        }
    }
</script>

<svelte:window on:keydown={keydown} />

{#if $quickSearchActive}
    <div class="quicksearch" class:centered transition:fade={{ duration: 50 }}>
        <div class="box" style="--background: rgb({rgb.r} {rgb.g} {rgb.b} / 0.8);" class:isOptimized>
            <div class="search" style="position: relative;">
                <div class="icon">
                    <Icon id="search" size={1.6} white />
                </div>

                {#if activeCategory}
                    <div class="category-tag">
                        <span class="tag-text">{activeCategory}</span>
                        <button class="tag-remove" data-title={translateText("actions.remove")} on:click={() => removeCategoryTag()}>
                            <Icon id="close" size={0.8} white />
                        </button>
                    </div>
                {/if}

                <TextInput value={activeCategory ? actualSearchText : searchValue} placeholder={activeCategory ? `Search in ${activeCategory}...` : translateText("main.quick_search...")} autofocus autoselect on:input={search} style={activeCategory ? "padding-left: " + (90 + activeCategory.length * 8) + "px;" : "padding-left: 47px;"} />
            </div>

            {#if showValues && actualSearchText.length}
                {#if values.length}
                    <div class="values" in:fly={{ y: 10, duration: 150, delay: 50 }}>
                        {#each values as value, i}
                            {#if i === 0 || values[i - 1].category !== value.category}
                                <div class="category-header" role="none" on:click={() => openCategory(value.category)}>
                                    {translateText(quickSearchCategoryNames[value.category])}
                                </div>
                            {/if}

                            <div id="qs-item-{i}">
                                <MaterialButton style="color: {value.color || 'unset'};" icon={value.icon || value.type} title={value.name} isActive={i === selectedIndex} on:click={(e) => selectQuicksearchValue(value, e.detail.ctrl)} white>
                                    <div class="item-text">
                                        <p>
                                            {value.name}

                                            {#if value.aliasMatch && !value.aliasMatch.startsWith("-")}
                                                <span style="opacity: 0.5;font-style: italic;margin-left: 5px;font-size: 0.8em;">{value.aliasMatch}</span>
                                            {/if}

                                            {#if value.id.includes("http")}
                                                <Icon id="launch" size={0.8} white />
                                            {/if}
                                        </p>
                                        {#if value.description}
                                            <p class="description">{@html highlightMatch(value.description, actualSearchText || searchValue)}</p>
                                        {/if}
                                    </div>
                                </MaterialButton>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="values" in:fade>
                        <Center faded>
                            <T id="empty.search" />
                        </Center>
                    </div>
                {/if}
            {/if}
        </div>
    </div>
{/if}

<style>
    .quicksearch {
        position: absolute;
        left: 50%;
        top: 18%;
        transform: translate(-50%, 0);
        width: 600px;
        max-width: 90%;

        z-index: 5001;

        transition:
            top 0.2s ease,
            transform 0.2s ease;
    }
    .quicksearch.centered {
        top: 50%;
        transform: translate(-50%, -50%);
    }

    .box {
        display: flex;
        flex-direction: column;
        gap: 10px;

        background-color: var(--primary);
        border-radius: 12px;
        padding: 12px;

        box-shadow:
            0 12px 40px rgb(0 0 0 / 0.6),
            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
        border: 1px solid var(--primary-lighter);

        --background: rgba(35, 35, 45, 0.8);
        background-color: var(--background);
        backdrop-filter: blur(16px);
    }

    .search .icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);

        pointer-events: none;
        opacity: 0.5;

        display: flex;
        align-items: center;
        justify-content: center;
    }

    .search :global(input) {
        padding: 10px 15px;
        padding-left: 47px;
        font-size: 1.4em;

        border-radius: 8px;
        background: rgba(255, 255, 255, 0.05);
        transition: background 0.2s ease;
    }
    .search :global(input):focus {
        outline: none;
        background: rgba(255, 255, 255, 0.08);
    }

    .values {
        display: flex;
        flex-direction: column;
        max-height: 55vh;
        overflow-y: auto;
        overflow-x: hidden;
        padding-right: 5px;
    }

    .values :global(button) {
        width: 100%;
        font-weight: normal;
        padding: 0.55rem 1.25rem;
        border-bottom: 0 !important;
    }

    .category-header {
        font-size: 0.75em;
        font-weight: bold;
        text-transform: uppercase;
        color: var(--text);
        opacity: 0.4;
        padding: 10px 10px 5px 10px;
        margin-top: 5px;
        border-bottom: 1px solid var(--primary-lighter);
    }
    .category-header:first-child {
        margin-top: 0;
    }

    .item-text {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow: hidden;
        padding-left: 10px;
    }
    .item-text p {
        width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-align: left;
    }
    .description {
        font-size: 0.8em;
        opacity: 0.6;
    }
    .description :global(mark) {
        background: var(--secondary-opacity);
        color: inherit;
        padding: 0 2px;
        border-radius: 4px;
    }

    /* tags */

    .category-tag {
        position: absolute;
        left: 47px;
        top: 50%;
        transform: translateY(-50%);

        display: flex;
        align-items: center;

        font-family: monospace;
        font-size: 0.9em;
        font-weight: 500;

        background: rgb(255 255 255 / 0.1);
        border: 1px solid var(--focus);
        border-radius: 14px;
        padding: 4px 6px 4px 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .tag-text {
        margin-right: 4px;
        text-transform: capitalize;
    }

    .tag-remove {
        width: 16px;
        height: 16px;

        display: flex;
        align-items: center;
        justify-content: center;

        border: none;
        background: none;
        color: var(--text);
        cursor: pointer;

        padding: 2px;
        border-radius: 50%;
        opacity: 0.8;

        transition: all 0.2s ease;
    }
    .tag-remove:hover {
        opacity: 1;
        background: rgba(255, 255, 255, 0.1);
    }
</style>
