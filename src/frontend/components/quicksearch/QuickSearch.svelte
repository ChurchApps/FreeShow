<!-- Quickly find shows/elements globally in the program -->

<script lang="ts">
    import { fade } from "svelte/transition"
    import { dictionary, quickSearchActive } from "../../stores"
    import { formatSearch } from "../../utils/search"
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
            // refocus on search bar?
            quickSearchActive.set(true)
            return
        }

        if (!$quickSearchActive || !values) return

        if (e.key === "Enter") {
            selectQuicksearchValue(values[selectedIndex], e.ctrlKey || e.metaKey)
            selectedIndex = 0
        } else if (e.key === "ArrowDown") selectedIndex = Math.min(values.length - 1, selectedIndex + 1)
        else if (e.key === "ArrowUp") selectedIndex = Math.max(0, selectedIndex - 1)
    }
</script>

<svelte:window on:keydown={keydown} />

{#if $quickSearchActive}
    <div class="quicksearch" transition:fade={{ duration: 50 }}>
        <div class="box">
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
                                <p title={value.name}>
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
        border-radius: 4px;
        padding: 10px;

        box-shadow: 0 0 3px rgb(0 0 0 / 0.4);
        border: 2px solid var(--primary-darkest);
    }

    .values {
        display: flex;
        flex-direction: column;
    }
</style>
