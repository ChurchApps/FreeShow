<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import { cubicOut } from "svelte/easing"
    import { fade, fly } from "svelte/transition"
    import type { DropdownOptions } from "../../../types/Input"
    import { dictionary } from "../../stores"
    import { translateText } from "../../utils/language"
    import { formatSearch } from "../../utils/search"
    import Icon from "../helpers/Icon.svelte"
    import InputRow from "../input/InputRow.svelte"
    import MaterialButton from "./MaterialButton.svelte"
    import MaterialTextInput from "./MaterialTextInput.svelte"
    import { newDropdown } from "../edit/scripts/edit"

    export let label: string
    export let value: string
    export let defaultValue: string | null = null
    export let options: DropdownOptions

    export let id = ""
    export let disabled = false
    export let allowEmpty = false
    export let flags = false
    export let onlyArrow = false

    export let addNew: string | null = null

    const dispatch = createEventDispatcher()
    export let open = false
    let dropdownEl: HTMLDivElement
    // let triggerEl: HTMLDivElement;
    let highlightedIndex = -1

    function toggleDropdown(force?: boolean) {
        if (disabled) return
        addNewTextbox = false

        open = typeof force === "boolean" && value ? force : !open
        if (open) setTimeout(calculateMaxHeight)

        if (open && value) highlightedIndex = options.findIndex((o) => o.value === value)
        else highlightedIndex = -1
    }

    // AUTO HEIGHT

    let maxHeight = 350
    function calculateMaxHeight() {
        const triggerRect = dropdownEl.getBoundingClientRect()
        scrollParent = getScrollParent(dropdownEl)
        if (!scrollParent) return

        const parentRect = scrollParent.getBoundingClientRect()
        const availableSpace = parentRect.bottom - triggerRect.bottom

        maxHeight = Math.min(400, Math.max(100, availableSpace - 20))
    }

    let scrollParent: HTMLElement | null = null
    function getScrollParent(element: HTMLElement | null): HTMLElement | null {
        while (element) {
            const style = getComputedStyle(element)
            const overflowY = style.overflowY
            if (overflowY === "auto" || overflowY === "scroll") {
                return element
            }
            element = element.parentElement
        }
        return document.documentElement
    }

    // SELECT

    function selectOption(optionValue: string) {
        value = optionValue
        open = false
        dispatch("change", value)
    }

    function handleClickOutside(event: MouseEvent) {
        if (dropdownEl && !dropdownEl.contains(event.target as Node)) {
            open = false
            addNewTextbox = false
        }
    }

    let searchValue = ""
    $: if (open) searchValue = ""
    function handleKeydown(event: KeyboardEvent) {
        if (disabled) return

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            if (searchValue && event.key === " ") return

            if (open && highlightedIndex >= 0) {
                selectOption(options[highlightedIndex].value)
            } else {
                toggleDropdown(true)
            }
            return
        } else if (event.key === "ArrowDown") {
            event.preventDefault()
            if (!open) toggleDropdown(true)
            else {
                // loops back around when reached end
                highlightedIndex = (highlightedIndex + 1) % options.length
                scrollToHighlighted()
            }
            return
        } else if (event.key === "ArrowUp") {
            event.preventDefault()
            if (!open) toggleDropdown(true)
            else {
                // loops back around when reached end
                highlightedIndex = (highlightedIndex - 1 + options.length) % options.length
                scrollToHighlighted()
            }
            return
        } else if (event.key === "Escape") {
            open = false
            return
        }

        if (!open) return

        event.preventDefault()
        if (event.key === "Backspace") {
            searchValue = ""
            highlightedIndex = options.findIndex((o) => o.value === value)
            scrollToHighlighted()
        } else if (event.key.length === 1) {
            searchValue = formatSearch(searchValue + event.key, true)

            let activeIndex = options.findIndex((a) => formatSearch(a.label, true).startsWith(searchValue))
            if (activeIndex < 0) activeIndex = options.findIndex((a) => formatSearch(a.label, true).includes(searchValue))
            if (activeIndex < 0) return

            // enter to select
            highlightedIndex = activeIndex

            scrollToHighlighted()
        }
    }

    let nextScrollTimeout: NodeJS.Timeout | null = null
    function handleScrolling(e: any) {
        const ctrl = e.ctrlKey || e.metaKey
        if (disabled || nextScrollTimeout || !ctrl) return
        e.preventDefault()

        let index = options.findIndex((a) => a.value === value)
        if (e.deltaY > 0) {
            // scroll down
            index = Math.min(options.length - 1, index + 1)
        } else {
            // scroll up
            if (index === 0 && allowEmpty && value) {
                dispatch("change", "")
                return
            }
            if (index < 1) return

            index = index - 1
        }

        const newValue = options[index].value
        if (value === newValue) return

        dispatch("change", newValue)

        // slow down trackpad scrolling
        // don't start timeout if scrolling with mouse
        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    // scroll

    let scrollElem: HTMLUListElement | null = null
    $: if (open) setTimeout(scrollToHighlighted)
    function scrollToHighlighted() {
        if (highlightedIndex < 0 && allowEmpty) return scrollElem?.scrollTo(0, 0)

        if (!scrollElem || highlightedIndex < 0) return
        if (scrollElem.offsetHeight >= scrollElem.scrollHeight) return

        const activeElem = scrollElem?.querySelectorAll("li")?.[highlightedIndex === 0 ? 0 : highlightedIndex - 1]
        if (!activeElem) return

        scrollElem.scrollTo(0, activeElem.offsetTop)
    }

    // blur focus

    function handleFocusOut(event: FocusEvent) {
        if (!dropdownEl.contains(event.relatedTarget as Node)) {
            open = false
            addNewTextbox = false
        }
    }

    onMount(() => {
        document.addEventListener("click", handleClickOutside)
        document.addEventListener("focusout", handleFocusOut, true)

        return () => {
            document.removeEventListener("click", handleClickOutside)
            document.removeEventListener("focusout", handleFocusOut, true)
        }
    })

    function flyFade(node: Element, params = {}) {
        const flyParams = { y: -8, duration: 80, easing: cubicOut, ...params }
        const fadeParams = { duration: 80, ...params }

        const flyConfig = fly(node, flyParams)
        const fadeConfig = fade(node, fadeParams)

        return {
            delay: 0,
            duration: Math.max(flyConfig.duration ?? 0, fadeConfig.duration ?? 0),
            css: (t: number, u: number) => {
                const flyStyle = flyConfig.css?.(t, u) ?? ""
                const fadeStyle = fadeConfig.css?.(t, u) ?? ""
                return `${flyStyle}; ${fadeStyle}`
            }
        }
    }

    $: selected = options.find((o) => o.value === value)

    // let renderedOptions: typeof options = []
    // $: if (open) {
    //     // only show the first few immediately (for large lists) - can't scroll to highlighted
    //     renderedOptions = options.slice(0, 20)
    //     setTimeout(() => (renderedOptions = options), 82)
    // }

    // RESET

    let resetFromValue = ""
    function reset() {
        resetFromValue = value
        dispatch("change", defaultValue)
        setTimeout(() => {
            resetFromValue = ""
        }, 3000)
    }

    function undoReset() {
        dispatch("change", resetFromValue)
        resetFromValue = ""
    }

    // CREATE NEW

    let addNewTextbox = false
    function createNew() {
        if (newDropdown[addNew!]) return newDropdown[addNew!]()

        open = false
        addNewTextbox = true
    }
    let newValue = ""
    function createNewEvent() {
        dispatch("new", newValue)
        addNewTextbox = false
        newValue = ""
    }

    function keydown(e: any) {
        if (e.key === "Enter") {
            newValue = e.target?.value || ""
            createNewEvent()
        }
    }

    $: hasValue = !!value || (value === "" && options[0]?.value === "")
</script>

<div class="textfield {disabled ? 'disabled' : ''}" style={$$props.style || null} class:flags class:onlyArrow bind:this={dropdownEl}>
    <div class="background" />

    <div
        class="input edit dropdown-trigger"
        data-title="{translateText(label)}: <b>{selected?.label || '—'}</b>"
        role="button"
        tabindex={disabled ? undefined : 0}
        on:click={(e) => {
            if (e.target?.closest(".remove")) return
            toggleDropdown()
        }}
        on:keydown={handleKeydown}
        on:wheel={handleScrolling}
        aria-haspopup="listbox"
        aria-expanded={open}
    >
        {#if !onlyArrow}
            <span class="selected-text" style={selected?.style ?? null}>
                {#if selected?.prefix}<span class="prefix">{selected.prefix}</span>{/if}
                <!-- show value if options list has not loaded yet (e.g. fonts) -->
                {#if selected?.value !== undefined}{selected?.label || "—"}{:else if value}{value}{/if}
            </span>
        {/if}
        <svg class="arrow {open ? 'open' : ''}" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" />
        </svg>
    </div>

    {#if !onlyArrow}
        <label for={id} class:selected={hasValue}>{@html translateText(label, $dictionary)}</label>
    {/if}
    <span class="underline" />

    {#if allowEmpty && hasValue}
        <div class="remove">
            <MaterialButton on:click={() => selectOption("")} title="clear.general" white>
                <Icon id="close" white />
            </MaterialButton>
        </div>
    {/if}
    {#if defaultValue !== null}
        <div class="remove">
            {#if value !== defaultValue}
                <MaterialButton on:click={reset} title="actions.reset" white>
                    <Icon id="reset" white />
                </MaterialButton>
            {:else if resetFromValue}
                <MaterialButton on:click={undoReset} title="actions.undo" white>
                    <Icon id="undo" white />
                </MaterialButton>
            {/if}
        </div>
    {/if}

    {#if open}
        <ul style="max-height: {maxHeight}px" class="dropdown" role="listbox" tabindex="-1" bind:this={scrollElem} transition:flyFade>
            {#if allowEmpty}
                <li style="opacity: 0.5;font-style: italic;" role="option" aria-selected={!value} class:selected={!value} class:highlighted={highlightedIndex < 0} on:click={() => selectOption("")}>
                    {translateText("main.none")}
                </li>
            {/if}

            {#each options as option, i}
                <li
                    style="{option.data ? 'justify-content: space-between;' : ''}{option.style || ''}"
                    role="option"
                    aria-selected={option.value === value}
                    class:selected={option.value === value}
                    class:highlighted={i === highlightedIndex}
                    on:click={() => selectOption(option.value)}
                >
                    {#if option.prefix}<span class="prefix">{option.prefix}</span>{/if}
                    {option.label || "—"}

                    {#if option.data}
                        <div class="data" data-title={option.data}>{option.data}</div>
                    {/if}
                </li>
            {/each}

            {#if addNew}
                <li style="font-style: italic;opacity: 0.9;" on:click={createNew}>
                    <Icon id="add" />
                    {translateText(addNew)}
                </li>
            {/if}
        </ul>

        {#if searchValue}
            <div class="search">{searchValue}</div>
        {/if}
    {/if}

    {#if addNew && addNewTextbox}
        <div class="dropdown">
            <InputRow>
                <MaterialTextInput label="inputs.name" value={newValue} autofocus on:input={(e) => (newValue = e.detail)} on:keydown={keydown} />
                <MaterialButton disabled={!newValue.length} title={addNew} on:click={createNewEvent}>
                    <Icon id="check" size={1.2} white />
                </MaterialButton>
            </InputRow>
        </div>
    {/if}
</div>

<style>
    .textfield {
        position: relative;
        width: 100%;
        color: var(--text);
        user-select: none;

        border-bottom: 1.2px solid var(--primary-lighter);

        height: 50px;
    }

    .textfield.flags {
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

    .textfield.onlyArrow {
        width: 50px;
    }

    .background {
        position: absolute;
        inset: 0;
        background-color: var(--primary-darkest);
        border-radius: 4px 4px 0 0;
        z-index: 0;
    }

    .textfield:not(:has(.dropdown)):not(:has(.remove:hover)):not(:disabled):hover .input {
        background-color: var(--hover);
    }

    .dropdown-trigger {
        position: relative;
        z-index: 1;
        width: 100%;
        padding: 1.25rem 0.75rem 0.5rem;
        font-size: 1rem;
        color: var(--text);
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        background: transparent;
        border: none;
        outline: none;
    }

    .remove {
        position: absolute;
        top: 50%;
        right: 46px;
        transform: translateY(-50%);

        z-index: 2;
    }
    .remove :global(button) {
        padding: 0.75rem;
    }

    .selected-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .arrow {
        transition: transform 0.2s ease;
        color: var(--text);
        transform: translateY(-0.4rem);
    }
    .arrow.open {
        transform: translateY(-0.4rem) rotate(180deg);
    }

    label {
        position: absolute;
        left: 0.75rem;
        top: 0.75rem;
        font-size: 1.1rem;
        color: var(--text);
        opacity: 0.8;
        transition: all 0.2s ease;
        pointer-events: none;
        z-index: 1;
    }
    label.selected {
        top: 0.25rem;
        font-size: 0.75rem;
        color: var(--secondary);
        font-weight: 500;
        opacity: 1;
    }

    .prefix {
        padding-right: 5px;
    }

    .underline {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 1.2px;
        width: 100%;
        background-color: var(--secondary);
        transform: scaleX(0);
        transition: transform 0.2s ease;
        transform-origin: left;
        z-index: 2;

        pointer-events: none;
    }

    .textfield:not(:has(.remove:hover)):focus-within .underline {
        transform: scaleX(1);
    }
    .textfield:focus-within label {
        top: 0.25rem;
        font-size: 0.75rem;
        color: var(--secondary);
        font-weight: 500;
        opacity: 1;
    }

    .dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background-color: var(--primary-darkest);
        /* border: 1px solid var(--secondary); */
        border-radius: 0 0 4px 4px;
        z-index: 10;
        list-style: none;
        margin: 0;
        padding: 0.25rem 0;
        max-height: 350px;
        overflow-y: auto;
        overflow-x: hidden;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);

        border-bottom: 1px solid var(--primary-lighter);
    }

    .onlyArrow .dropdown {
        --left: 160px;
        left: calc(0 - var(--left));
        width: calc(var(--left) + 48px);
    }

    .dropdown li {
        padding: 0.5rem 0.75rem;
        cursor: pointer;
        color: var(--text);
        transition: background 0.2s;

        display: flex;
        align-items: center;
        gap: 5px;
    }
    .dropdown li:hover,
    .dropdown li.highlighted {
        background-color: var(--hover);
    }
    .dropdown li.selected {
        color: var(--secondary);
    }

    .dropdown .data {
        color: var(--text);
        opacity: 0.5;
        font-size: 0.8em;

        max-width: 40%;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
    }

    .disabled {
        pointer-events: none;
        opacity: 0.35;
    }

    .search {
        position: absolute;
        right: 12px;
        top: calc(100% + 6px);

        background-color: var(--primary-darkest);
        color: var(--text);
        border: 1px solid var(--primary-lighter);

        opacity: 0.8;
        padding: 10px;
        border-radius: 4px;

        z-index: 10;
    }
</style>
