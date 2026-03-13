<script lang="ts">
    import { activePopup, globalRegexes, popupData } from "../../../stores"
    import HRule from "../../input/HRule.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    const regexId = $popupData.id
    $: label = $globalRegexes[regexId]?.label || ""
    $: pattern = $globalRegexes[regexId]?.value || ""

    function update(key: string, value: string) {
        globalRegexes.update((a) => {
            if (!a[regexId]) a[regexId] = { label: "", value: "" }
            a[regexId][key] = value
            return a
        })
    }

    function setRegex(regex: string) {
        regex = regex.trim()
        if (regex && !regex.startsWith("/")) regex = "/" + regex
        // Skip the opening slash so it can't be mistaken for the closing delimiter
        if (regex && !/\/[gimsuy]*$/.test(regex.slice(1))) regex = regex + "/"
        // Normalize double backslashes to single (support pasting string-escaped regexes)
        const m = regex.match(/^(\/)(.*)(\/)([gimsuy]*)$/)
        if (m) regex = m[1] + m[2].replace(/\\\\/g, "\\") + m[3] + m[4]
        update("value", regex)
    }

    function goBack() {
        let previousPopup = $popupData.previousPopup
        if ($popupData.previousData) popupData.set($popupData.previousData)
        if (previousPopup) activePopup.set(previousPopup)
    }

    let testInput = "Lorem ipsum 123! test@example.com https://example.com/path?q=1&x=2 #tag (alpha)_beta +47.5%"

    $: isValid = validateRegex(pattern)
    $: previewHtml = getPreviewHtml(pattern, testInput)

    function validateRegex(pat: string) {
        const match = pat.match(/^\/(.*)\/([gimsuy]*)$/)
        if (!match) return false
        try {
            new RegExp(match[1], match[2])
            return true
        } catch {
            return false
        }
    }

    function escapeHtml(s: string) {
        return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    }

    $: patternHtml = highlightRegexSyntax(pattern)

    function highlightRegexSyntax(pat: string): string {
        const match = pat.match(/^(\/)(.*)(\/)([gimsuy]*)$/)
        if (!match) return `<span class="rx-literal">${escapeHtml(pat)}</span>`
        const [, open, body, close, flags] = match
        return `<span class="rx-delim">${escapeHtml(open)}</span>` + tokenizeRegex(body) + `<span class="rx-delim">${escapeHtml(close)}</span>` + (flags ? `<span class="rx-flag">${escapeHtml(flags)}</span>` : "")
    }

    function tokenizeRegex(body: string): string {
        let result = ""
        let i = 0
        while (i < body.length) {
            const ch = body[i]
            if (ch === "\\") {
                result += `<span class="rx-escape">${escapeHtml(body.slice(i, i + 2))}</span>`
                i += 2
            } else if (ch === "[") {
                let j = i + 1
                if (j < body.length && body[j] === "^") j++
                while (j < body.length) {
                    if (body[j] === "\\") j++
                    else if (body[j] === "]") break
                    j++
                }
                result += `<span class="rx-charclass">${escapeHtml(body.slice(i, j + 1))}</span>`
                i = j + 1
            } else if (ch === "(") {
                result += `<span class="rx-group">(</span>`
                i++
                if (body[i] === "?") {
                    let k = i + 1
                    while (k < body.length && /[:<>=!]/.test(body[k])) k++
                    result += `<span class="rx-group-mod">${escapeHtml(body.slice(i, k))}</span>`
                    i = k
                }
            } else if (ch === ")") {
                result += `<span class="rx-group">)</span>`
                i++
            } else if (/[*+?]/.test(ch)) {
                let q = ch
                i++
                if (i < body.length && body[i] === "?") {
                    q += "?"
                    i++
                }
                result += `<span class="rx-quantifier">${escapeHtml(q)}</span>`
            } else if (ch === "{") {
                let j = i + 1
                while (j < body.length && body[j] !== "}") j++
                result += `<span class="rx-quantifier">${escapeHtml(body.slice(i, j + 1))}</span>`
                i = j + 1
            } else if (ch === "^" || ch === "$") {
                result += `<span class="rx-anchor">${escapeHtml(ch)}</span>`
                i++
            } else if (ch === "|") {
                result += `<span class="rx-alternation">|</span>`
                i++
            } else if (ch === ".") {
                result += `<span class="rx-dot">.</span>`
                i++
            } else {
                result += `<span class="rx-literal">${escapeHtml(ch)}</span>`
                i++
            }
        }
        return result
    }

    function getPreviewHtml(pat: string, text: string) {
        if (!text) return ""
        const match = pat.match(/^\/(.*)\/([gimsuy]*)$/)
        if (!match) return escapeHtml(text)
        let regex: RegExp
        try {
            const flags = match[2].includes("g") ? match[2] : match[2] + "g"
            regex = new RegExp(match[1], flags)
        } catch {
            return escapeHtml(text)
        }
        let result = ""
        let lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = regex.exec(text)) !== null) {
            result += escapeHtml(text.slice(lastIndex, m.index))
            result += `<mark>${escapeHtml(m[0])}</mark>`
            lastIndex = m.index + m[0].length
            if (m[0].length === 0) {
                regex.lastIndex++
                lastIndex++
            }
        }
        result += escapeHtml(text.slice(lastIndex))
        return result
    }
</script>

<MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={goBack} />

<!-- inputs.name -->
<MaterialTextInput label="midi.description" value={label} on:change={(e) => update("label", e.detail)} />
<MaterialTextInput label="/regex/" value={pattern} on:change={(e) => setRegex(e.detail)} autofocus />

<HRule />

<div class="preview">
    {#if pattern}
        <div class="regex-display" class:valid={isValid} class:invalid={!isValid}>
            <code class="regex-highlight">{@html patternHtml}</code>
            <span class="validity-badge">{isValid ? "✓" : "✗"}</span>
        </div>
    {/if}

    <MaterialTextInput label="timer.preview" value={testInput} on:change={(e) => (testInput = e.detail)} />
    {#if testInput}
        <div class="preview-text">{@html previewHtml}</div>
    {/if}
</div>

<style>
    .preview {
        display: flex;
        flex-direction: column;
    }
    .regex-display {
        display: flex;
        align-items: center;
        gap: 0.5em;

        padding: 0.4em 0.6em;
        margin-bottom: 0.5em;

        font-size: 0.9em;
        background: var(--primary-darker);
        border-radius: 4px;
        border-left: 3px solid var(--primary-lighter);
    }
    .regex-display.valid {
        border-left-color: #4caf50;
    }
    .regex-display.invalid {
        border-left-color: #f44336;
    }
    .regex-highlight {
        font-family: monospace;
        font-size: 1em;
        flex: 1;
        word-break: break-all;
    }
    .validity-badge {
        font-weight: 700;
        font-size: 1em;
    }
    .regex-display.valid .validity-badge {
        color: #4caf50;
    }
    .regex-display.invalid .validity-badge {
        color: #f44336;
    }
    .regex-highlight :global(.rx-delim) {
        color: #888;
    }
    .regex-highlight :global(.rx-flag) {
        color: #ce93d8;
    }
    .regex-highlight :global(.rx-escape) {
        color: #4dd0e1;
    }
    .regex-highlight :global(.rx-charclass) {
        color: #ffb74d;
    }
    .regex-highlight :global(.rx-group) {
        color: #fff176;
    }
    .regex-highlight :global(.rx-group-mod) {
        color: #ffe082;
    }
    .regex-highlight :global(.rx-quantifier) {
        color: #a5d6a7;
    }
    .regex-highlight :global(.rx-anchor) {
        color: #ef9a9a;
    }
    .regex-highlight :global(.rx-alternation) {
        color: #f48fb1;
    }
    .regex-highlight :global(.rx-dot) {
        color: #4dd0e1;
    }
    .regex-highlight :global(.rx-literal) {
        color: #fff;
    }
    .preview-text {
        font-family: monospace;
        font-size: 0.95em;
        padding: 0.4em 0.6em;
        background: var(--primary-darker);
        border-radius: 4px;
        word-break: break-all;
        white-space: pre-wrap;
    }
    .preview-text :global(mark) {
        background: #f9a825;
        color: #000;
        border-radius: 2px;
        padding: 0 1px;
    }
</style>
