<!-- FreeNote — the FreeShow quick-content studio. A default center view that
     replaces the show slides while active. Markdown in, live slides out. -->

<script lang="ts">
    import { onMount } from "svelte"
    import { getSystemFontsList } from "../helpers/fonts"
    import { focusedArea, freeNoteActive, freeNoteDrafts, freeNoteMode, freeNoteNow, freeNoteProjection, freeNoteSlides, resized, shows, showsCache, theme, themes } from "../../stores"
    import { translateText } from "../../utils/language"
    import { hexToRgb } from "../helpers/color"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../inputs/MaterialDropdown.svelte"
    import Center from "../system/Center.svelte"
    import SlideItems from "../slide/SlideItems.svelte"
    import Textbox from "../slide/Textbox.svelte"
    import { loadShows } from "../helpers/setShow"
    import { showToMarkdown, renderMarkdown } from "./markdown"
    import { FREE_NOTE_PROJECTIONS, htmlToMarkdown } from "./rich"
    import Editor from "./Editor.svelte"

    import {
        addMediaItem,
        createCameraItem,
        createClockItem,
        createMediaItem,
        createTimerItem,
        createWebItem,
        deleteDraft,
        exportHtml,
        exportMarkdown,
        exportRichHtml,
        exportRichMarkdown,
        FREENOTE_VERTICALS,
        FREENOTE_HORIZONTALS,
        freeNoteVertical,
        freeNoteHorizontal,
        freeNoteFont,
        freeNoteTemplates,
        getFreeNoteOutputs,
        getFreeNoteTemplate,
        freeNoteOpenShow,
        freeNoteResetToken,
        outputLabel,
        resetFreeNoteSession,
        restore,
        saveDraft,
        saveFreeNoteShow,
        scheduleHotRefresh,
        setFreeNoteShow,
        showSlideAtIndex,
        syncFreeNoteSlides,
        syncRichSlides
    } from "./freeNote"

    let src = ""
    let templateId = "full_announcement"
    let outputId = ""
    let openShowId = ""

    // rich / markdown editing mode (persisted in the draft + restored)
    $: mode = $freeNoteMode
    function setMode(next: "markdown" | "rich") {
        if (next === $freeNoteMode) return
        // convert the current source so nothing is lost when switching surfaces
        if (next === "rich") src = renderMarkdown(src)
        else src = htmlToMarkdown(src)
        $freeNoteMode = next
        editorKey += 1
        if ($freeNoteNow >= 0) freeNoteNow.set(-1)
        scheduleBuild(src)
    }

    // projection text treatment (outline / shadow / contrast) for on-air notes
    function setProjection(id: string) {
        $freeNoteProjection = id
        rebuild()
    }

    // bumped to remount the rich editor (new note / open show / mode switch)
    let editorKey = 0
    let editorRef: any

    let outputsList = getFreeNoteOutputs()
    $: outputsList = getFreeNoteOutputs()

    // vertical position of the text block (top / center / bottom)
    function setVertical(id: string) {
        $freeNoteVertical = id
        rebuild()
    }

    // block-level horizontal position (left / center / right)
    function setHorizontal(id: string) {
        $freeNoteHorizontal = id
        rebuild()
    }

    // default font family used for every typed line
    function setDefaultFont(family: string) {
        $freeNoteFont = family
        rebuild()
    }
    function onDefaultFontChange(e: Event) {
        setDefaultFont((e.target as HTMLSelectElement).value)
    }

    function rebuild() {
        scheduleBuild(src)
        if ($freeNoteNow >= 0) scheduleHotRefresh(src, templateId, outputId)
    }

    // collapsible editor
    let editorCollapsed = false
    function toggleEditor() {
        editorCollapsed = !editorCollapsed
    }

    // THEME-AWARE background
    let rgb = { r: 35, g: 35, b: 45 }
    $: if ($theme) updateColor()
    function updateColor() {
        const color = $themes[$theme]?.colors?.["primary"]
        if (!color) return
        const newRgb = hexToRgb(color)
        rgb = { r: Math.max(0, newRgb.r - 1), g: Math.max(0, newRgb.g - 5), b: Math.max(0, newRgb.b - 5) }
    }

    // DISPLAYABLE SLIDES — the freeNoteSlides mirror is the source of truth,
    // kept in sync with the source on a debounce (and with media additions).
    let buildTimer: ReturnType<typeof setTimeout> | null = null
    let dirty = true

    $: displayIndex = $freeNoteNow >= 0 ? $freeNoteNow : 0
    $: currentSlide = $freeNoteSlides[displayIndex]
    $: previewItems = currentSlide?.items || []

    // deterministic preview scale: fit the native 1920x1080 slide into the canvas
    let canvasWidth = 0
    $: ratio = canvasWidth > 0 ? Math.max(0.05, Math.min(1, canvasWidth / 1920)) : 0.5

    async function buildSlides(value: string) {
        const template = getFreeNoteTemplate(templateId)
        // sync into the real FreeNote show (showsCache) so autosave persists the
        // slides to disk — the builders alone only fill the in-memory mirror.
        // The builder follows the active mode: markdown text or rich HTML.
        const slides = $freeNoteMode === "rich" ? await syncRichSlides(value, template, outputId) : await syncFreeNoteSlides(value, template, outputId)
        if ($freeNoteNow >= slides.length) freeNoteNow.set(slides.length - 1)
        dirty = false
    }

    function scheduleBuild(value: string) {
        dirty = true
        if (buildTimer) clearTimeout(buildTimer)
        buildTimer = setTimeout(() => buildSlides(value), 300)
    }

    // RESTORE draft + sizes
    let openingExplicitNote = false
    onMount(() => {
        restore()
        const pending = $freeNoteOpenShow
        freeNoteOpenShow.set("")
        if (pending) {
            // the Ctrl+Shift+B shortcut asked us to open a specific note
            openingExplicitNote = true
            openShow(pending)
        } else {
            const draft = $freeNoteDrafts[0]
            if (draft?.src) src = draft.src
            scheduleBuild(src)
        }
        const savedWidth = $resized.freeNoteEditor
        if (typeof savedWidth === "number") editorWidth = savedWidth
        const savedHeight = $resized.freeNotePreview
        if (typeof savedHeight === "number") previewHeight = savedHeight
    })

    // Ctrl+Shift+B while FreeNote is already open: switch to a specific note
    $: if ($freeNoteOpenShow && $freeNoteActive && !openingExplicitNote) {
        const id = $freeNoteOpenShow
        freeNoteOpenShow.set("")
        openShow(id)
    }

    // "New note" shortcut: reset the editor to a blank session
    let lastResetToken = 0
    $: if ($freeNoteResetToken !== lastResetToken) {
        const token = $freeNoteResetToken
        lastResetToken = token
        if (token && $freeNoteActive) {
            freeNoteNow.set(-1)
            src = ""
            deleteDraft()
            editorKey += 1
            scheduleBuild("")
        }
    }

    // focus editor when opened via hotkey
    $: if ($freeNoteActive && $focusedArea === "free_note") {
        if ($freeNoteMode === "rich") {
            editorRef?.focus()
        } else {
            const el = document.getElementById("freenote-input")
            if (el) (el as HTMLTextAreaElement).focus()
        }
    }

    // OPEN an existing FreeShow into the editor (reverse: show -> markdown)
    async function openShow(id: string) {
        if (!id) return
        if (!$showsCache[id]) await loadShows([id])
        const show = $showsCache[id]
        if (!show) return
        // bind this session to the opened show so later syncs update it (not a duplicate)
        setFreeNoteShow(id)
        src = showToMarkdown(show) || ""
        // rich mode editors start from HTML: render the markdown representation
        if ($freeNoteMode === "rich") src = renderMarkdown(src)
        freeNoteNow.set(-1)
        editorKey += 1
        scheduleBuild(src)
        saveDraft(src)
    }

    function handleInput(e: Event) {
        src = (e.target as HTMLTextAreaElement).value
        scheduleBuild(src)
        scheduleHotRefresh(src, templateId, outputId)
        saveDraft(src)
    }

    // RICH editor -> raw HTML source (TipTap emits; we sanitize on build)
    function onRichChange(html: string) {
        src = html
        scheduleBuild(src)
        scheduleHotRefresh(src, templateId, outputId)
        saveDraft(src)
    }

    // --- FONT-EDITING TOOLBAR: operates on the current textarea selection ---
    let editorEl: HTMLTextAreaElement
    let selStart = 0
    let selEnd = 0
    function onSel() {
        if (!editorEl) return
        selStart = editorEl.selectionStart
        selEnd = editorEl.selectionEnd
    }
    function afterEdit(start: number, cursor: number) {
        scheduleBuild(src)
        scheduleHotRefresh(src, templateId, outputId)
        saveDraft(src)
        requestAnimationFrame(() => {
            if (!editorEl) return
            editorEl.focus()
            editorEl.setSelectionRange(start, cursor)
            selStart = start
            selEnd = cursor
        })
    }
    // bold / italic / underline wrap toggles around the selection
    function wrap(open: string, close: string) {
        const el = editorEl
        if (!el) return
        let start = el.selectionStart
        let end = el.selectionEnd
        const before = src.slice(0, start)
        const selected = src.slice(start, end)
        const afterText = src.slice(end)

        if (selected.startsWith(open) && selected.endsWith(close) && selected.length >= open.length + close.length) {
            // toggle off: unwrap
            const inner = selected.slice(open.length, selected.length - close.length)
            src = before + inner + afterText
            afterEdit(start, start + inner.length)
        } else if (selected) {
            // wrap the selected text
            src = before + open + selected + close + afterText
            afterEdit(start, start + open.length + selected.length + close.length)
        } else {
            // nothing selected: wrap the current line (like applySize/applyFont)
            const lineStart = src.lastIndexOf("\n", start - 1) + 1
            const lineEnd = src.indexOf("\n", end)
            const lineContent = src.slice(lineStart, lineEnd === -1 ? src.length : lineEnd)
            const newSrc = src.slice(0, lineStart) + open + lineContent + close + (lineEnd === -1 ? "" : src.slice(lineEnd))
            src = newSrc
            afterEdit(start + open.length, start + open.length + lineContent.length + close.length)
        }
    }
    // set an explicit inline font size (px) on the selection, or the current line
    let sizeInput = 100
    function onSizeInput(e: Event) {
        const input = e.target as HTMLInputElement
        sizeInput = Number(input.value) || 100
    }
    function onSizeKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") applySize(sizeInput)
    }
    function applySize(target: number) {
        const el = editorEl
        if (!el) return
        let size = Math.max(10, Math.round(target))
        sizeInput = size
        let start = el.selectionStart
        let end = el.selectionEnd
        if (start === end) {
            // expand to the current line
            const lineStart = src.lastIndexOf("\n", start - 1) + 1
            const lineEnd = src.indexOf("\n", end)
            start = lineStart
            end = lineEnd === -1 ? src.length : lineEnd
        }
        const before = src.slice(0, start)
        const selected = src.slice(start, end)
        const afterText = src.slice(end)
        const match = selected.match(/^\[size:(\d+)\]([\s\S]*)\[\/size\]$/)
        const inner = match ? match[2] : selected
        src = before + `[size:${size}]${inner}[/size]` + afterText
        afterEdit(start, start + `[size:${size}]`.length + inner.length)
    }

    // set an explicit font family on the selection (or the current line).
    // use the same fonts FreeShow itself offers (web fonts + loaded system fonts).
    const FONT_OPTIONS = ["CMGSans", "Georgia", "Times New Roman", "Arial", "Helvetica", "Verdana", "Courier New", "Impact", "Comic Sans MS"]
    let fontList: { label: string; value: string }[] = FONT_OPTIONS.map((f) => ({ label: f, value: `'${f}'` }))
    let fontSelect = ""
    onMount(() => {
        getSystemFontsList()
            .then((fonts) => {
                if (fonts?.length) fontList = fonts.map((f) => ({ label: f.label, value: f.value }))
            })
            .catch(() => {})
    })
    function onFontChange(e: Event) {
        const font = (e.target as HTMLSelectElement).value
        fontSelect = ""
        applyFont(font)
    }
    function applyFont(family: string) {
        if (!family) return
        const el = editorEl
        if (!el) return
        let start = el.selectionStart
        let end = el.selectionEnd
        if (start === end) {
            const lineStart = src.lastIndexOf("\n", start - 1) + 1
            const lineEnd = src.indexOf("\n", end)
            start = lineStart
            end = lineEnd === -1 ? src.length : lineEnd
        }
        const before = src.slice(0, start)
        const selected = src.slice(start, end)
        const afterText = src.slice(end)
        const match = selected.match(/^\[font:(.+)\]([\s\S]*)\[\/font\]$/)
        const inner = match ? match[2] : selected
        src = before + `[font:${family}]${inner}[/font]` + afterText
        afterEdit(start, start + `[font:${family}]`.length + inner.length)
    }

    function changeTemplate() {
        scheduleBuild(src)
        if ($freeNoteNow >= 0) scheduleHotRefresh(src, templateId, outputId)
    }
    function changeOutput() {
        scheduleBuild(src)
        if ($freeNoteNow >= 0) scheduleHotRefresh(src, templateId, outputId)
    }

    // KEYBOARD: Enter = newline · Shift+Enter / Ctrl+Enter = show next slide
    function onEditorKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && (e.shiftKey || e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            showNextSlide()
        }
    }

    // Sync the latest slides into the real show once, then broadcast slide `index`.
    async function showIndex(index: number) {
        if (!$freeNoteSlides.length) return
        const target = Math.max(0, Math.min(index, $freeNoteSlides.length - 1))
        if (dirty) {
            await buildSlides(src)
        }
        await showSlideAtIndex(target, outputId)
    }

    function showNextSlide() {
        showIndex($freeNoteNow + 1)
    }

    function onShowNext() {
        if ($freeNoteSlides.length && $freeNoteNow >= $freeNoteSlides.length - 1) {
            savedFlash("freenote.all_shown")
            return
        }
        showNextSlide()
    }

    // SAVE
    let savedMessage = ""
    let savedTimer: ReturnType<typeof setTimeout> | null = null
    function savedFlash(message: string) {
        savedMessage = translateText(message)
        if (savedTimer) clearTimeout(savedTimer)
        savedTimer = setTimeout(() => (savedMessage = ""), 2000)
    }
    async function onSave() {
        if (dirty || !$freeNoteSlides.length) {
            const template = getFreeNoteTemplate(templateId)
            await ($freeNoteMode === "rich" ? syncRichSlides(src, template, outputId) : syncFreeNoteSlides(src, template, outputId))
            dirty = false
        }
        const ok = saveFreeNoteShow()
        savedFlash(ok ? "freenote.saved" : "freenote.nothing_to_save")
    }

    // MEDIA STRIP
    let imageInput: HTMLInputElement
    let videoInput: HTMLInputElement
    let audioInput: HTMLInputElement

    function pickMedia(e: Event) {
        const input = e.target as HTMLInputElement
        const file = input.files?.[0]
        input.value = ""
        if (!file) return
        addMediaItem(createMediaItem((file as any).path || file.name))
    }

    function onDrop(e: DragEvent) {
        e.preventDefault()
        const files = Array.from(e.dataTransfer?.files || [])
        files.forEach((file) => addMediaItem(createMediaItem((file as any).path || file.name)))
    }

    function onPaste(e: ClipboardEvent) {
        const files = Array.from(e.clipboardData?.files || [])
        files.forEach((file) => addMediaItem(createMediaItem((file as any).path || file.name)))
    }

    // RESIZABLE PANES
    let dragging: null | { axis: "x" | "y"; start: number; startSize: number } = null
    let editorWidth = 620
    let previewHeight = 320

    $: resized.update((a) => ({ ...a, freeNoteEditor: editorWidth, freeNotePreview: previewHeight }))

    function startDragX(e: MouseEvent) {
        dragging = { axis: "x", start: e.clientX, startSize: editorWidth }
    }
    function startDragY(e: MouseEvent) {
        dragging = { axis: "y", start: e.clientY, startSize: previewHeight }
    }
    function onDragMove(e: MouseEvent) {
        if (!dragging) return
        if (dragging.axis === "x") {
            editorWidth = Math.max(260, Math.min(window.innerWidth - 480, dragging.startSize + (e.clientX - dragging.start)))
        } else {
            previewHeight = Math.max(120, Math.min(window.innerHeight - 320, dragging.startSize + (e.clientY - dragging.start)))
        }
    }
    function onDragEnd() {
        dragging = null
    }

    const templateOptions = freeNoteTemplates.map((t) => ({ label: translateText("freenote.template." + t.id), value: t.id }))
    $: showOptions = Object.entries($shows)
        .map(([id, s]) => ({ label: s?.name || id, value: id }))
        .sort((a, b) => a.label.localeCompare(b.label))

    function onNewSession() {
        resetFreeNoteSession()
        src = ""
        dirty = true
        editorKey += 1
    }
</script>

<svelte:window on:mouseup={onDragEnd} on:mousemove={onDragMove} />

<div class="freenote" style="--background: rgb({rgb.r} {rgb.g} {rgb.b} / 0.6);" on:drop|preventDefault={onDrop} on:dragover|preventDefault on:paste={onPaste}>
    <!-- HEADER -->
    <div class="header">
        <div class="title">
            <Icon id="edit" size={1.4} white />
            <span class="title-text">{translateText("freenote.title")}</span>
            <span class="hint">{translateText("freenote.hint_newline")}</span>
            <span class="hint">{translateText("freenote.hint_show")}</span>
            {#if mode === "rich"}
                <span class="hint">{translateText("freenote.hint_rich")}</span>
            {/if}
        </div>

        <div class="header-actions">
            <!-- RICH / MARKDOWN MODE -->
            <MaterialButton small isActive={mode === "markdown"} title="freenote.mode_markdown" on:click={() => setMode("markdown")}>MD</MaterialButton>
            <MaterialButton small isActive={mode === "rich"} title="freenote.mode_rich" on:click={() => setMode("rich")}>Aa</MaterialButton>

            <MaterialButton small icon="refresh" title="freenote.new_session" on:click={onNewSession} />
            <MaterialButton small variant="text" icon="close" title="actions.close" on:click={() => freeNoteActive.set(false)} />
        </div>
    </div>

    <!-- MAIN BODY -->
    <div class="body" class:collapsed={editorCollapsed}>
        <!-- EDITOR -->
        {#if !editorCollapsed}
            <div class="editor-pane" style="width: {editorWidth}px;">
                {#if mode === "rich"}
                    {#key editorKey}
                        <Editor bind:this={editorRef} initial={src} {fontList} onChange={onRichChange} onShowNext={showNextSlide} />
                    {/key}
                {:else}
                    <textarea id="freenote-input" class="edit editor" bind:this={editorEl} bind:value={src} on:input={handleInput} on:keydown={onEditorKeydown} on:keyup={onSel} on:click={onSel} on:select={onSel} placeholder={translateText("freenote.type_markdown")} spellcheck="false" />

                    <!-- FONT-EDITING TOOLBAR -->
                    <div class="format-toolbar">
                        <button class="fmt-btn" title={translateText("freenote.bold")} on:click={() => wrap("**", "**")}>
                            <b>B</b>
                        </button>
                        <button class="fmt-btn" title={translateText("freenote.italic")} on:click={() => wrap("*", "*")}>
                            <i>I</i>
                        </button>
                        <button class="fmt-btn" title={translateText("freenote.underline")} on:click={() => wrap("__", "__")}>
                            <u>U</u>
                        </button>
                        <span class="fmt-divider"></span>
                        <label class="fmt-size" title={translateText("freenote.font_size")}>
                            <input type="number" class="fmt-size-input" min="10" step="10" value={sizeInput} on:input={onSizeInput} on:keydown={onSizeKeydown} />
                            <span class="fmt-size-unit">px</span>
                        </label>
                        <button class="fmt-btn" title={translateText("freenote.apply_size")} on:click={() => applySize(sizeInput)}>Apply</button>
                        <span class="fmt-divider"></span>
                        <select class="fmt-font" title={translateText("freenote.font_family")} value={fontSelect} on:change={onFontChange}>
                            <option value="" disabled>{translateText("freenote.font_family")}</option>
                            {#each fontList as f}
                                <option value={f.value}>{f.label}</option>
                            {/each}
                        </select>
                    </div>
                {/if}

                <div class="controls">
                    <MaterialDropdown label="freenote.template" options={templateOptions} value={templateId} on:change={(e) => (templateId = e.detail) && changeTemplate()} />

                    <!-- DEFAULT FONT -->
                    <div class="align-row">
                        <span class="label">{translateText("freenote.default_font")}</span>
                        <select class="fmt-font" value={$freeNoteFont} on:change={onDefaultFontChange}>
                            <option value="">{translateText("freenote.default_font_default")}</option>
                            {#each fontList as f}
                                <option value={f.value}>{f.label}</option>
                            {/each}
                        </select>
                    </div>

                    <!-- VERTICAL POSITION -->
                    <div class="align-row">
                        <span class="label">{translateText("freenote.vertical")}</span>
                        {#each FREENOTE_VERTICALS as v}
                            <MaterialButton small isActive={$freeNoteVertical === v.id} on:click={() => setVertical(v.id)}>
                                {translateText(`freenote.vertical_${v.id}`)}
                            </MaterialButton>
                        {/each}
                    </div>

                    <!-- BLOCK-LEVEL HORIZONTAL POSITION -->
                    <div class="align-row">
                        <span class="label">{translateText("freenote.horizontal")}</span>
                        {#each FREENOTE_HORIZONTALS as h}
                            <MaterialButton small isActive={$freeNoteHorizontal === h.id} on:click={() => setHorizontal(h.id)}>
                                {translateText(`freenote.horizontal_${h.id}`)}
                            </MaterialButton>
                        {/each}
                    </div>

                    <!-- PROJECTION TEXT TREATMENT (on-air note styling) -->
                    <div class="align-row">
                        <span class="label">{translateText("freenote.projection")}</span>
                        {#each FREE_NOTE_PROJECTIONS as p}
                            <MaterialButton small isActive={$freeNoteProjection === p.id} on:click={() => setProjection(p.id)}>
                                {translateText(`freenote.projection_${p.label}`)}
                            </MaterialButton>
                        {/each}
                    </div>

                    <!-- OPEN EXISTING SHOW -->
                    <div class="outputs-row">
                        <span class="label">{translateText("freenote.open_show")}</span>
                        <MaterialDropdown label="freenote.open_show" options={showOptions} value={openShowId} on:change={(e) => ((openShowId = e.detail), openShow(e.detail), (openShowId = ""))} />
                    </div>

                    <!-- OUTPUT TARGETS -->
                    <div class="outputs-row">
                        <span class="label">{translateText("freenote.outputs")}</span>
                        <MaterialButton small isActive={outputId === ""} on:click={() => ((outputId = ""), changeOutput())}>
                            {translateText("freenote.all_outputs")}
                        </MaterialButton>
                        {#each outputsList as output}
                            <MaterialButton small isActive={outputId === output.id} on:click={() => ((outputId = output.id), changeOutput())}>
                                {outputLabel(output.id, outputsList)}
                            </MaterialButton>
                        {/each}
                    </div>

                    <!-- MEDIA STRIP -->
                    <div class="media-strip">
                        <span class="label">{translateText("freenote.media")}</span>
                        <MaterialButton small icon="image" title="freenote.image" on:click={() => imageInput?.click()} />
                        <MaterialButton small icon="video" title="freenote.video" on:click={() => videoInput?.click()} />
                        <MaterialButton small icon="audio" title="freenote.audio" on:click={() => audioInput?.click()} />
                        <MaterialButton small icon="camera" title="freenote.camera" on:click={() => addMediaItem(createCameraItem())} />
                        <MaterialButton small icon="web" title="freenote.web" on:click={() => addMediaItem(createWebItem())} />
                        <MaterialButton small icon="timer" title="freenote.timer" on:click={() => addMediaItem(createTimerItem())} />
                        <MaterialButton small icon="clock" title="freenote.clock" on:click={() => addMediaItem(createClockItem())} />
                    </div>
                </div>
            </div>

            <div class="divider-x" on:mousedown={startDragX} />
        {/if}

        <!-- PREVIEW + DISPLAYABLE SLIDES -->
        <div class="preview-pane">
            <div class="preview" style="height: {editorCollapsed ? '100%' : previewHeight + 'px'};">
                <div class="pane-label">
                    <span>{translateText("freenote.live_preview")}</span>
                    <MaterialButton small variant="text" icon={editorCollapsed ? "increase_text" : "decrease_text"} title="freenote.collapse" on:click={toggleEditor} />
                </div>
                {#if previewItems.length}
                    <div class="preview-canvas" bind:clientWidth={canvasWidth}>
                        <div class="fn-slide" style="background-color: {currentSlide?.settings.backgroundColor || 'black'}; transform: scale({ratio});">
                            {#each previewItems as item, i}
                                {#if item.type === "text" || item.type === undefined || ["events", "list"].includes(item.type || "")}
                                    <Textbox {item} itemIndex={i} {ratio} {outputId} slideIndex={displayIndex} ref={{ type: "show", id: "freenote", showId: "freenote", slideId: currentSlide?.id || "preview" }} fontPreview />
                                {:else}
                                    <SlideItems {item} {ratio} {outputId} slideIndex={displayIndex} ref={{ type: "show", id: "freenote", showId: "freenote", slideId: currentSlide?.id || "preview" }} />
                                {/if}
                            {/each}
                        </div>
                    </div>
                {:else}
                    <Center faded>
                        <span>{translateText("freenote.empty_preview")}</span>
                    </Center>
                {/if}
            </div>

            {#if !editorCollapsed}
                <div class="divider-y" on:mousedown={startDragY} />
            {/if}

            <!-- SLIDES THAT CAN BE DISPLAYED -->
            <div class="now-showing">
                <div class="pane-label">
                    <span>{translateText("freenote.slides")}</span>
                    <span class="pane-count">{$freeNoteSlides.length}</span>
                </div>
                {#if $freeNoteSlides.length}
                    <div class="strip">
                        {#each $freeNoteSlides as slide, i}
                            <button class="strip-item" class:active={i === displayIndex} on:click={() => showIndex(i)}>
                                <span class="strip-num">{i + 1}</span>
                                <span class="strip-name">{slide.name}</span>
                                {#if i === displayIndex}
                                    <span class="strip-live">●</span>
                                {/if}
                            </button>
                        {/each}
                    </div>
                {:else}
                    <Center faded>
                        <span>{translateText("freenote.nothing_showing")}</span>
                    </Center>
                {/if}
            </div>
        </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
        <MaterialButton variant="text" icon="decrease_text" title="freenote.collapse" on:click={toggleEditor} />
        {#if $freeNoteDrafts[0]}
            <MaterialButton variant="text" icon="close" title="freenote.clear_draft" on:click={() => deleteDraft()} />
        {/if}
        {#if savedMessage}
            <span class="saved-message">{savedMessage}</span>
        {/if}
        <div class="footer-spacer" />
        <MaterialButton variant="text" icon="save" title="freenote.save" on:click={onSave}>
            {translateText("freenote.save")}
        </MaterialButton>
        <MaterialButton variant="outlined" icon="download" title="freenote.export_md" on:click={() => (mode === "rich" ? exportRichMarkdown(src) : exportMarkdown(src))}>
            {translateText("freenote.export_md")}
        </MaterialButton>
        <MaterialButton variant="outlined" icon="download" title="freenote.export_html" on:click={() => (mode === "rich" ? exportRichHtml(src) : exportHtml(src))}>
            {translateText("freenote.export_html")}
        </MaterialButton>
        <MaterialButton variant="contained" icon="play" title="freenote.show_next" on:click={onShowNext}>
            {translateText("freenote.show_next")}
        </MaterialButton>
    </div>

    <input type="file" accept="image/*" bind:this={imageInput} style="display:none;" on:change={(e) => pickMedia(e)} />
    <input type="file" accept="video/*" bind:this={videoInput} style="display:none;" on:change={(e) => pickMedia(e)} />
    <input type="file" accept="audio/*" bind:this={audioInput} style="display:none;" on:change={(e) => pickMedia(e)} />
</div>

<style>
    .freenote {
        position: absolute;
        inset: 0;
        z-index: 50;

        display: flex;
        flex-direction: column;

        background-color: var(--background);
    }

    /* HEADER */
    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;

        padding: 8px 14px;

        background: var(--primary);
        border-bottom: 2px solid var(--focus);
    }
    .title {
        display: flex;
        align-items: center;
        gap: 12px;

        color: var(--text);
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    .title-text {
        font-size: 1.05em;
    }
    .hint {
        font-size: 0.62em;
        font-weight: 500;
        letter-spacing: 1px;
        opacity: 0.6;
        text-transform: uppercase;
    }
    .header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    /* BODY */
    .body {
        display: flex;
        flex: 1;
        min-height: 0;
    }

    /* EDITOR */
    .editor-pane {
        display: flex;
        flex-direction: column;
        min-width: 0;
        padding: 10px;
        gap: 8px;
        overflow: hidden;
    }
    .editor {
        flex: 1;
        min-height: 0;
        resize: none;

        color: var(--text);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;

        padding: 10px;
        font-family: inherit;
        font-size: 1.05em;
        line-height: 1.5;
    }
    .editor:focus {
        outline: none;
        background: rgba(255, 255, 255, 0.08);
        border-color: var(--focus);
    }

    .controls {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .format-toolbar {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
    }
    .fmt-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 30px;
        height: 30px;
        padding: 0 8px;
        color: var(--text);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
        cursor: pointer;
        font-family: inherit;
        font-size: 1em;
        transition: background 0.12s ease;
    }
    .fmt-btn:hover {
        background: rgba(255, 255, 255, 0.14);
        border-color: var(--focus);
    }
    .fmt-btn .small {
        font-size: 0.72em;
        margin-left: 1px;
    }
    .fmt-size {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        color: var(--text);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
        padding: 0 6px;
        height: 30px;
    }
    .fmt-size-input {
        width: 48px;
        height: 100%;
        border: none;
        background: transparent;
        color: var(--text);
        font-family: inherit;
        font-size: 0.9em;
        text-align: right;
    }
    .fmt-size-input:focus {
        outline: none;
    }
    .fmt-size-input::-webkit-inner-spin-button {
        display: none;
    }
    .fmt-size-unit {
        font-size: 0.72em;
        opacity: 0.6;
    }
    .fmt-font {
        height: 30px;
        max-width: 150px;
        color: var(--text);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
        font-family: inherit;
        font-size: 0.82em;
        cursor: pointer;
    }
    .fmt-font:focus {
        outline: none;
        border-color: var(--focus);
    }
    .fmt-divider {
        width: 1px;
        height: 20px;
        margin: 0 4px;
        background: var(--primary-lighter);
        opacity: 0.5;
    }

    .outputs-row,
    .align-row,
    .media-strip {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
    }
    .label {
        font-size: 0.72em;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 1px;
        opacity: 0.5;
        margin-right: 4px;
    }

    /* DIVIDERS */
    .divider-x {
        width: 6px;
        cursor: ew-resize;
        background: var(--primary-lighter);
        opacity: 0.4;
        transition: opacity 0.2s ease;
    }
    .divider-x:hover {
        opacity: 1;
    }
    .divider-y {
        height: 6px;
        cursor: ns-resize;
        background: var(--primary-lighter);
        opacity: 0.4;
        transition: opacity 0.2s ease;
    }
    .divider-y:hover {
        opacity: 1;
    }

    /* PREVIEW */
    .preview-pane {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
        padding: 10px;
        gap: 8px;
        overflow: hidden;
    }
    .pane-label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;

        font-size: 0.72em;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--text);
        opacity: 0.7;
        border-bottom: 1px solid var(--primary-lighter);
        padding-bottom: 4px;
    }
    .preview {
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
    }
    .preview-canvas {
        flex: 1;
        min-height: 0;
        overflow: hidden;
        border-radius: 8px;
        position: relative;
        display: flex;
        align-items: flex-start;
    }
    .fn-slide {
        position: absolute;
        top: 0;
        left: 0;
        width: 1920px;
        height: 1080px;
        transform-origin: top left;
        border-radius: 6px;
        overflow: hidden;
    }
    .fn-slide :global(.item) {
        position: absolute;
        color: white;
        font-size: 100px;
        line-height: 1.1;
        font-family: "CMGSans";
        text-shadow: 2px 2px 10px #000000;
        -webkit-text-stroke-color: #000000;
        paint-order: stroke fill;
        border-style: solid;
        border-width: 0px;
        border-color: #ffffff;
    }

    /* SLIDES THAT CAN BE DISPLAYED */
    .now-showing {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }
    .pane-count {
        opacity: 0.6;
    }
    .strip {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        padding: 6px 2px;
    }
    .strip-item {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 0 0 auto;
        max-width: 220px;

        padding: 6px 10px;
        border-radius: 6px;
        border: 1px solid var(--primary-lighter);
        background: rgba(255, 255, 255, 0.04);
        color: var(--text);
        cursor: pointer;
        text-align: start;
    }
    .strip-item:hover {
        background: rgba(255, 255, 255, 0.08);
    }
    .strip-item.active {
        border-color: var(--secondary);
        background: rgba(255, 255, 255, 0.1);
    }
    .strip-num {
        flex: 0 0 auto;
        font-size: 0.75em;
        font-weight: bold;
        opacity: 0.6;
    }
    .strip-name {
        flex: 1;
        min-width: 0;
        font-size: 0.85em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .strip-live {
        flex: 0 0 auto;
        color: var(--secondary);
        font-size: 0.7em;
    }

    /* FOOTER */
    .footer {
        display: flex;
        align-items: center;
        gap: 8px;

        padding: 10px 14px;
        border-top: 1px solid var(--primary-lighter);
        background: var(--primary);
    }
    .footer-spacer {
        flex: 1;
    }
    .saved-message {
        font-size: 0.75em;
        font-weight: bold;
        color: var(--secondary);
        text-transform: uppercase;
        letter-spacing: 1px;
    }
</style>
