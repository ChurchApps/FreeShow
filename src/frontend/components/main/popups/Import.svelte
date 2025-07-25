<script lang="ts">
    import { tick } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { Popups } from "../../../../types/Main"
    import { importFromClipboard } from "../../../converters/importHelpers"
    import { sendMain } from "../../../IPC/main"
    import { activePopup, alertMessage, dataPath, os } from "../../../stores"
    import { translate } from "../../../utils/language"
    import { presentationExtensions } from "../../../values/extensions"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"

    const freeshow_formats = [
        { name: "$formats.show", extensions: ["show", "json"], id: "freeshow" },
        { name: "$formats.project", extensions: ["project", "shows", "json", "zip"], id: "freeshow_project" }, // , "fsproject", "fsp"
        { name: "$formats.template", extensions: ["fstemplate", "fst", "template", "json", "zip"], id: "freeshow_template" },
        { name: "$formats.theme", extensions: ["fstheme", "theme", "json"], id: "freeshow_theme" }
        // { name: "Calendar", extensions: ["ics"], id: "calendar" }, // calendar drawer tab
        // { name: "Scripture", id: "scripture" }, // scripture drawer tab
    ]

    const text_formats: { name: string; extensions: string[]; id: string; shortcut?: string; tutorial?: string; popup?: Popups }[] = [
        { name: "$formats.clipboard", extensions: [], id: "clipboard", shortcut: "Ctrl+Alt+I" },
        { name: "$formats.text", extensions: ["txt"], id: "txt" },
        { name: "CSV", extensions: ["csv"], id: "csv" },
        { name: "ChordPro", extensions: ["cho", "crd", "chopro", "chordpro", "chord", "pro", "txt", "onsong"], id: "chordpro" },
        {
            name: "PowerPoint",
            extensions: ["ppt", "pptx"],
            id: "powerpoint",
            tutorial:
                "This will import the plain text as a show." +
                ($os.platform === "linux" ? "" : " If you would like to use a PowerPoint/Keynote presentation with FreeShow, please choose the media import option, or drag and drop it into your project.") +
                " Or you can import directly as PDF or images if you don't need animations."
        },
        { name: "Word", extensions: ["doc", "docx"], id: "word" },
        { name: "ProPresenter", extensions: ["pro4", "pro5", "pro6", "pro", "json", "proBundle"], id: "propresenter" },
        {
            name: "EasyWorship",
            extensions: ["db"],
            id: "easyworship",
            tutorial: "Import the SongsWords.db file from the Data folder - Often located in the Documents folder<br>Optionally select Songs.db to import title/metadata"
        },
        {
            name: "VideoPsalm",
            extensions: ["json", "vpc"],
            id: "videopsalm",
            tutorial: "Find the .vpc or .json file(s) often located in Documents\\VideoPsalm\\Songbooks"
        },
        { name: "OpenLP/OpenLyrics", extensions: ["xml", "sqlite"], id: "openlp" },
        { name: "OpenSong", extensions: [], id: "opensong" },
        { name: "MediaShout", extensions: ["ssc", "xml", "mdb"], id: "mediashout" }, // SSC (Songs5.mdb)
        { name: "Quelea", extensions: ["xml", "qsp"], id: "quelea" },
        { name: "SoftProjector", extensions: ["sps"], id: "softprojector" },
        { name: "Songbeamer", id: "songbeamer", extensions: [], popup: "songbeamer_import" },
        { name: "Easyslides", extensions: ["xml"], id: "easyslides" },
        { name: "VerseVIEW", extensions: ["xml"], id: "verseview" }
    ]

    const media_formats = [
        { name: "PDF", extensions: ["pdf"], id: "pdf" },
        { name: "PowerPoint/Keynote", extensions: presentationExtensions, id: "powerkey" },
        { name: "Lessons.church", extensions: ["json", "olp", "olf"], id: "lessons" }
    ]

    function displayTutorial(format: any) {
        if (!format.tutorial) {
            activePopup.set(null)
            return
        }

        alertMessage.set(format.tutorial)
        activePopup.set("alert")
    }
</script>

<h3>FreeShow</h3>
<div style="margin-bottom: 20px;display: flex;">
    {#each freeshow_formats as format}
        <Button
            style="flex: 1;min-height: 50px;"
            on:click={() => {
                let name = format.name.startsWith("$") ? translate(format.name.slice(1)) : format.name
                sendMain(Main.IMPORT, { channel: format.id, format: { ...format, name }, settings: { path: $dataPath } })
                displayTutorial(format)
            }}
            center
        >
            <img style="height: 60px;" src="./import-logos/freeshow.webp" alt="FreeShow-logo" draggable={false} />
            <p style="margin-inline-start: 5px;">
                {#if format.name.startsWith("$")}
                    <T id={format.name.slice(1)} />
                {:else}
                    {format.name}
                {/if}
            </p>
        </Button>
    {/each}
</div>

<h3><T id="settings.text_import" /></h3>
<div style="margin-bottom: 20px;">
    {#each text_formats as format}
        <!-- width: 20%; -->
        <Button
            style="width: calc(100% / 6);flex-direction: column;min-height: 160px;"
            on:click={() => {
                if (format.popup) {
                    tick().then(() => {
                        if (format.popup) {
                            activePopup.set(format.popup)
                        }
                    })
                } else if (format.id === "clipboard") {
                    importFromClipboard()
                    activePopup.set(null)
                } else {
                    let name = format.name.startsWith("$") ? translate(format.name.slice(1)) : format.name
                    sendMain(Main.IMPORT, { channel: format.id, format: { ...format, name }, settings: { path: $dataPath } })
                    displayTutorial(format)
                }
            }}
            title={format.shortcut ? ` [${format.shortcut}]` : ""}
            bold={false}
            center
        >
            <img src="./import-logos/{format.id}.webp" alt="{format.id}-logo" draggable={false} />
            <p>
                {#if format.name.startsWith("$")}
                    <T id={format.name.slice(1)} />
                {:else}
                    {format.name}
                {/if}
            </p>
        </Button>
    {/each}
</div>

<h3><T id="settings.media_import" /></h3>
<div>
    {#each media_formats as format}
        <Button
            style="width: 20%;flex-direction: column;min-height: 160px;"
            on:click={() => {
                sendMain(Main.IMPORT, { channel: format.id, format })
                displayTutorial(format)
            }}
            bold={false}
            center
        >
            <img src="./import-logos/{format.id}.webp" alt="{format.id}-logo" draggable={false} />
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
        max-width: 100%;
        object-fit: contain;
        padding: 10px;
    }

    h3 {
        font-size: 1.2em;
        color: var(--text);
        margin-bottom: 5px;
    }
</style>
