<script lang="ts">
    import { tick } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { Popups } from "../../../../types/Main"
    import { importFromClipboard } from "../../../converters/importHelpers"
    import { sendMain } from "../../../IPC/main"
    import { activePopup, alertMessage, dataPath, os } from "../../../stores"
    import { translate, translateText } from "../../../utils/language"
    import { presentationExtensions } from "../../../values/extensions"
    import Icon from "../../helpers/Icon.svelte"
    import HRule from "../../input/HRule.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    const freeshow_formats = [
        { name: "formats.show", title: "FreeShow Song/Presentation File", icon: "slide", extensions: ["show", "json"], id: "freeshow" },
        { name: "formats.project", title: "FreeShow Project File", icon: "project", extensions: ["project", "shows", "json", "zip"], id: "freeshow_project" }, // , "fsproject", "fsp"
        { name: "formats.template", title: "FreeShow Template File", icon: "templates", extensions: ["fstemplate", "fst", "template", "json", "zip"], id: "freeshow_template" }
        // { name: "formats.theme", extensions: ["fstheme", "theme", "json"], id: "freeshow_theme" } // moved to settings
        // { name: "Calendar", extensions: ["ics"], id: "calendar" }, // calendar drawer tab
        // { name: "Scripture", id: "scripture" }, // scripture drawer tab
    ]

    const text_formats: { name: string; extensions: string[]; id: string; shortcut?: string; tutorial?: string; popup?: Popups }[] = [
        { name: "formats.text", extensions: ["txt"], id: "txt" },
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
            tutorial:
                "Import the <b>SongsWords.db/SongWords.db</b> file from the Data folder!<br>Optionally select <b>Songs.db</b> at the same time to also import title/metadata.<br><br>Often located in the Documents folder:<br><i>Documents/Softouch/EasyWorship/Default/v6.1/Databases/Data/</i>"
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
        { name: "Lessons.church", title: "ChurchApps\nhttps://lessons.church", extensions: ["json", "olp", "olf"], id: "lessons" },
        { name: "PDF", title: "Added to your project", extensions: ["pdf"], id: "pdf" },
        { name: "PowerPoint/Keynote", title: "Added to your project", extensions: presentationExtensions, id: "powerkey" }
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

<div style="display: flex;gap: 5px;">
    {#each freeshow_formats as format}
        <MaterialButton
            variant="outlined"
            title={format.title}
            style="flex: 1;min-height: 50px;padding: 10px;gap: 15px;"
            on:click={() => {
                let name = format.name.startsWith("$") ? translate(format.name.slice(1)) : format.name
                sendMain(Main.IMPORT, { channel: format.id, format: { ...format, name }, settings: { path: $dataPath } })
                displayTutorial(format)
            }}
        >
            <Icon style="height: 60px;" id={format.icon} size={2.5} white />
            <p>{translateText(format.name)}</p>

            <div class="freeshow">
                <img style="height: 18px;padding: 0;" src="./import-logos/freeshow.webp" alt="FreeShow-logo" draggable={false} />
            </div>
        </MaterialButton>
    {/each}
</div>

<MaterialButton style="margin-top: 5px;" variant="outlined" title="actions.paste [Ctrl+Alt+I]">
    <Icon id="paste" size={1.2} white />
    {translateText("formats.clipboard")}
</MaterialButton>

<HRule title="settings.media_import" />

<div style="display: flex;gap: 5px;">
    {#each media_formats as format}
        <MaterialButton
            variant="outlined"
            title={format.title}
            style="justify-content: start;flex: 1;min-height: 50px;font-weight: normal;"
            on:click={() => {
                sendMain(Main.IMPORT, { channel: format.id, format })
                displayTutorial(format)
            }}
        >
            <img style="height: 60px;width: 70px;" src="./import-logos/{format.id}.webp" alt="{format.id}-logo" draggable={false} />
            <p>{format.name}</p>
            {#if format.id === "powerkey"}Deprecated{/if}
        </MaterialButton>
    {/each}
</div>

<HRule title="settings.text_import" />

<div style="display: flex;gap: 5px;">
    {#each text_formats as format}
        <MaterialButton
            variant="outlined"
            style="justify-content: start;width: calc((100% / 3) - (5px * 2 / 3));min-height: 50px;font-weight: normal;border: 1px solid var(--primary-lighter);"
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
        >
            <img style="height: 60px;width: 70px;" src="./import-logos/{format.id}.webp" alt="{format.id}-logo" draggable={false} />
            <p>{translateText(format.name)}</p>
        </MaterialButton>
    {/each}
</div>

<!-- <div>
    {#each text_formats as format}
        <MaterialButton
            style="width: calc((100% / 5) - (5px * 4 / 5));flex-direction: column;min-height: 160px;font-weight: normal;gap: 0;border: 1px solid var(--primary-lighter);"
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
        >
            <img src="./import-logos/{format.id}.webp" alt="{format.id}-logo" draggable={false} />
            <p>{translateText(format.name)}</p>
        </MaterialButton>
    {/each}
</div> -->

<style>
    div {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
    }

    img {
        height: 100px;
        max-width: 100%;
        object-fit: contain;
        padding: 10px;
        padding-left: 0;
    }

    .freeshow {
        position: absolute;
        bottom: 7px;
        right: 10px;
    }
</style>
