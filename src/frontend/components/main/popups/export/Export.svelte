<script lang="ts">
    import { EXPORT } from "../../../../../types/Channels"
    import type { Project } from "../../../../../types/Projects"
    import { Show } from "../../../../../types/Show"
    import { activePopup, activeProject, dataPath, projects, showsCache, showsPath, special } from "../../../../stores"
    import { send } from "../../../../utils/request"
    import { exportProject } from "../../../export/project"
    import { clone } from "../../../helpers/array"
    import Icon from "../../../helpers/Icon.svelte"
    import { loadShows } from "../../../helpers/setShow"
    import T from "../../../helpers/T.svelte"
    import Button from "../../../inputs/Button.svelte"
    import Checkbox from "../../../inputs/Checkbox.svelte"
    import CombinedInput from "../../../inputs/CombinedInput.svelte"
    import Dropdown from "../../../inputs/Dropdown.svelte"
    import Center from "../../../system/Center.svelte"
    import Loader from "../../Loader.svelte"
    import { exportFormats, exportTypes, getActiveShowId, getShowIdsFromType } from "./exportHelper"
    import PdfExport from "./PdfExport.svelte"

    let previewShow: Show | null = null
    let showIds: string[] = []
    let loading: boolean = false

    let type: any = exportTypes[0]
    let format: any = exportFormats[0]

    $: if (type.id) updateActive()
    async function updateActive() {
        // type not supported by format
        if (exportFormats.find((a) => a.id === format.id)?.data?.hide.includes(type.id)) {
            format = exportFormats[0]
        }

        loading = true
        showIds = getShowIdsFromType[type.id]?.() || []

        let showId = showIds[0]
        if (!showId && !previewShow) showId = getActiveShowId()

        if (showId) {
            await loadShows([showId])
            previewShow = { ...$showsCache[showId], id: showId }
        }

        loading = false
    }

    async function exportClick() {
        // type not supported by format
        if (exportFormats.find((a) => a.id === format.id)?.data?.hide.includes(type.id)) return

        if (type.id === "all_shows") {
            loading = true
            send(EXPORT, ["ALL_SHOWS"], { type: format.id, path: $dataPath, showsPath: $showsPath })
            return
        }

        if (format.id === "project") {
            if (!showIds.length) return

            let project: Project | null = type.id === "project" && $activeProject ? $projects[$activeProject] : null
            if (!project) {
                if (!previewShow) return

                project = {
                    name: previewShow.name,
                    notes: "",
                    created: previewShow.timestamps.created,
                    parent: "/",
                    shows: showIds.map((id) => ({ type: "show", id })),
                }
            }

            loading = true
            await exportProject(project)
        } else {
            send(EXPORT, ["GENERATE"], { type: format.id, path: $dataPath, showsPath: $showsPath, showIds, options: format.id === "pdf" ? pdfOptions : {} })
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
</script>

<div style="display: flex;align-items: center;align-self: center;">
    <p style="white-space: break-spaces;"><T id="export.export_as" /></p>
    <Dropdown style="min-width: 200px;" options={exportTypes} value={type.name} on:click={(e) => (type = e.detail)} />
    <p style="white-space: break-spaces;"><T id="export.export_as" index={1} />&nbsp;</p>
    <Dropdown style="min-width: 200px;" options={clone(exportFormats).filter((a) => !a.data?.hide.includes(type.id))} value={format.name} on:click={(e) => (format = e.detail)} />
</div>

<hr />

{#if format.id === "pdf"}
    <PdfExport bind:pdfOptions {previewShow} />

    <hr />
{/if}

{#if format.id === "project"}
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

<!-- <FolderPicker id="DATA">
    <Icon id="folder" right />
    {#if $dataPath}
        {$dataPath} - Exports
    {:else}
        <T id="inputs.change_folder" />
    {/if}
</FolderPicker> -->

<CombinedInput>
    <Button style="width: 100%;" disabled={!showIds.length && type.id !== "all_shows"} on:click={exportClick} center dark>
        <div style="display: flex;align-items: center;">
            <Icon id="export" size={1.2} right />
            <T id="export.export" />
            {#if showIds.length > 1 && format.id !== "project"}
                <span style="opacity: 0.5;padding-left: 10px;align-content: center;">({showIds.length})</span>
            {/if}
        </div>
    </Button>
</CombinedInput>

<style>
    hr {
        border: none;
        height: 2px;
        margin: 20px 0;
        background-color: var(--primary-lighter);
    }
</style>
