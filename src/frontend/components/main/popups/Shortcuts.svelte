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
        // "": `${ctrl} + g`,
        "popup.history": `${ctrl} + h`,
        "edit._title_italic": `${ctrl} + i`,
        "actions.import": `${ctrl} + i`,
        // "": `${ctrl} + j`,
        // "": `${ctrl} + k`,
        "preview._lock": `${ctrl} + l`,
        "actions.mute": `${ctrl} + m`,
        "new.show": `${ctrl} + n`,
        "actions.toggle_output": `${ctrl} + o`,
        // "new.project": `${ctrl} + p`,
        // "this_is_default_mac_close!": `${ctrl} + q`,
        "preview._update": `${ctrl} + r`,
        "actions.save": `${ctrl} + s`,
        "actions.toggle_panels": `${ctrl} + t`,
        "edit._title_underline": `${ctrl} + u`,
        "actions.paste": `${ctrl} + v`,
        // "": `${ctrl} + w`,
        "actions.cut": `${ctrl} + x`,
        "actions.redo": `${ctrl} + y`,
        "actions.undo": `${ctrl} + z`,
        "popup.shortcuts": `${ctrl} + ?`,

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
    }

    hr {
        height: 3px;
        border: none;
        margin: 10px 0;
        background-color: var(--primary-lighter);
    }

    .shortcut {
        background-color: var(--primary-darker);
        padding: 5px 10px;
        text-transform: uppercase;
        border: 3px solid var(--primary-lighter);
        min-width: 150px;
        text-align: center;
    }
</style>
