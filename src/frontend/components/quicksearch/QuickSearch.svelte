<!-- Quickly find shows/elements globally in the program -->

<script lang="ts">
    import { fade } from "svelte/transition"
    import { dictionary, quickSearchActive, special, theme, themes } from "../../stores"
    import { formatSearch } from "../../utils/search"
    import { hexToRgb } from "../helpers/color"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import TextInput from "../inputs/TextInput.svelte"
    import Center from "../system/Center.svelte"
    import { quicksearch, selectQuicksearchValue } from "./quicksearch"

    let values: any[] = []
    let searchValue = ""
    function search(e: any) {
        searchValue = e.target.value
        values = quicksearch(formatSearch(searchValue))
        selectedIndex = 0
    }

    let selectedIndex = 0

    function keydown(e: KeyboardEvent) {
        // CTRL + G or F8
        if (((e.ctrlKey || e.metaKey) && e.key === "g") || e.key === "F8") {
            // toggle quick search
            quickSearchActive.set(!$quickSearchActive)
            return
        }

        if (!$quickSearchActive || !values) return

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
</script>

<svelte:window on:keydown={keydown} />

{#if $quickSearchActive}
    <div class="quicksearch" transition:fade={{ duration: 50 }}>
        <div class="box" style="--background: rgb({rgb.r} {rgb.g} {rgb.b} / 0.9);" class:isOptimized>
            <TextInput value={searchValue} placeholder="{$dictionary.main?.quick_search}..." style="padding: 8px 15px;font-size: 1.2em;min-width: 400px;" autofocus autoselect on:input={search} />

            {#if searchValue}
                {#if values.length}
                    <div class="values">
                        {#each values as value, i}
                            <Button
                                style="gap: 10px;font-size: 1em;color: {value.color || 'unset'};{i > 0 && values[i - 1]?.type !== value.type ? 'border-top: 2px solid var(--primary-lighter);' : ''}"
                                active={i === selectedIndex}
                                on:click={(e) => selectQuicksearchValue(value, e.ctrlKey || e.metaKey)}
                                bold={false}
                            >
                                <Icon id={value.icon || value.type} />
                                <p data-title={value.name}>
                                    {value.name}

                                    {#if value.aliasMatch && !value.aliasMatch.startsWith("-")}
                                        <span style="opacity: 0.5;font-style: italic;margin-left: 5px;font-size: 0.8em;">{value.aliasMatch}</span>
                                    {/if}

                                    {#if value.id.includes("http")}
                                        <Icon id="launch" size={0.8} white />
                                    {/if}
                                </p>
                            </Button>
                        {/each}
                    </div>
                {:else}
                    <Center faded>
                        <T id="empty.search" />
                    </Center>
                {/if}
            {/if}
        </div>
    </div>
{/if}

<style>
    .quicksearch {
        position: absolute;
        inset-inline-start: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        max-width: calc(100% - var(--navigation-width) * 2);

        z-index: 5001;
    }

    .box {
        display: flex;
        flex-direction: column;
        gap: 10px;

        background-color: var(--primary);
        /* border-radius: var(--border-radius); */
        border-radius: 10px;
        padding: 10px;

        box-shadow: 0 0 4px 2px rgb(0 0 0 / 0.2);
        border: 1px solid var(--primary-lighter);

        --background: rgba(35, 35, 45, 0.9);
        background-color: var(--background);
        backdrop-filter: blur(8px);
    }

    .box :global(input) {
        border-radius: 4px;
    }

    .values {
        display: flex;
        flex-direction: column;
    }
</style>
