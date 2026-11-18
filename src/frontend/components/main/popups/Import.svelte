<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import { importFromClipboard } from "../../../converters/importHelpers"
    import { sendMain } from "../../../IPC/main"
    import { activePopup, alertMessage, popupData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { presentationExtensions } from "../../../values/extensions"
    import Icon from "../../helpers/Icon.svelte"
    import HRule from "../../input/HRule.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    let mode = $popupData.mode
    popupData.set({})

    const freeshow_formats = [
        { name: "formats.show", title: "FreeShow Song/Presentation File", icon: "slide", extensions: ["show", "json"], id: "freeshow" },
        { name: "formats.project", title: "FreeShow Project File", icon: "project", extensions: ["project", "shows", "json", "zip"], id: "freeshow_project" }, // , "fsproject", "fsp"
        { name: "formats.template", title: "FreeShow Template File", icon: "templates", extensions: ["fstemplate", "fst", "template", "json", "zip"], id: "freeshow_template" },
        { name: "formats.overlay", title: "FreeShow Overlay File", icon: "overlays", extensions: ["fsoverlay", "fso", "overlay", "json", "zip"], id: "freeshow_overlay" },
        { name: "formats.action", title: "FreeShow Action File", icon: "actions", extensions: ["fsaction", "action", "json"], id: "freeshow_action" },
        { name: "stage.stage_layout", title: "FreeShow Stage Layout File", icon: "stage", extensions: ["fsstage", "stage", "json"], id: "freeshow_stage" },
        { name: "formats.theme", title: "FreeShow Theme File", icon: "theme", extensions: ["fstheme", "theme", "json"], id: "freeshow_theme" }
    ]

    const freeshow_primary_formats = freeshow_formats.filter((format) => ["freeshow", "freeshow_project"].includes(format.id))
    const freeshow_more_formats = freeshow_formats.filter((format) => ["freeshow_template", "freeshow_overlay", "freeshow_action", "freeshow_stage", "freeshow_theme"].includes(format.id))

    const text_formats: { name: string; extensions: string[]; id: string; shortcut?: string; tutorial?: string }[] = [
        { name: "formats.text", extensions: ["txt"], id: "txt" },
        { name: "CSV", extensions: ["csv"], id: "csv" },
        { name: "ChordPro", extensions: ["cho", "crd", "chopro", "chordpro", "chord", "pro", "txt", "onsong"], id: "chordpro" },
        { name: "Word", extensions: ["doc", "docx"], id: "word" },
        { name: "ProPresenter", extensions: ["pro4", "pro5", "pro6", "pro", "json", "proBundle"], id: "propresenter" },
        {
            name: "EasyWorship",
            extensions: ["db"],
            id: "easyworship",
            tutorial: "Import the <b>SongsWords.db/SongWords.db</b> file from the Data folder!<br>Optionally select <b>Songs.db</b> at the same time to also import title/metadata.<br><br>Often located in the Documents folder:<br><i>Documents/Softouch/EasyWorship/Default/v6.1/Databases/Data/</i>"
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
        { name: "Songbeamer", extensions: ["sng"], id: "songbeamer" },
        { name: "Easyslides", extensions: ["xml"], id: "easyslides" },
        { name: "VerseVIEW", extensions: ["xml"], id: "verseview" }
    ]

    const media_formats = [
        { name: "Lessons.church", title: "ChurchApps\nhttps://lessons.church", extensions: ["json", "olp", "olf"], id: "lessons" },
        { name: "PDF", title: "Added to your project", extensions: ["pdf"], id: "pdf" },
        { name: "PowerPoint", title: "Opens the presentation in PowerPoint/Keynote\n(requires the app to be installed)", extensions: [], id: "powerpoint" }
    ]

    // PowerPoint/Keynote is only imported as a controller (the presentation is opened in the actual app)
    function pptController() {
        sendMain(Main.IMPORT, { channel: "powerkey", format: { name: "PowerPoint/Keynote", extensions: presentationExtensions } })
        activePopup.set(null)
    }

    function displayTutorial(format: any) {
        if (!format.tutorial) {
            activePopup.set(null)
            return
        }

        alertMessage.set(format.tutorial)
        activePopup.set("alert")
    }

    function importFreeshowFormat(format: any) {
        const name = translateText(format.name)
        sendMain(Main.IMPORT, { channel: format.id, format: { ...format, name } })
        displayTutorial(format)
    }

    // function openCalendar() {
    //     activeDrawerTab.set("calendar")
    //     activePage.set("show")
    //     activePopup.set(null)
    // }

    // function openScripture() {
    //     activePopup.set("import_scripture")
    // }

    let openedPage = ""
</script>

{#if openedPage === "freeshow_more"}
    <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => (openedPage = "")} />

    <div style="display: flex;gap: 5px;">
        {#each freeshow_more_formats as format}
            <MaterialButton
                variant="outlined"
                title={format.title}
                style="flex: 1;min-height: 50px;min-width: 280px;padding: 10px;gap: 15px;"
                on:click={() => {
                    importFreeshowFormat(format)
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

    <!-- <div style="display: flex;gap: 5px;margin-top: 10px;">
        <MaterialButton variant="outlined" style="flex: 1;min-height: 50px;padding: 10px;gap: 15px;" on:click={openCalendar}>
            <Icon style="height: 60px;" id="calendar" size={2.5} white />
            <p>{translateText("tabs.calendar")}</p>
        </MaterialButton>

        <MaterialButton variant="outlined" style="flex: 1;min-height: 50px;padding: 10px;gap: 15px;" on:click={openScripture}>
            <Icon style="height: 60px;" id="scripture" size={2.5} white />
            <p>{translateText("tabs.scripture")}</p>
        </MaterialButton>
    </div> -->
{:else if mode === "project"}
    <div style="display: flex;gap: 5px;">
        {#each media_formats.filter((a) => ["pdf", "powerpoint"].includes(a.id)) as format}
            <InputRow style="flex: 1;">
                <MaterialButton
                    variant="outlined"
                    style="justify-content: start;flex: 1;min-height: 50px;font-weight: normal;"
                    on:click={() => {
                        if (format.id === "powerpoint") {
                            pptController()
                            return
                        }

                        sendMain(Main.IMPORT, { channel: format.id, format })
                        displayTutorial(format)
                    }}
                >
                    <img style="height: 60px;width: 70px;" src="./import-logos/{format.id}.webp" alt="{format.id}-logo" draggable={false} />
                    <p>{format.name}</p>
                </MaterialButton>
            </InputRow>
        {/each}
    </div>

    <HRule title="settings.text_import" />

    <div style="display: flex;gap: 5px;">
        {#each text_formats.filter((a) => ["txt", "chordpro"].includes(a.id)) as format}
            <MaterialButton
                variant="outlined"
                style="justify-content: start;flex: 1;min-height: 50px;font-weight: normal;"
                on:click={() => {
                    let name = translateText(format.name)
                    sendMain(Main.IMPORT, { channel: format.id, format: { ...format, name } })
                    displayTutorial(format)
                }}
                title={format.shortcut ? ` [${format.shortcut}]` : ""}
            >
                <img style="height: 60px;width: 70px;" src="./import-logos/{format.id}.webp" alt="{format.id}-logo" draggable={false} />
                <p>{translateText(format.name)}</p>
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
{:else}
    <div style="display: flex;gap: 5px;">
        {#each freeshow_primary_formats as format}
            <MaterialButton
                variant="outlined"
                title={format.title}
                style="flex: 1;min-height: 50px;padding: 10px;gap: 15px;"
                on:click={() => {
                    importFreeshowFormat(format)
                }}
            >
                <Icon style="height: 60px;" id={format.icon} size={2.5} white />
                <p>{translateText(format.name)}</p>

                <div class="freeshow">
                    <img style="height: 18px;padding: 0;" src="./import-logos/freeshow.webp" alt="FreeShow-logo" draggable={false} />
                </div>
            </MaterialButton>
        {/each}

        <MaterialButton variant="outlined" style="flex: 1;min-height: 50px;padding: 10px;gap: 5px;" on:click={() => (openedPage = "freeshow_more")}>
            <p style="opacity: 0.9;">{translateText("create_show.more_options")}</p>
            <Icon style="opacity: 0.8;height: 60px;margin-right: -15px;" id="next" size={2} white />
        </MaterialButton>
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
            <InputRow style="flex: 1;">
                <MaterialButton
                    variant="outlined"
                    title={format.title}
                    style="justify-content: start;flex: 1;min-height: 50px;font-weight: normal;"
                    on:click={() => {
                        if (format.id === "powerpoint") {
                            pptController()
                            return
                        }

                        sendMain(Main.IMPORT, { channel: format.id, format })
                        displayTutorial(format)
                    }}
                >
                    <img style="height: 60px;width: 70px;" src="./import-logos/{format.id}.webp" alt="{format.id}-logo" draggable={false} />
                    <p>{format.name}</p>
                </MaterialButton>
            </InputRow>
        {/each}
    </div>

    <HRule title="settings.text_import" />

    <div style="display: flex;gap: 5px;">
        {#each text_formats as format}
            <MaterialButton
                variant="outlined"
                style="justify-content: start;width: calc((100% / 3) - (5px * 2 / 3));min-height: 50px;font-weight: normal;border: 1px solid var(--primary-lighter);"
                on:click={() => {
                    let name = translateText(format.name)
                    sendMain(Main.IMPORT, { channel: format.id, format: { ...format, name } })
                    displayTutorial(format)
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
</style>
