<script>
    import { os } from "../../../stores"
    import T from "../../helpers/T.svelte"

    const ctrl = $os.platform === "darwin" ? "cmd" : "ctrl"

    const shortcuts = {
        "actions.selectAll": `${ctrl} + a`,
        "edit._title_bold": `${ctrl} + b`,
        "actions.copy": `${ctrl} + c`,
        "actions.duplicate": `${ctrl} + d`,
        "actions.toggle_drawer": `${ctrl} + d`,
        "actions.export": `${ctrl} + e`,
        "main.search": `${ctrl} + f`,
        "main.quick_search": `${ctrl} + g`,
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
        "actions.redo": `${ctrl} + y`,
        "actions.undo": `${ctrl} + z`,
        "popup.shortcuts": `${ctrl} + ?`,

        shift: "SEPERATOR",

        "actions.focus_mode": `${ctrl} + shift + f`,

        clear: "SEPERATOR",

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
        "actions.fullscreen": "f11",

        // presenterKeys: "SEPERATOR",

        num: "SEPERATOR",

        // arrow keys, space, tabs, enter, ...
        "actions.change_tab": "num",
        "actions.change_drawer_tab": `${ctrl} + num`,
        "actions.change_slide": "← / →",
        "actions.change_project_item": "↑ / ↓",
        "actions.change_drawer_item": `${ctrl} + ← / →`,
        "actions.change_drawer_category": `${ctrl} + ↑ / ↓`,
    }
</script>

<main>
    {#each Object.entries(shortcuts) as [id, shortcut]}
        {#if shortcut === "SEPERATOR"}
            <hr />
        {:else}
            <div>
                <p><T {id} /></p>
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

    hr {
        background-color: var(--primary-lighter);

        height: 3px;
        border: none;
        margin: 10px 0;

        opacity: 0.7;
    }

    .shortcut {
        background-color: var(--primary-darker);
        border: 3px solid var(--primary-lighter);

        font-size: 0.9em;
        text-align: center;
        text-transform: uppercase;

        padding: 4px 10px;
        min-width: 160px;
    }
</style>
