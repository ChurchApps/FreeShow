<script lang="ts">
    import { Main } from "../../../types/IPC/Main"
    import { sendMain } from "../../IPC/main"
    import { activeShow, showNotesActive, showsCache } from "../../stores"
    import { DEFAULT_WIDTH } from "../../utils/common"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import { _show } from "../helpers/shows"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import Resizeable from "../system/Resizeable.svelte"
    import Notes from "./tools/Notes.svelte"

    $: showId = $activeShow?.id
    $: currentShow = $showsCache[showId || ""]
    let currentLayout: string | null = null
    let note = ""
    $: if (showId && currentShow?.settings?.activeLayout !== currentLayout && $showNotesActive !== undefined) updateNote()

    function updateNote() {
        if (!showId) return
        note = showId ? _show().layouts("active").get("notes")[0] || "" : ""
        currentLayout = currentShow?.settings?.activeLayout
    }

    function edit(e: any) {
        if (!showId || currentShow?.layouts[currentShow?.settings?.activeLayout].notes === e.detail) return
        _show().layouts("active").set({ key: "notes", value: e.detail })

        updateNote()
    }

    // make links clickable
    function formatLinks(text: string) {
        return text
            .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g, (_match, label, link, rawUrl) => {
                const url = link || rawUrl
                let preview = label || rawUrl
                preview = preview.replace(/^https?:\/\//, "")
                if (preview.length > 35) preview = preview.slice(0, 35) + "..."

                return `<a href="${url}" data-title="${url}" target="_blank" rel="noopener noreferrer">${preview}</a>`
            })
            .replaceAll("\n", "&nbsp;")
    }

    const notesClick = (e: Event) => {
        if (e.target?.closest("a")) {
            e.preventDefault()
            const url = (e.target as HTMLElement).closest("a")?.getAttribute("href") || ""
            sendMain(Main.URL, url)
            return
        }

        showNotesActive.set(true)
    }

    // $: reference = currentShow?.reference?.type
    // $: if (reference === "lessons") showNotesActive.set(true)
</script>

{#if $showNotesActive}
    <Resizeable id="notes" side="bottom" defaultWidth={DEFAULT_WIDTH * 0.5} maxWidth={DEFAULT_WIDTH * 0.8} minWidth={47}>
        <div class="dark" style="display: contents;">
            <Notes on:edit={edit} value={note} />
        </div>

        <MaterialButton title="actions.close" on:click={() => ($showNotesActive = false)} style="position: absolute;top: 9px;right: 4.5px;opacity: 0.8;padding: 8px;" white>
            <Icon id={note ? "remove" : "close"} white />
        </MaterialButton>
    </Resizeable>
{:else if note}
    <span class="notes" role="none" data-title={translateText("tools.notes")} on:click={(e) => notesClick(e)}>
        <Icon id="notes" size={0.8} right white />
        <p>{@html formatLinks(note)}</p>
    </span>
{/if}

<style>
    .dark :global(.paper) {
        background-color: var(--primary-darkest);
    }

    .notes {
        background-color: var(--primary-darkest);
        border-top: 1px solid var(--primary-lighter);
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;

        padding: 0 8px;
        min-height: 30px;

        display: flex;
        align-items: center;

        opacity: 0.9;
        font-size: 0.9em;
    }

    .notes p :global(*) {
        display: inline;
    }

    .notes :global(a) {
        color: var(--text);
        opacity: 0.7;

        display: inline-flex;
        gap: 5px;
        align-items: flex-end;

        -webkit-user-drag: none;
    }
    .notes :global(a:hover) {
        opacity: 0.75;
    }
    .notes :global(a:active) {
        opacity: 0.9;
    }
</style>
