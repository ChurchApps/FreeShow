<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import { special } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextarea from "../../inputs/MaterialTextarea.svelte"

    function openFile() {
        sendMain(Main.OPEN_NOW_PLAYING)
    }

    function updateSpecial(key: string, value: any) {
        special.update((a) => {
            a[key] = value
            return a
        })
    }

    // WIP add more: see ICommonTagsResult
    const dynamicValues = {
        artist: { label: "Artist name" },
        title: { label: "Track title" },
        album: { label: "Album name" },
        year: { label: "Release year" },

        artwork_path: { label: "File path to artwork PNG image" },
        artwork_base64: { label: "Artwork in base64 data" },

        // WIP current time
        // time: { label: "Current time in MM:SS" },
        // time_s: { label: "Current time in seconds" },
        duration: { label: "Duration in MM:SS" },
        duration_s: { label: "Duration in seconds" }
    }

    // WIP presets
    // const presets = {
    //     MegaSeg: "{artist} - {title} - {album}",
    //     AudioHijack: `
    //         Title: {title}
    //         Artist: {artist}
    //         Album: {album}
    //         ArtworkData: {artwork_base64}
    //         Artwork: {artwork_path}
    //         Time: {time}
    //     `
    // }

    const DEFAULT_FORMAT = `{artist} - {title} - {album}`
    let format = $special.nowPlayingFormat ?? DEFAULT_FORMAT

    function addValueAtCaret(value: string) {
        const textarea: HTMLTextAreaElement = document.querySelector("textarea")!
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = textarea.value

        textarea.value = text.substring(0, start) + value + text.substring(end)
        format = textarea.value

        // move caret
        const caretPos = start + value.length
        textarea.selectionStart = caretPos
        textarea.selectionEnd = caretPos

        // trigger change
        updateSpecial("nowPlayingFormat", textarea.value)
    }
</script>

<MaterialButton class="popup-options" icon="launch" iconSize={1.1} title="main.system_open" on:click={openFile} white />

<InputRow arrow open={true}>
    <div class="title">
        <T id="popup.dynamic_values" />
    </div>

    <div slot="menu">
        <div class="values">
            {#each Object.entries(dynamicValues) as [key, data]}
                <div class="value">
                    <span>{data.label}</span>
                    <span style="opacity: 0.6;cursor: pointer;" role="none" on:click={() => addValueAtCaret(`{${key}}`)}>{"{"}{key}{"}"}</span>
                </div>
            {/each}
        </div>
    </div>
</InputRow>

<div style="height: 20px;"></div>

<MaterialTextarea label="actions.format" value={format} rows={8} on:change={(e) => updateSpecial("nowPlayingFormat", e.detail)} />

<style>
    .title {
        background-color: var(--primary-darkest);
        width: 100%;
        padding: 0 12px;

        display: flex;
        align-items: center;
    }

    .values {
        background-color: var(--primary-darkest);
        padding: 0 12px;
        padding-bottom: 12px;

        border-bottom-left-radius: 4px;
        border-bottom-right-radius: 4px;

        display: flex;
        flex-direction: column;
        gap: 1px;

        font-size: 0.9em;
        opacity: 0.9;
    }

    .value {
        display: flex;
        justify-content: space-between;
        gap: 5px;

        padding-bottom: 2px;
        border-bottom: 1px solid var(--primary-darker);
    }
</style>
