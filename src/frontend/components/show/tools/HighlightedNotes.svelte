<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { translateText } from "../../../utils/language"
    import { groups } from "../../../stores"
    import { getGlobalGroup } from "../../helpers/show"

    export let value: string
    export let placeholder = ""
    export let disabled = false
    export let lines = 4
    export let autofocus = false

    const dispatch = createEventDispatcher()
    let timeout: NodeJS.Timeout | null = null
    let backdropEl: HTMLDivElement

    function input() {
        if (timeout) return
        timeout = setTimeout(() => {
            dispatch("edit", value)
            timeout = null
        }, 100)
    }

    function change() {
        setTimeout(() => dispatch("change", value))
    }

    function handleScroll(e: any) {
        if (backdropEl) {
            backdropEl.scrollTop = e.target.scrollTop
            backdropEl.scrollLeft = e.target.scrollLeft
        }
    }

    $: highlightedText = getHighlighted(value, $groups)

    function getHighlighted(val: string, currentGroups: any) {
        if (!val) return ""
        let escaped = val.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

        // Highlight brackets [] and curly braces {} with faded brackets and colored inner text
        escaped = escaped.replace(/(\[|\{)([^\]\}]*)(\]|\})/g, (_match, openSymbol, innerText, closeSymbol) => {
            const groupId = getGlobalGroup(innerText)
            const color = groupId && currentGroups[groupId]?.color
            if (color) {
                return `<span class="bracket-symbol">${openSymbol}</span><span class="bracket-content" style="color: ${color} !important;">${innerText}</span><span class="bracket-symbol">${closeSymbol}</span>`
            }
            return `<span class="bracket-symbol">${openSymbol}</span><span class="bracket-content">${innerText}</span><span class="bracket-symbol">${closeSymbol}</span>`
        })

        if (escaped.endsWith("\n")) {
            escaped += " "
        }
        return escaped
    }
</script>

<div class="paper">
    <div class="backdrop" bind:this={backdropEl}>
        <div class="highlight-overlay" style={$$props.style || ""}>
            {@html highlightedText}
        </div>
    </div>
    <textarea placeholder={placeholder || translateText("empty.text...")} class="edit {$$props.class}" rows={lines} style={$$props.style || ""} bind:value on:input={input} on:change={change} on:keydown on:scroll={handleScroll} {disabled} {autofocus} />
</div>

<style>
    .paper {
        display: flex;
        flex: 1;
        height: 100%;
        overflow: hidden;
        position: relative;
    }

    .backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        overflow-y: auto;
        overflow-x: hidden;
        z-index: 1;
        scrollbar-width: none;
    }

    .backdrop::-webkit-scrollbar {
        display: none;
    }

    .highlight-overlay {
        min-height: 100%;
        width: 100%;
        box-sizing: border-box;
        white-space: pre-wrap;
        word-wrap: break-word;
        word-break: break-word;
        color: inherit;
        font-family: inherit;
        font-size: inherit;
        line-height: inherit;
        padding: 10px;
    }

    .edit {
        position: relative;
        z-index: 2;
        height: 100%;
        width: 100%;
        padding: 10px;
        outline: none;
        border: none;
        color: transparent;
        caret-color: var(--text, white);
        font-size: inherit;
        font-family: inherit;
        background-color: transparent;
        resize: none;
        box-sizing: border-box;
        overflow-y: auto;
    }

    .edit::selection {
        background-color: color-mix(in srgb, var(--secondary, #3a97f9) 30%, transparent) !important;
    }

    textarea::placeholder {
        color: var(--text, white);
        opacity: 0.5;
    }

    textarea:disabled {
        opacity: 0.5;
    }

    :global(.bracket-symbol) {
        color: var(--text, white);
        opacity: 0.4;
    }

    :global(.bracket-content) {
        color: var(--secondary, #3a97f9) !important;
        font-weight: normal;
    }
</style>
