<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import type { ClickEvent, SelectIds } from "../../../types/Main"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import SelectElem from "../system/SelectElem.svelte"
    import { themes } from "../../stores"

    export let id: SelectIds
    export let tabs: any[]
    export let value: string
    export let newLabel = "settings.add"

    let tabsElem: HTMLDivElement | undefined
    let isScrollable = false
    function checkScroll() {
        if (!tabsElem) return
        isScrollable = tabsElem.scrollWidth > tabsElem.clientWidth
    }

    onMount(checkScroll)

    const dispatch = createEventDispatcher()
    function open(id: string) {
        dispatch("open", id)
    }
    function create(e: ClickEvent) {
        dispatch("create", e.detail)
        setTimeout(checkScroll, 110)
    }

    $: className = $$props.class || ""

    // custom tab styling
    function getStyle(tabId: string) {
        if (id === "theme") {
            const theme = $themes[tabId]
            const colors = theme.colors
            // font-family: ${theme.font.family};
            return `background-color: ${colors["primary-darker"]};color: ${colors.secondary};font-family: sans-serif;`
        }

        return ""
    }
</script>

<div class="row">
    {#if tabs.length > 1}
        <div class="tabs" class:isScrollable bind:this={tabsElem}>
            {#each tabs as tab}
                {@const active = value === tab.id}
                {@const style = getStyle(tab.id)}

                <SelectElem {id} data={{ id: tab.id }} fill>
                    <button {style} class="tab {className}{className.includes('output') && tab.stageOutput ? '_stage' : ''}" class:active on:click={() => open(tab.id)}>
                        <slot {tab} />
                    </button>
                </SelectElem>
            {/each}
        </div>
    {/if}

    <MaterialButton title={newLabel} class={tabs.length > 1 ? "small_add" : ""} style={tabs.length > 1 ? "" : "flex: 1;"} on:click={create}>
        <Icon id="add" size={1.2} white={tabs.length > 1} />
        {#if tabs.length <= 1}{translateText(newLabel)}{/if}
    </MaterialButton>
</div>

<style>
    .row {
        display: flex;
        width: 100%;

        background-color: var(--primary);

        height: 50px;
    }

    .row :global(button.small_add) {
        transform: translateY(4px);

        border-radius: 15px;
        height: 40px;
        aspect-ratio: 1;
    }
    .row:not(:has(.isScrollable)) :global(button.small_add) {
        transform: translate(-10px, 4px);
    }

    .tabs {
        --radius: 15px;

        display: flex;

        flex: 1;

        overflow-x: auto;

        padding: 0 var(--radius);
    }

    button.tab {
        background-color: inherit;
        color: inherit;
        font-family: inherit;
        font-size: inherit;
        border: none;

        height: 100%;

        position: relative;
        display: flex;
        align-items: center;
        width: 100%;

        padding: 10px 20px;
        border: none;
        background-color: transparent;
        cursor: pointer;

        transition: background-color 0.12s ease;

        border-radius: 0 0 6px 6px;

        /* border-bottom: 2px solid var(--primary); */
    }
    button.tab:not(.active):hover {
        background-color: var(--hover);
    }

    .tab :global(.color) {
        position: absolute;
        left: var(--radius);
        bottom: 5px;

        width: calc(100% - var(--radius) * 2);
        height: 2px;

        background-color: var(--color);
    }

    .tabs :not(:first-child) .tab::before {
        content: "";
        position: absolute;
        left: -2px; /* hidden under active */
        top: 42%;
        transform: translateY(-50%);

        width: 2px;
        height: 45%;
        background-color: var(--primary-lighter);
    }

    .tab.active {
        border-radius: 0 0 var(--radius) var(--radius);
        background-color: var(--primary-darker);
        z-index: 1;

        /* border-bottom: 2px solid var(--secondary); */
    }

    /* concave rounding */
    .tabs .tab.active::before,
    .tabs .tab.active::after {
        transform: initial;

        content: "";
        position: absolute;
        top: 0;
        width: var(--radius);
        height: var(--radius);
    }
    .tabs .tab.active::before {
        left: calc(var(--radius) * -1);
        background: radial-gradient(circle at 0 100%, transparent var(--radius), var(--primary-darker) 0px);
    }
    .tabs .tab.active::after {
        right: calc(var(--radius) * -1);
        background: radial-gradient(circle at 100% 100%, transparent var(--radius), var(--primary-darker) 0px);
    }
</style>
