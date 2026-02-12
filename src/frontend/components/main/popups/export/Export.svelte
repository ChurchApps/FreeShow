<script lang="ts">
    import { EXPORT } from "../../../../../types/Channels"
    import { Main } from "../../../../../types/IPC/Main"
    import type { Project } from "../../../../../types/Projects"
    import { Show } from "../../../../../types/Show"
    import { sendMain } from "../../../../IPC/main"
    import { activePopup, activeProject, projects, shows, showsCache, special } from "../../../../stores"
    import { translateText } from "../../../../utils/language"
    import { send } from "../../../../utils/request"
    import { exportProject } from "../../../export/project"
    import { clone } from "../../../helpers/array"
    import { loadShows } from "../../../helpers/setShow"
    import T from "../../../helpers/T.svelte"
    import HRule from "../../../input/HRule.svelte"
    import MaterialButton from "../../../inputs/MaterialButton.svelte"
    import MaterialMultiChoice from "../../../inputs/MaterialMultiChoice.svelte"
    import MaterialToggleSwitch from "../../../inputs/MaterialToggleSwitch.svelte"
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
        return clone(exportFormats)
            .filter((a) => !(excludedFormats[exportType] || []).find((id) => id === a.id))
            .map((a) => {
                a.name = translateText(a.name)
                a.icon = `./import-logos/${formatIcons[a.id]}.webp`
                return a
            })
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
            send(EXPORT, ["ALL_SHOWS"], { type: exportFormat })
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
                sendMain(Main.SAVE_IMAGE, { base64, filePath: ["Images", showName, `${i + 1}.jpg`], format: "jpg" })
            })
            loading = false
        } else {
            const options = exportFormat === "pdf" ? (pdfOptions.chordSheet ? { ...pdfOptions, chordSheet: true } : pdfOptions) : {}
            const showNames = showIds.map((id) => $shows[id]?.name || "")
            send(EXPORT, ["GENERATE"], { type: exportFormat, showIds, showNames, options })
        }

        activePopup.set(null)
    }

    let pdfOptions: any = {}

    function setSpecial(e: any, key: string) {
        let value = e.detail
        special.update((a) => {
            a[key] = value
            return a
        })
    }

    $: exportTypesList = clone(exportTypes).map((a: any) => {
        a.name = translateText(a.name)
        if (!getShowIdsFromType[a.id || ""]?.(false)?.length) a.disabled = true
        return a
    })
</script>

{#if !exportType}
    <p style="margin-bottom: 10px;"><T id="export.option_type" /></p>

    <MaterialMultiChoice options={exportTypesList} on:click={(e) => (exportType = e.detail)} />
{:else if !exportFormat}
    <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => (exportType = "")} />

    <p style="margin-bottom: 10px;"><T id="export.option_format" /></p>

    <MaterialMultiChoice options={filterFormats(exportFormats)} on:click={(e) => (exportFormat = e.detail)} />
{:else}
    <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => (exportFormat = "")} />

    <!-- margin-bottom: 10px; -->
    <div style="display: flex;">
        <p style="white-space: break-spaces;opacity: 0.6;"><T id="export.export_as" /></p>
        <p>{translateText(typeName)}</p>
        <p style="white-space: break-spaces;opacity: 0.6;"><T id="export.export_as" index={1} />&nbsp;</p>
        <p>{translateText(formatName)}</p>
    </div>

    {#if exportFormat === "pdf"}
        <HRule />
        <PdfExport bind:pdfOptions {previewShow} />
    {:else if exportFormat === "project"}
        <MaterialToggleSwitch label="export.include_media" style="margin-top: 20px;" checked={$special.projectIncludeMedia ?? true} defaultValue={true} on:change={(e) => setSpecial(e, "projectIncludeMedia")} />
    {/if}

    {#if loading}
        <Center padding={10}>
            <Loader />
        </Center>
    {/if}

    <MaterialButton variant="contained" style="margin-top: 20px;" icon="export" info={showIds.length > 1 && exportFormat !== "project" ? showIds.length.toString() : ""} disabled={exportType === "project" ? !$projects[$activeProject || ""]?.shows?.length : !showIds.length && exportType !== "all_shows"} on:click={exportClick}>
        <T id="export.export" />
    </MaterialButton>
{/if}
