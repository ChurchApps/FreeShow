<script>
    import { IMPORT } from "../../../../types/Channels"
    import { convertText } from "../../../converters/txt"
    import { activePopup, alertMessage } from "../../../stores"
    import { send } from "../../../utils/request"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"

    // TODO: program icons

    const show_formats = [
        { name: "Clipboard", id: "clipboard" },
        { name: "Text file", extensions: ["txt"], id: "txt" },
        { name: "PDF", extensions: ["pdf"], id: "pdf" },
        { name: "PowerPoint", extensions: ["ppt", "pptx"], id: "powerpoint" },
        { name: "FreeShow", extensions: ["show"], id: "freeshow" },
        { name: "ProPresenter", extensions: ["pro4", "pro5", "pro6", "json"], id: "propresenter" }, // "pro"
        {
            name: "EasyWorship",
            extensions: ["db"],
            id: "easyworship",
            tutorial: "Import the SongsWords.db file from the Data folder<br>Optionally select Songs.db to import title/metadata",
        },
        {
            name: "VideoPsalm",
            extensions: ["json"],
            id: "videopsalm",
            tutorial: "1. Find the .vpc or .json file(s)<br>2. If it's .vpc, add .zip to the end & extract<br>3. Import the .json file",
        },
        { name: "OpenLP (OpenLyrics)", extensions: ["xml"], id: "openlp" },
        { name: "OpenSong", extensions: [], id: "opensong" },
    ]

    const formats = [
        { name: "Project", extensions: ["project", "shows"], id: "freeshow_project", icon: "freeshow" },
        // TODO: import calendar
        { name: "Calendar", extensions: ["ics"], id: "calendar" },
    ]
</script>

<!-- TODO: drop area: -->

<h3>Show</h3>
<div>
    {#each show_formats as format}
        <Button
            style="width: 25%;flex-direction: column;min-height: 180px;"
            on:click={() => {
                if (format.extensions) {
                    send(IMPORT, [format.id], format)
                    if (format.tutorial) {
                        alertMessage.set(format.tutorial)
                        activePopup.set("alert")
                    } else activePopup.set(null)
                } else {
                    // clipboard
                    navigator.clipboard
                        .readText()
                        .then((text) => {
                            convertText({ text })
                        })
                        .catch((err) => {
                            console.error("Failed to read clipboard contents: ", err)
                        })
                    activePopup.set(null)
                }
            }}
            center
        >
            <img src="./import-logos/{format.icon || format.id}.png" alt="{format.id}-logo" />
            <p>{format.name}</p>
        </Button>
    {/each}
</div>

<h3><T id="settings.other" /></h3>
<div>
    {#each formats as format}
        <Button
            style="width: 25%;flex-direction: column;min-height: 180px;"
            on:click={() => {
                send(IMPORT, [format.id], format)
                if (format.tutorial) {
                    alertMessage.set(format.tutorial)
                    activePopup.set("alert")
                } else activePopup.set(null)
            }}
            center
        >
            <img src="./import-logos/{format.icon || format.id}.png" alt="{format.id}-logo" />
            <p>{format.name}</p>
        </Button>
    {/each}
</div>

<style>
    div {
        display: flex;
        flex-wrap: wrap;
    }

    img {
        height: 100px;
        padding: 10px;
    }

    h3 {
        text-transform: uppercase;
        font-size: 0.9em;
        /* color: var(--text); */
    }
</style>
