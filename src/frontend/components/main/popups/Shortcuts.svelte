<script>
    import { os } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import HRule from "../../input/HRule.svelte"

    const ctrl = $os.platform === "darwin" ? "cmd" : "ctrl"
    const alt = $os.platform === "darwin" ? "option" : "alt"

    const shortcuts = {
        "actions.selectAll": `${ctrl} + a`,
        "edit._title_bold": `${ctrl} + b`,
        "actions.copy": `${ctrl} + c`,
        "actions.duplicate": `${ctrl} + d`,
        "actions.toggle_drawer": `${ctrl} + d`,
        "actions.export": `${ctrl} + e`,
        "main.search": `${ctrl} + f`,
        "actions.find_replace": `${ctrl} + f`, // only in editor
        "main.quick_search": `${ctrl} + g`, // also F8
        "popup.history": `${ctrl} + h`,
        "edit._title_italic": `${ctrl} + i`,
        "actions.import": `${ctrl} + i`,
        // "": `${ctrl} + j`,
        // "": `${ctrl} + k`,
        "preview._lock": `${ctrl} + l`,
        "actions.mute": `${ctrl} + m`,
        "new.create": `${ctrl} + n`,
        "actions.toggle_output_windows": `${ctrl} + o`,
        // "new.project": `${ctrl} + p`,
        // "this_is_default_mac_close!": `${ctrl} + q`,
        "preview._update": `${ctrl} + r`,
        "actions.save": `${ctrl} + s`,
        "actions.toggle_panels": `${ctrl} + t`,
        "edit._title_underline": `${ctrl} + u`,
        "actions.paste": `${ctrl} + v`,
        // "": `${ctrl} + w`, // closing something
        "actions.cut": `${ctrl} + x`,
        "actions.redo": `${ctrl} + y`, // or Ctrl+Shift+Z
        "actions.undo": `${ctrl} + z`,
        "popup.shortcuts": `${ctrl} + ?`,

        shift: "SEPARATOR",

        "actions.focus_mode": `${ctrl} + shift + f`,
        // "new.show": `${ctrl} + shift + n`, // normally Ctrl+n
        "show.change_view": `${ctrl} + shift + v`,

        ctrl_alt: "SEPARATOR",

        "Show Import from Clipboard": `${ctrl} + ${alt} + i`,

        alt: "SEPARATOR",

        "actions.cut_in_half": `${alt} + enter`,
        // "actions.delete": "del / backspace",

        clear: "SEPARATOR",

        "actions.remove_selection": "esc",
        "clear.all": "esc",
        // "clear.all": ".",
        "clear.background": "f1",
        "actions.rename": "f2",
        "clear.slide": "f2",
        "clear.overlays": "f3",
        "clear.audio": "f4",
        // "preview._next_slide": "f5",
        // "preview._next_slide": "Arrow Right",

        // "clear.nextTimer": "f5",
        // "from start": "f5",
        // MAC: cmd + shift + f
        // "main.quick_search": "f8",
        // F11 does not mean fullscreen on macOS (shortcuts.ts)
        ...($os.platform === "darwin" ? {} : { "actions.fullscreen": "f11" }),

        // presenterKeys: "SEPARATOR",

        num: "SEPARATOR",

        // arrow keys, space, tabs, enter, ...
        "actions.change_tab": "num",
        "actions.change_drawer_tab": `${ctrl} + num`,
        "actions.change_slide": "← / →",
        // "preview._next_slide": "→ / PgDn", // space / f5
        // "preview._previous_slide": "← / PgUp",
        "actions.change_project_item": "↑ / ↓",
        "actions.change_drawer_item": `${ctrl} + ← / →`,
        "actions.change_drawer_category": `${ctrl} + ↑ / ↓`,

        "tabs.search_tip": "SEPARATOR",

        "context.addToProject": `Enter`,
        "media.play": `${ctrl} + Enter`
    }
</script>

<main>
    {#each Object.entries(shortcuts) as [id, shortcut]}
        {#if shortcut === "SEPARATOR"}
            <HRule title={id.includes(".") ? translateText(id) : ""} />
        {:else}
            <div>
                <p>{translateText(id)}</p>
                <span class="shortcut">{shortcut}</span>
            </div>
        {/if}
    {/each}
</main>

<style>
    main {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    main div {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding-inline-start: 10px;
    }
    main div:nth-child(odd) {
        background-color: rgb(0 0 20 / 0.08);
    }

    .shortcut {
        background-color: var(--primary-darker);
        border: 2px solid var(--primary-lighter);
        border-radius: 3px;

        font-size: 0.9em;
        text-align: center;
        text-transform: uppercase;

        padding: 4px 10px;
        min-width: 160px;
    }
</style>
