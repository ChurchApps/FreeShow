<script lang="ts">
    import { tick } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { Popups } from "../../../../types/Main"
    import { importFromClipboard } from "../../../converters/importHelpers"
    import { sendMain } from "../../../IPC/main"
    import { activePopup, alertMessage, dataPath } from "../../../stores"
    import { translateText } from "../../../utils/language"
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
        // { name: "PowerPoint", extensions: ["ppt", "pptx"], id: "powerpoint", tutorial: "This will import the plain text as a show." + ($os.platform === "linux" ? "" : " If you would like to use a PowerPoint/Keynote presentation with FreeShow, please choose the media import option, or drag and drop it into your project.") + " Or you can import directly as PDF or images if you don't need animations." },
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
        // { name: "PowerPoint/Keynote", title: "Added to your project", extensions: presentationExtensions, id: "powerkey" }
        { name: "PowerPoint", extensions: [], id: "powerpoint" }
    ]

    const powerpoint_options = [
        { name: "info.slides", description: "Imperfect formatting.", icon: "txt", click: pptText },
        { name: "PDF", description: "Requires LibreOffice installed.", icon: "pdf", click: libreOfficeConvert },
        { name: "PDF (Online)", description: "Requires network connection, and manual steps.", icon: "pdf", click: onlineConvert },
        { name: "Controller (Deprecated)", description: "Requires PowerPoint/Keynote installed. Useful for live streams, but buggy.", icon: "powerkey", click: pptController }
    ]

    function pptText() {
        sendMain(Main.IMPORT, { channel: "powerpoint", format: { name: "PowerPoint", extensions: ["ppt", "pptx"] }, settings: { path: $dataPath } })
    }
    function libreOfficeConvert() {
        sendMain(Main.LIBREOFFICE_CONVERT, { type: "powerpoint", dataPath: $dataPath })
    }
    function onlineConvert() {
        sendMain(Main.URL, "https://www.ilovepdf.com/powerpoint_to_pdf")
        // https://cloudconvert.com/ppt-to-jpg
        activePopup.set(null)
    }
    function pptController() {
        sendMain(Main.IMPORT, { channel: "powerkey", format: { name: "PowerPoint/Keynote", extensions: presentationExtensions } })
    }

    function displayTutorial(format: any) {
        if (!format.tutorial) {
            activePopup.set(null)
            return
        }

        alertMessage.set(format.tutorial)
        activePopup.set("alert")
    }

    let openedPage = ""
</script>

{#if openedPage === "powerpoint"}
    <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => (openedPage = "")} />

    <p class="tip" style="padding-bottom: 20px;">The best option would generally be to get a hold of the presentation as PDF format in the first place.</p>

    <div style="display: flex;flex-direction: column;gap: 5px;">
        {#each powerpoint_options as option}
            <MaterialButton variant="outlined" style="justify-content: start;flex: 1;min-height: 50px;font-weight: normal;" on:click={() => option.click()}>
                <img style="height: 60px;width: 70px;" src="./import-logos/{option.icon}.webp" alt="{option.name}-logo" draggable={false} />

                <div style="display: flex;flex-direction: column;align-items: start;gap: 5px;">
                    <p style="font-size: 1.1em;">{translateText(option.name)}</p>
                    <span style="opacity: 0.5;">{translateText(option.description)}</span>
                </div>
            </MaterialButton>
        {/each}
    </div>

    <!-- <p class="tip" style="padding-top: 20px;">Making/maintaining our own PPT converter that keeps all of the formatting would be too much work.</p> -->
{:else}
    <div style="display: flex;gap: 5px;">
        {#each freeshow_formats as format}
            <MaterialButton
                variant="outlined"
                title={format.title}
                style="flex: 1;min-height: 50px;padding: 10px;gap: 15px;"
                on:click={() => {
                    let name = translateText(format.name)
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

    <MaterialButton
        style="margin-top: 5px;"
        variant="outlined"
        on:click={() => {
            importFromClipboard()
            activePopup.set(null)
        }}
        title="actions.paste [Ctrl+Alt+I]"
    >
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
                    if (format.id === "powerpoint") {
                        openedPage = "powerpoint"
                        return
                    }

                    sendMain(Main.IMPORT, { channel: format.id, format })
                    displayTutorial(format)
                }}
            >
                <img style="height: 60px;width: 70px;" src="./import-logos/{format.id}.webp" alt="{format.id}-logo" draggable={false} />
                <p>{format.name}</p>
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
                    } else {
                        let name = translateText(format.name)
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
{/if}

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

    .tip {
        opacity: 0.7;
        font-size: 0.85em;
    }
</style>
