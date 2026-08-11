<!-- FreeNote rich editor — a TipTap contenteditable with a sticky formatting
     toolbar (VideoPsalm's editing breadth, FreeShow's theme tokens). Emits the
     raw HTML to the parent on every change; `---` (a horizontal rule) splits
     slides exactly like the markdown mode. -->

<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { Editor } from "@tiptap/core"
    import StarterKit from "@tiptap/starter-kit"
    import Underline from "@tiptap/extension-underline"
    import TextStyle from "@tiptap/extension-text-style"
    import Color from "@tiptap/extension-color"
    import FontFamily from "@tiptap/extension-font-family"
    import TextAlign from "@tiptap/extension-text-align"
    import Link from "@tiptap/extension-link"
    import Subscript from "@tiptap/extension-subscript"
    import Superscript from "@tiptap/extension-superscript"
    import Placeholder from "@tiptap/extension-placeholder"
    import Highlight from "@tiptap/extension-highlight"
    import Table from "@tiptap/extension-table"
    import TableRow from "@tiptap/extension-table-row"
    import TableHeader from "@tiptap/extension-table-header"
    import TableCell from "@tiptap/extension-table-cell"
    import { FontSize } from "./fontSize"
    import { translateText } from "../../utils/language"
    import MaterialButton from "../inputs/MaterialButton.svelte"

    export let initial: string = ""
    export let placeholder: string = ""
    export let fontList: { label: string; value: string }[] = []
    export let onChange: (html: string) => void = (_html: string) => {}
    export let onShowNext: () => void = () => {}

    let host: HTMLDivElement
    let editor: Editor | null = null

    onMount(() => {
        editor = new Editor({
            element: host,
            extensions: [
                StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
                Underline,
                TextStyle,
                FontSize,
                Color,
                Highlight.configure({ multicolor: true }),
                FontFamily,
                TextAlign.configure({ types: ["heading", "paragraph"] }),
                Link.configure({ openOnClick: false, autolink: true }),
                Subscript,
                Superscript,
                Placeholder.configure({ placeholder: placeholder || translateText("freenote.type_rich") }),
                Table.configure({ resizable: true }),
                TableRow,
                TableHeader,
                TableCell
            ],
            content: initial || "<p></p>",
            autofocus: false,
            editorProps: {
                attributes: { class: "edit freenote-prosemirror", spellcheck: "false" },
                handleKeyDown(_view: any, event: KeyboardEvent) {
                    // Ctrl+Enter = show next slide live (same as the markdown mode)
                    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault()
                        onShowNext()
                        return true
                    }
                    return false
                }
            },
            onUpdate: () => {
                if (editor) onChange(editor.getHTML())
            },
            onSelectionUpdate: () => (state = readState()),
            onTransaction: () => (state = readState())
        })
    })

    onDestroy(() => {
        editor?.destroy()
        editor = null
    })

    export function focus() {
        editor?.chain().focus().run()
    }

    // toolbar active state, refreshed on every selection/transaction
    let state: { [key: string]: boolean } = {}
    function readState(): { [key: string]: boolean } {
        if (!editor) return {}
        return {
            bold: editor.isActive("bold") === true,
            italic: editor.isActive("italic") === true,
            underline: editor.isActive("underline") === true,
            strike: editor.isActive("strike") === true,
            bulletList: editor.isActive("bulletList") === true,
            orderedList: editor.isActive("orderedList") === true,
            subscript: editor.isActive("subscript") === true,
            superscript: editor.isActive("superscript") === true,
            alignLeft: editor.isActive({ textAlign: "left" }) === true,
            alignCenter: editor.isActive({ textAlign: "center" }) === true,
            alignRight: editor.isActive({ textAlign: "right" }) === true
        }
    }

    function run(command: (chain: any) => any) {
        if (!editor) return
        command(editor.chain().focus())
    }

    // heading level for the select
    let headingLevel = 0
    $: if (editor) headingLevel = editor.isActive("heading") ? (editor.getAttributes("heading").level || 0) : 0

    function onHeadingChange(e: Event) {
        const level = Number((e.target as HTMLSelectElement).value) || 0
        run((chain) => (level ? chain.toggleHeading({ level }) : chain.setParagraph()))
    }

    // font size (selection, or future typing when collapsed)
    let sizeInput = 100
    function onSizeInput(e: Event) {
        sizeInput = Number((e.target as HTMLInputElement).value) || 100
    }
    function onSizeKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") applySize()
    }
    function applySize() {
        run((chain) => chain.setFontSize(sizeInput))
    }

    function onFontFamily(e: Event) {
        const value = (e.target as HTMLSelectElement).value
        run((chain) => (value ? chain.setFontFamily(value) : chain.unsetFontFamily()))
    }

    function onColor(e: Event) {
        run((chain) => chain.setColor((e.target as HTMLInputElement).value))
    }

    function onHighlight(e: Event) {
        run((chain) => chain.setHighlight({ color: (e.target as HTMLInputElement).value }))
    }

    function toggleLink() {
        if (!editor) return
        const previousUrl = editor.getAttributes("link").href || ""
        const url = window.prompt(translateText("freenote.insert_link"), previousUrl || "https://")
        if (url === null) return
        if (!url.trim()) {
            editor.chain().focus().extendMarkRange("link").unsetLink().run()
            return
        }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim(), target: "_blank" }).run()
    }

    function insertTable() {
        run((chain) => chain.insertTable({ rows: 3, cols: 2, withHeaderRow: true }))
    }

    // slide break: a horizontal rule (`---` in markdown terms)
    function newSlideBreak() {
        run((chain) => chain.setHorizontalRule())
    }

    function clearFormatting() {
        run((chain) => chain.clearNodes().unsetAllMarks().setParagraph())
    }

    function undo() {
        editor?.chain().focus().undo().run()
    }
    function redo() {
        editor?.chain().focus().redo().run()
    }
</script>

<div class="rich-editor">
    <!-- FORMATTING TOOLBAR -->
    <div class="rich-toolbar">
        <MaterialButton small icon="undo" title="actions.undo" on:click={undo} />
        <MaterialButton small icon="redo" title="actions.redo" on:click={redo} />

        <span class="rich-toolbar-sep" />

        <MaterialButton small icon="add" title="freenote.slide_break" on:click={newSlideBreak} />

        <span class="rich-toolbar-sep" />

        <MaterialButton small icon="bold" title="freenote.bold" isActive={state.bold} on:click={() => run((c) => c.toggleBold())} />
        <MaterialButton small icon="italic" title="freenote.italic" isActive={state.italic} on:click={() => run((c) => c.toggleItalic())} />
        <MaterialButton small icon="underline" title="freenote.underline" isActive={state.underline} on:click={() => run((c) => c.toggleUnderline())} />
        <MaterialButton small icon="strikethrough" title="freenote.strikethrough" isActive={state.strike} on:click={() => run((c) => c.toggleStrike())} />
        <MaterialButton small icon="format" title="freenote.clear_formatting" on:click={clearFormatting} />

        <span class="rich-toolbar-sep" />

        <select class="rich-select" value={headingLevel} on:change={onHeadingChange} title={translateText("freenote.heading")}>
            <option value={0}>{translateText("freenote.heading_paragraph")}</option>
            <option value={1}>H1</option>
            <option value={2}>H2</option>
            <option value={3}>H3</option>
        </select>

        <span class="rich-toolbar-sep" />

        <MaterialButton small icon="list" title="freenote.bullet_list" isActive={state.bulletList} on:click={() => run((c) => c.toggleBulletList())} />
        <MaterialButton small icon="number" title="freenote.ordered_list" isActive={state.orderedList} on:click={() => run((c) => c.toggleOrderedList())} />
        <MaterialButton small icon="align" title="freenote.align_left" isActive={state.alignLeft} on:click={() => run((c) => c.setTextAlign("left"))} />
        <MaterialButton small icon="align" title="freenote.align_center" isActive={state.alignCenter} on:click={() => run((c) => c.setTextAlign("center"))} />
        <MaterialButton small icon="align" title="freenote.align_right" isActive={state.alignRight} on:click={() => run((c) => c.setTextAlign("right"))} />
        <MaterialButton small icon="select" title="freenote.subscript" isActive={state.subscript} on:click={() => run((c) => c.toggleSubscript())} />
        <MaterialButton small icon="arrow_up" title="freenote.superscript" isActive={state.superscript} on:click={() => run((c) => c.toggleSuperscript())} />

        <span class="rich-toolbar-sep" />

        <MaterialButton small icon="web" title="freenote.link" isActive={state.link} on:click={toggleLink} />
        <MaterialButton small title="freenote.table" on:click={insertTable}>
            Tbl
        </MaterialButton>

        <span class="rich-toolbar-sep" />

        <label class="rich-input" title={translateText("freenote.text_color")}>
            <span class="rich-input-icon">A</span>
            <input type="color" value="#ffffff" on:input={onColor} />
        </label>
        <label class="rich-input rich-highlight" title={translateText("freenote.highlight")}>
            <span class="rich-input-icon">H</span>
            <input type="color" value="#ffd63c" on:input={onHighlight} />
        </label>

        <span class="rich-toolbar-sep" />

        <label class="rich-size" title={translateText("freenote.font_size")}>
            <input type="number" class="rich-size-input" min="10" step="10" value={sizeInput} on:input={onSizeInput} on:keydown={onSizeKeydown} />
            <span class="rich-size-unit">px</span>
        </label>
        <select class="rich-select rich-font" title={translateText("freenote.font_family")} value="-1" on:change={onFontFamily}>
            <option value="-1" disabled>{translateText("freenote.font_family")}</option>
            {#each fontList as f}
                <option value={f.value}>{f.label}</option>
            {/each}
        </select>
    </div>

    <!-- EDITOR SURFACE -->
    <div class="freenote-editor-host" bind:this={host}></div>
</div>

<style>
    .rich-editor {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        gap: 8px;
    }

    .rich-toolbar {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
        padding: 4px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
    }

    .rich-toolbar-sep {
        width: 1px;
        height: 20px;
        margin: 0 4px;
        background: var(--primary-lighter);
        opacity: 0.5;
    }

    .rich-select {
        height: 30px;
        max-width: 100px;
        color: var(--text);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
        font-family: inherit;
        font-size: 0.82em;
        cursor: pointer;
    }
    .rich-select:focus {
        outline: none;
        border-color: var(--focus);
    }
    .rich-font {
        max-width: 130px;
    }

    .rich-input {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        height: 30px;
        padding: 0 4px;
        color: var(--text);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
    }
    .rich-input-icon {
        font-size: 0.8em;
        font-weight: bold;
    }
    .rich-input input[type="color"] {
        width: 22px;
        height: 20px;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
    }

    .rich-size {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        height: 30px;
        padding: 0 6px;
        color: var(--text);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
    }
    .rich-size-input {
        width: 48px;
        border: none;
        background: transparent;
        color: var(--text);
        font-family: inherit;
        font-size: 0.9em;
        text-align: right;
    }
    .rich-size-input:focus {
        outline: none;
    }
    .rich-size-input::-webkit-inner-spin-button {
        display: none;
    }
    .rich-size-unit {
        font-size: 0.72em;
        opacity: 0.6;
    }

    /* the editable surface */
    .freenote-editor-host {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        color: var(--text);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        padding: 12px;
    }
    .freenote-editor-host :global(.ProseMirror) {
        min-height: 100%;
        outline: none;
        font-family: inherit;
        font-size: 1.05em;
        line-height: 1.5;
        white-space: pre-wrap;
    }
    .freenote-editor-host :global(.ProseMirror p.is-editor-empty:first-child::before) {
        content: attr(data-placeholder);
        float: left;
        color: var(--text);
        opacity: 0.35;
        pointer-events: none;
        height: 0;
    }
    .freenote-editor-host :global(.ProseMirror hr) {
        border: none;
        border-top: 2px solid var(--secondary);
        margin: 20px 0;
    }
    .freenote-editor-host :global(.ProseMirror table) {
        border-collapse: collapse;
        width: 100%;
        margin: 8px 0;
    }
    .freenote-editor-host :global(.ProseMirror th),
    .freenote-editor-host :global(.ProseMirror td) {
        border: 1px solid var(--primary-lighter);
        padding: 4px 8px;
    }
    .freenote-editor-host :global(.ProseMirror a) {
        color: #6bc5ff;
        text-decoration: underline;
    }
</style>