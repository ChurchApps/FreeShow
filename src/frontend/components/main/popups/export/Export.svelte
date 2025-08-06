<script lang="ts">
    import { EXPORT } from "../../../../../types/Channels"
    import { Main } from "../../../../../types/IPC/Main"
    import type { Project } from "../../../../../types/Projects"
    import { Show } from "../../../../../types/Show"
    import { sendMain } from "../../../../IPC/main"
    import { activePopup, activeProject, dataPath, dictionary, projects, showsCache, showsPath, special } from "../../../../stores"
    import { send } from "../../../../utils/request"
    import { exportProject } from "../../../export/project"
    import { clone } from "../../../helpers/array"
    import Icon from "../../../helpers/Icon.svelte"
    import { loadShows } from "../../../helpers/setShow"
    import T from "../../../helpers/T.svelte"
    import Button from "../../../inputs/Button.svelte"
    import Checkbox from "../../../inputs/Checkbox.svelte"
    import CombinedInput from "../../../inputs/CombinedInput.svelte"
    import Center from "../../../system/Center.svelte"
    import Loader from "../../Loader.svelte"
    import { convertShowSlidesToImages, exportFormats, exportTypes, getActiveShowId, getShowIdsFromType } from "./exportHelper"
    import PdfExport from "./PdfExport.svelte"

    let previewShow: Show | null = null
    let showIds: string[] = []
    let loading = false

    let exportType = ""
    let exportFormat = ""

    const excludedFormats = {
        project: ["show", "txt", "image"],
        all_shows: ["project", "pdf", "image"]
    }
    function filterFormats(exportFormats) {
        return clone(exportFormats).filter((a) => !(excludedFormats[exportType] || []).find((id) => id === a.id))
    }

    const formatIcons = {
        show: "json",
        txt: "txt",
        pdf: "pdf",
        project: "zip",
        image: "jpg"
    }

    $: typeName = exportTypes.find((a) => a.id === exportType)?.name || ""
    $: formatName = exportFormats.find((a) => a.id === exportFormat)?.name || ""

    ///

    $: if (exportType && exportFormat) updateActive()
    async function updateActive() {
        loading = true
        showIds = getShowIdsFromType[exportType]?.() || []

        let showId = showIds[0]
        if (!showId && !previewShow) showId = getActiveShowId()

        if (showId) {
            await loadShows([showId])
            previewShow = { ...$showsCache[showId], id: showId }
        }

        loading = false

        // TODO: get & display preview example of first txt!/show? export
    }

    async function exportClick() {
        if (loading) return

        if (exportType === "all_shows") {
            loading = true
            send(EXPORT, ["ALL_SHOWS"], { type: exportFormat, path: $dataPath, showsPath: $showsPath })
            return
        }

        if (exportFormat === "project") {
            let project: Project | null = exportType === "project" && $activeProject ? $projects[$activeProject] : null
            if (!project) {
                if (!showIds.length || !previewShow) return

                project = {
                    name: previewShow.name,
                    notes: "",
                    created: previewShow.timestamps.created,
                    parent: "/",
                    shows: showIds.map((id) => ({ type: "show", id }))
                }
            }

            loading = true
            await exportProject(project, $activeProject || "")
        } else if (exportFormat === "image") {
            // only first selected show
            loading = true
            const showName = $showsCache[showIds[0]]?.name
            const images = await convertShowSlidesToImages(showIds[0])
            images.forEach((base64, i) => {
                if (!base64) return
                sendMain(Main.SAVE_IMAGE, { path: $dataPath, base64, filePath: ["Images", showName, `${i + 1}.jpg`], format: "jpg" })
            })
            loading = false
        } else {
            const options = exportFormat === "pdf" ? (pdfOptions.chordSheet ? { ...pdfOptions, chordSheet: true } : pdfOptions) : {}
            send(EXPORT, ["GENERATE"], { type: exportFormat, path: $dataPath, showsPath: $showsPath, showIds, options })
        }

        activePopup.set(null)
    }

    let pdfOptions: any = {}

    function setSpecial(e: any, key: string) {
        let value = e?.target?.checked
        special.update((a) => {
            a[key] = value
            return a
        })
    }

    // Helper function to check if a show has chords
    function showHasChords(show: Show | null): boolean {
        if (!show) return false

        return Object.values(show.slides || {}).some((slide) => slide.items?.some((item) => item.lines?.some((line) => line.chords && line.chords.length > 0)))
    }
</script>

{#if !exportType}
    <p><T id="export.option_type" /></p>

    <div class="choose">
        {#each exportTypes as type, i}
            <Button disabled={!getShowIdsFromType[type.id || ""]?.(false)?.length} on:click={() => (exportType = type.id || "")} style={i === 0 ? "border: 2px solid var(--focus);" : ""}>
                <Icon id={type.icon || ""} size={4} white />
                <p><T id={type.name} /></p>
            </Button>
        {/each}
    </div>
{:else if !exportFormat}
    <Button class="popup-back" title={$dictionary.actions?.back} on:click={() => (exportType = "")}>
        <Icon id="back" size={1.3} white />
    </Button>

    <p><T id="export.option_format" /></p>

    <div class="choose">
        {#each filterFormats(exportFormats) as format, i}
            <Button disabled={false} on:click={() => (exportFormat = format.id || "")} style={i === 0 ? "border: 2px solid var(--focus);" : ""}>
                <img src="./import-logos/{formatIcons[format.id || '']}.webp" alt="{format.id}-logo" draggable={false} />

                <p>
                    {#if format.name.includes("$:")}<T id={format.name} />{:else}{format.name}{/if}
                </p>
            </Button>
        {/each}
    </div>
{:else}
    <Button class="popup-back" title={$dictionary.actions?.back} on:click={() => (exportFormat = "")}>
        <Icon id="back" size={1.3} white />
    </Button>

    <!-- margin-bottom: 10px; -->
    <div style="display: flex;">
        <p style="white-space: break-spaces;opacity: 0.6;"><T id="export.export_as" /></p>
        <p><T id={typeName} /></p>
        <p style="white-space: break-spaces;opacity: 0.6;"><T id="export.export_as" index={1} />&nbsp;</p>
        <p>
            {#if formatName.includes("$:")}<T id={formatName} />{:else}{formatName}{/if}
        </p>
    </div>

    <hr />

    {#if exportFormat === "pdf"}
        <PdfExport bind:pdfOptions {previewShow} {showHasChords} />

        <hr />
    {:else if exportFormat === "project"}
        <CombinedInput>
            <p><T id="export.include_media" /></p>
            <div class="alignRight">
                <Checkbox checked={$special.projectIncludeMedia ?? true} on:change={(e) => setSpecial(e, "projectIncludeMedia")} />
            </div>
        </CombinedInput>

        <hr />
    {/if}

    {#if loading}
        <Center padding={10}>
            <Loader />
        </Center>
    {/if}

    <CombinedInput>
        <Button style="width: 100%;" disabled={exportType === "project" ? !$projects[$activeProject || ""]?.shows?.length : !showIds.length && exportType !== "all_shows"} on:click={exportClick} center dark>
            <div style="display: flex;align-items: center;">
                <Icon id="export" size={1.2} right />
                <T id="export.export" />
                {#if showIds.length > 1 && exportFormat !== "project"}
                    <span style="opacity: 0.5;padding-inline-start: 10px;align-content: center;">({showIds.length})</span>
                {/if}
            </div>
        </Button>
    </CombinedInput>
{/if}

<style>
    .choose {
        margin-top: 20px;

        width: 100%;
        display: flex;
        align-self: center;
        justify-content: space-between;
        gap: 10px;
    }

    .choose :global(button) {
        width: 180px;
        height: 180px;

        display: flex;
        gap: 10px;
        flex-direction: column;
        justify-content: center;
        flex: 1;
    }
    .choose p {
        display: flex;
        align-items: center;
    }

    img {
        height: 100px;
        max-width: 100%;
        object-fit: contain;
        padding: 10px;
    }

    hr {
        border: none;
        height: 2px;
        margin: 20px 0;
        background-color: var(--primary-lighter);
    }
</style>
