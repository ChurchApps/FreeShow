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
    import { quicksearch, selectQuicksearchValue, type SearchCategory } from "./quicksearch"
    import { getNormalizedKey } from "../../utils/shortcuts"

    let values: any[] = []
    let searchValue = ""

    let searchId = 0
    async function search(e: any) {
        searchValue = e.target.value

        let value = searchValue
        let category: null | SearchCategory = null

        // choose specific categories with hashtags
        const hashtagMatch = value.match(/#(show|settings|stage|overlays|projects|actions|navigation|faq|shows|media|audio|bible)\b/i)
        if (hashtagMatch) {
            category = hashtagMatch[1].toLowerCase() as SearchCategory
            value = value.replace(hashtagMatch[0], "").trim()
        }

        if (!value) {
            values = []
            return
        }

        const currentId = ++searchId
        const results = await quicksearch(value, category)
        if (currentId !== searchId) return

        values = results
        selectedIndex = 0
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

        if (!$quickSearchActive || !values.length) return

        if (e.key === "Enter") {
            selectQuicksearchValue(values[selectedIndex], e.ctrlKey || e.metaKey)
            selectedIndex = 0
        } else if (e.key === "ArrowDown") selectedIndex = Math.min(values.length - 1, selectedIndex + 1)
        else if (e.key === "ArrowUp") selectedIndex = Math.max(0, selectedIndex - 1)
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
        if (values.length || searchValue) {
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
                <TextInput value={searchValue} placeholder={translateText("main.quick_search...")} autofocus autoselect on:input={search} />
            </div>

            {#if showValues && searchValue}
                {#if values.length}
                    <div class="values" in:fly={{ y: 10, duration: 150, delay: 50 }}>
                        {#each values as value, i}
                            {#if i === 0 || values[i - 1].category !== value.category}
                                <div class="category-header">{value.category}</div>
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
                                            <p class="description">{@html highlightMatch(value.description, searchValue)}</p>
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
</style>
