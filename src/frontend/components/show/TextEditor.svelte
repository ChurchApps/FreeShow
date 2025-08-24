<script lang="ts">
    import { slide } from "svelte/transition"
    import type { Show } from "../../../types/Show"
    import { getQuickExample } from "../../converters/txt"
    import { includeEmptySlides, textEditActive, textEditZoom, activePopup } from "../../stores"
    import { transposeText } from "../../utils/chordTranspose"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialZoom from "../inputs/MaterialZoom.svelte"
    import MaterialTextInput from "../inputs/MaterialTextInput.svelte"
    import { formatText } from "./formatTextEditor"
    import { getPlainEditorText } from "./getTextEditor"
    import Notes from "./tools/Notes.svelte"

    export let currentShow: Show | undefined

    $: allowEmpty = $includeEmptySlides

    let text = ""
    $: if (currentShow) text = getPlainEditorText("", allowEmpty)

    // Intercept find/replace popup when text editor is active
    $: if ($textEditActive && $activePopup === "find_replace") {
        showFindPanel = true
        setTimeout(() => {
            const findInput = document.getElementById('find-input') as HTMLInputElement
            if (findInput) {
                findInput.focus()
                findInput.select()
            }
        }, 100)
        // Close the global popup since text editor handles it locally
        activePopup.set(null)
    }

    // transpose chords
    function transposeUp() {
        formatText(transposeText(text, 1))
    }
    function transposeDown() {
        formatText(transposeText(text, -1))
    }

    $: showHasChords = Object.values(currentShow?.slides || {}).find((a) => a.items?.find((a) => a.lines?.find((a) => a.chords)))

    // Find and Replace functionality
    let showFindPanel = false
    let showReplace = false
    let findText = ""
    let replaceText = ""
    let currentMatchIndex = -1
    let matches: { start: number; end: number }[] = []
    let isUserTyping = false
    let highlightedText = ""

    // Undo/Redo functionality
    let history: string[] = []
    let historyIndex = -1

    // Store initial value in history
    $: if (text && history.length === 0) {
        history = [text]
        historyIndex = 0
    }

    // Update history when text changes
    $: if (text !== history[historyIndex]) {
        // Remove any history after current index (for new changes after undo)
        history = history.slice(0, historyIndex + 1)
        history.push(text)
        historyIndex = history.length - 1

        // Limit history to 50 entries
        if (history.length > 50) {
            history = history.slice(-50)
            historyIndex = 49
        }
    }

    function undo() {
        if (historyIndex > 0) {
            historyIndex--
            formatText(history[historyIndex])
        }
    }

    function redo() {
        if (historyIndex < history.length - 1) {
            historyIndex++
            formatText(history[historyIndex])
        }
    }

    // Keyboard shortcuts
    function handleKeydown(e: KeyboardEvent) {
        // Ctrl+F to toggle find panel
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault()
            showFindPanel = !showFindPanel
            if (showFindPanel) {
                setTimeout(() => {
                    const findInput = document.getElementById('find-input') as HTMLInputElement
                    if (findInput) {
                        findInput.focus()
                        findInput.select()
                    }
                }, 100)
            }
        }


        // Ctrl+Z to undo
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
            e.preventDefault()
            undo()
        }

        // Ctrl+Y or Ctrl+Shift+Z to redo
        if (((e.ctrlKey || e.metaKey) && e.key === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
            e.preventDefault()
            redo()
        }

        // Enter to cycle through matches when find panel is active
        if (e.key === 'Enter' && showFindPanel && matches.length > 0) {
            e.preventDefault()
            findNext()
        }

        // Escape to close find panel
        if (e.key === 'Escape' && showFindPanel) {
            showFindPanel = false
        }
    }

    // Find functionality
    function findMatches() {
        if (!findText) {
            matches = []
            currentMatchIndex = -1
            highlightedText = text
            return
        }

        const searchText = findText.toLowerCase()
        const targetText = text.toLowerCase()

        matches = []
        let index = targetText.indexOf(searchText)

        while (index !== -1) {
            const start = index
            const end = index + searchText.length

            matches.push({ start, end })
            index = targetText.indexOf(searchText, index + 1)
        }

        currentMatchIndex = matches.length > 0 ? 0 : -1
        generateHighlightedText()
    }

    // Generate text with highlighted matches
    function generateHighlightedText() {
        if (!findText || matches.length === 0) {
            highlightedText = text
            return
        }

        let result = ""
        let lastIndex = 0

        matches.forEach((match, index) => {
            // Add text before the match
            const beforeText = text.substring(lastIndex, match.start)
            result += beforeText

            // Add highlighted match
            const matchText = text.substring(match.start, match.end)
            const isCurrent = index === currentMatchIndex
            const highlightClass = isCurrent ? 'current-match' : 'match'
            
            // Escape HTML characters in the match text
            const escapedMatchText = matchText
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
            
            result += `<span class="${highlightClass}">${escapedMatchText}</span>`

            lastIndex = match.end
        })

        // Add remaining text
        const remainingText = text.substring(lastIndex)
        result += remainingText

        highlightedText = result
    }

    // Update matches when search text changes
    $: if (findText) {
        findMatches()
        // Auto-select first match but don't steal focus while user is typing
        setTimeout(() => {
            if (matches.length > 0 && !isUserTyping) {
                highlightCurrentMatch()
            }
        }, 100)
    } else {
        matches = []
        currentMatchIndex = -1
        highlightedText = text
    }

    // Update highlighting when current match changes
    $: if (currentMatchIndex >= 0 && matches.length > 0) {
        generateHighlightedText()
    }

    function findNext() {
        if (matches.length === 0) return

        currentMatchIndex = (currentMatchIndex + 1) % matches.length
        // Always update highlighting and focus when explicitly navigating
        const wasTyping = isUserTyping
        isUserTyping = false // Temporarily allow focus for navigation
        highlightCurrentMatch()
        isUserTyping = wasTyping
    }

    function findPrevious() {
        if (matches.length === 0) return

        currentMatchIndex = currentMatchIndex <= 0 ? matches.length - 1 : currentMatchIndex - 1
        // Always update highlighting and focus when explicitly navigating
        const wasTyping = isUserTyping
        isUserTyping = false // Temporarily allow focus for navigation
        highlightCurrentMatch()
        isUserTyping = wasTyping
    }

    function highlightCurrentMatch() {
        if (currentMatchIndex >= 0 && currentMatchIndex < matches.length) {
            const match = matches[currentMatchIndex]
            const findInput = document.getElementById('find-input') as HTMLInputElement
            const replaceInput = document.getElementById('replace-input') as HTMLInputElement
            const textarea = document.querySelector('.text-editor-container textarea') as HTMLTextAreaElement

            if (textarea && findInput && replaceInput) {
                // Only set selection and focus if user is not actively typing in inputs
                if (document.activeElement !== findInput && document.activeElement !== replaceInput && !isUserTyping) {
                    textarea.focus()
                    textarea.setSelectionRange(match.start, match.end)

                    // Scroll to make the selection visible
                    const lineHeight = 20 // approximate line height
                    const lines = text.substring(0, match.start).split('\n').length - 1
                    textarea.scrollTop = lines * lineHeight - textarea.clientHeight / 2
                }

            }
        }
    }

    function replaceCurrent() {
        if (currentMatchIndex < 0 || currentMatchIndex >= matches.length) return

        const match = matches[currentMatchIndex]
        const before = text.substring(0, match.start)
        const after = text.substring(match.end)
        const newText = before + replaceText + after
        const replacementEndPos = match.start + replaceText.length

        // Update text directly to avoid triggering global history system
        text = newText

        // Update matches after replacement
        findMatches()

        // Find the next match after the replacement position
        if (matches.length > 0) {
            // Find first match that starts after our replacement
            const nextMatchIndex = matches.findIndex(match => match.start >= replacementEndPos)
            currentMatchIndex = nextMatchIndex >= 0 ? nextMatchIndex : 0
            highlightCurrentMatch()
        }
    }

    function replaceAll() {
        if (!findText || matches.length === 0) return

        let newText = text

        // Replace from the end to avoid index shifting
        for (let i = matches.length - 1; i >= 0; i--) {
            const match = matches[i]
            const before = newText.substring(0, match.start)
            const after = newText.substring(match.end)
            newText = before + replaceText + after
        }

        // Update text directly to avoid triggering global history system
        text = newText
        findMatches()
    }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="text-editor-container #texteditor context">
    <div class="text-editor-wrapper" style="padding: 30px; height: calc(100% - 28px); position: relative;">
        <div class="editor-container" style="position: relative;">
            <Notes
                disabled={currentShow?.locked}
                style="font-size: {$textEditZoom / 8}em; position: relative; z-index: 2; background: {showFindPanel && findText && matches.length > 0 ? 'transparent' : 'inherit'};"
                placeholder={getQuickExample()}
                value={text}
                on:change={(e) => formatText(e.detail)}
            />

            {#if showFindPanel && findText && matches.length > 0}
                <div class="highlight-overlay" style="font-size: {$textEditZoom / 8}em; z-index: 1;">
                    {@html highlightedText}
                </div>
            {/if}
        </div>
    </div>

    {#if showFindPanel}
        <div class="find-replace-panel" transition:slide={{ duration: 200 }}>
            <div class="find-section">
                <div class="input-row">
                    <div class="left-actions">
                        <MaterialButton
                            variant="text"
                            on:click={() => showReplace = !showReplace}
                            title="actions.replace"
                        >
                            <Icon id="arrow_right" size={1.2} />
                        </MaterialButton>
                    </div>
                    <div class="input-container">
                        <MaterialTextInput
                            bind:value={findText}
                            label="actions.find"
                            id="find-input"
                            on:input={() => {
                                isUserTyping = true
                                // Clear typing flag after user stops typing
                                setTimeout(() => {
                                    isUserTyping = false
                                }, 300)
                            }}
                        />

                        {#if findText}
                            <div class="search-indicator">
                                {#if matches.length > 0}
                                    <span class="match-count-inline">{currentMatchIndex + 1} of {matches.length}</span>
                                {:else}
                                    <span class="no-results">No results</span>
                                {/if}
                            </div>
                        {/if}
                    </div>
                    <div class="right-actions">
                        <MaterialButton
                            variant="text"
                            on:click={findPrevious}
                            disabled={matches.length === 0}
                            title="actions.backward"
                        >
                            <Icon id="arrow_up" size={1.2} />
                        </MaterialButton>
                        <MaterialButton
                            variant="text"
                            on:click={findNext}
                            disabled={matches.length === 0}
                            title="actions.forward"
                        >
                            <Icon id="arrow_down" size={1.2} />
                        </MaterialButton>
                        <MaterialButton
                            variant="text"
                            on:click={() => showFindPanel = false}
                            title="actions.close"
                        >
                            <Icon id="close" size={1.2} />
                        </MaterialButton>
                    </div>
                </div>
            </div>

            {#if showReplace}
                <div class="replace-section">
                    <div class="input-row">
                        <div class="left-actions">
                            <!-- Empty space to align with find section -->
                        </div>
                        <div class="input-container">
                            <MaterialTextInput
                                bind:value={replaceText}
                                label="actions.replace"
                                id="replace-input"
                                on:input={() => {
                                    isUserTyping = true
                                    // Clear typing flag after user stops typing
                                    setTimeout(() => {
                                        isUserTyping = false
                                    }, 300)
                                }}
                            />
                        </div>
                        <div class="replace-actions">
                            <MaterialButton
                                variant="outlined"
                                on:click={replaceCurrent}
                                disabled={matches.length === 0}
                                title="actions.replace"
                            >
                                <T id="actions.replace" />
                            </MaterialButton>
                            <MaterialButton
                                variant="contained"
                                on:click={replaceAll}
                                disabled={matches.length === 0}
                                title="actions.replace_all"
                            >
                                <T id="actions.replace_all" />
                            </MaterialButton>
                        </div>
                    </div>
                </div>
            {/if}


        </div>
    {/if}
</div>

<FloatingInputs arrow let:open>
    <MaterialZoom hidden={!open} columns={$textEditZoom / 10} min={0.5} max={2} defaultValue={1} addValue={-0.1} on:change={(e) => textEditZoom.set(e.detail * 10)} />

    {#if open}
        <div class="divider"></div>
    {/if}

    <MaterialButton isActive title="show.text" on:click={() => textEditActive.set(false)}>
        <Icon id="text_edit" white />
    </MaterialButton>
</FloatingInputs>

{#if showHasChords}
    <FloatingInputs side="left">
        <MaterialButton on:click={transposeUp} title="edit.transpose_up">
            <Icon id="arrow_up" size={1.3} white />
        </MaterialButton>
        <MaterialButton on:click={transposeDown} title="edit.transpose_down">
            <Icon id="arrow_down" size={1.3} white />
        </MaterialButton>
    </FloatingInputs>
{/if}

<style>
    .text-editor-container {
        position: relative;
        height: 100%;
    }

    .text-editor-wrapper {
        position: relative;
    }

    .editor-container {
        position: relative;
        width: 100%;
        height: 100%;
    }

    .highlight-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 1;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow-wrap: break-word;
        font-family: inherit;
        line-height: inherit;
        color: transparent;
        user-select: none;
        background: transparent;
        padding: 10px;
        box-sizing: border-box;
        overflow: hidden;
    }

    .highlight-overlay :global(.match) {
        background-color: rgba(255, 255, 0, 0.4) !important;
        border-radius: 2px;
        color: transparent;
    }

    .highlight-overlay :global(.current-match) {
        background-color: rgba(255, 165, 0, 0.6) !important;
        border-radius: 2px;
        color: transparent;
        box-shadow: 0 0 0 1px rgba(255, 165, 0, 0.8);
    }





    .find-replace-panel {
        position: absolute;
        top: 10px;
        right: 10px;
        min-width: 320px;
        max-width: 400px;
        background: var(--primary);
        border: 1px solid var(--primary-lighter);
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        z-index: 1000;
        overflow: hidden;
        backdrop-filter: blur(8px);
    }

    .find-section, .replace-section {
        padding: 6px 12px;
    }

    .replace-section {
        background: rgba(0, 0, 0, 0.02);
        border-top: 1px solid var(--primary-lighter);
    }

    .input-row {
        display: flex;
        align-items: center;
        gap: 4px;
        width: 100%;
    }

    .left-actions {
        display: flex;
        align-items: center;
        flex-shrink: 0;
    }

    .input-container {
        flex: 1;
        min-width: 0;
        position: relative;
    }

    .right-actions {
        display: flex;
        align-items: center;
        gap: 2px;
        flex-shrink: 0;
    }

    .replace-actions {
        gap: 8px;
        flex-shrink: 0;
    }

    .search-indicator {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 11px;
        color: var(--text);
        opacity: 0.7;
        font-variant-numeric: tabular-nums;
        pointer-events: none;
        white-space: nowrap;
    }

    .match-count-inline {
        color: var(--text);
        opacity: 0.8;
    }

    .no-results {
        color: #ff6b6b;
        opacity: 0.9;
    }

    /* Material Design elevation and animations */
    .find-replace-panel {
        animation: slideIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(-8px) scale(0.98);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }

    /* Hover effects for better interaction */
    .find-replace-panel:hover {
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16);
    }

    /* Focus within for better accessibility */
    .find-replace-panel:focus-within {
        border-color: var(--secondary);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px var(--secondary);
    }

    .search-indicator {
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 10;
        font-size: 11px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
    }



    /* Responsive design */
    @media (max-width: 600px) {
        .find-replace-panel {
            position: fixed;
            top: auto;
            bottom: 20px;
            left: 20px;
            right: 20px;
            width: auto;
            max-width: none;
        }
    }
</style>
