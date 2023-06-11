<script lang="ts">
    import { EXPORT } from "../../../../types/Channels"
    import type { Project } from "../../../../types/Projects"
    import { activePopup, activeProject, activeShow, exportPath, os, projects, selected, showsCache, shows as showsList } from "../../../stores"
    import { newToast } from "../../../utils/messages"
    import { send } from "../../../utils/request"
    import Pdf from "../../export/Pdf.svelte"
    import { exportProject } from "../../export/project"
    import Icon from "../../helpers/Icon.svelte"
    import { loadShows } from "../../helpers/setShow"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import FolderPicker from "../../inputs/FolderPicker.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import Center from "../../system/Center.svelte"
    import Loader from "../Loader.svelte"

    $: shows = []

    let paper: any

    const getShows: any = {
        project: () => ($activeProject ? $projects[$activeProject].shows.filter((a) => a.type === undefined || a.type === "show").map(({ id }) => ({ id, ...$showsCache[id] })) : []),
        selected_shows: () => {
            if ($selected.id !== "show" && $selected.id !== "show_drawer") {
                if (!$activeShow || ($activeShow.type !== "show" && $activeShow.type !== undefined)) return []
                return [{ id: $activeShow.id, ...$showsCache[$activeShow.id] }]
            }
            return $selected.data.map(({ id }) => ({ id, ...$showsCache[id] }))
        },
        all_shows: () => {
            let allShows: any[] = []
            console.log($showsCache)

            Object.entries($showsCache).forEach(([id, show]) => {
                allShows.push({ id, ...show })
            })
            return allShows
        },
    }

    const whats: any[] = [
        { name: "$:export.selected_shows:$", id: "selected_shows" },
        { name: "$:export.current_project:$", id: "project" },
        { name: "$:export.all_shows:$", id: "all_shows" },
        // {name: "export.all_shows", id: "all_shows"},
        // {name: "export.all_projects", id: "all_projects"}
    ]
    let what: any = whats[0]
    $: if (getShows[what.id]) getShowsToExport()

    let loading: boolean = false
    async function getShowsToExport() {
        shows = []
        if (what.id === "project" && $activeProject) await loadShows($projects[$activeProject].shows.filter(({ type }) => type === undefined || type === "show").map(({ id }) => id))
        else if (what.id === "selected_shows") await loadShows($selected.data.map(({ id }) => id))
        else if (what.id === "all_shows") {
            loading = true
            // WIP progress meter & faster loading
            await loadShows(Object.keys($showsList))
            loading = false
        }
        shows = getShows[what.id]()
    }

    const formats: any[] = [
        { name: "TXT", id: "txt" },
        { name: "PDF", id: "pdf" },
        { name: "$:export.project:$", id: "project" },
        // {name: "JSON", id: "json"},
        // {name: "SHOW", id: "show"},
        // {name: "SHOWS", id: "shows"},
        // {name: "CSV", id: "csv"}
    ]
    let format: any = formats[0]

    let pdfOptions: any = {
        title: true,
        metadata: true,
        invert: false,
        groups: true,
        numbers: true,
        text: true,
        slides: true,
        // repeats: false,
        // notes: false,
        pageNumbers: true,
        grid: [3, 6],
        oneFile: false,
    }

    function updatePdfOptions(e: any, key: string) {
        pdfOptions[key] = e.target.checked
    }

    function exportClick() {
        if ($os.platform === "linux" && format.id === "pdf") {
            newToast("Can't export as PDF on Linux.")
            return
        }

        if (format.id === "project") {
            let project: Project | null = what.id === "project" && $activeProject ? $projects[$activeProject] : null
            if (!project) {
                if (what.id !== "selected_shows" || !shows.length) return
                let show: any = shows[0]
                project = {
                    name: show.name,
                    notes: "",
                    created: show.timestamps.created,
                    parent: "/",
                    shows,
                }
            }
            exportProject(project)
        } else {
            send(EXPORT, ["GENERATE"], { type: format.id, path: $exportPath, shows, options: format.id === "pdf" ? pdfOptions : {} })
        }
        activePopup.set(null)
    }
</script>

<div style="display: flex;align-items: center;align-self: center;">
    <p style="white-space: break-spaces;"><T id="export.export_as" /></p>
    <Dropdown style="min-width: 200px;" options={whats} value={what.name} on:click={(e) => (what = e.detail)} />
    <p style="white-space: break-spaces;"><T id="export.export_as" index={1} />&nbsp;</p>
    <Dropdown style="min-width: 200px;" options={formats} value={format.name} on:click={(e) => (format = e.detail)} />
</div>

<hr />

{#if format.id === "pdf"}
    <div style="display: flex;gap: 20px;">
        <div class="options">
            <h4 style="text-align: center;"><T id="export.options" /></h4>
            <br />
            <CombinedInput>
                <p><T id="export.title" /></p>
                <div class="alignRight">
                    <Checkbox checked={pdfOptions.title} on:change={(e) => updatePdfOptions(e, "title")} />
                </div>
            </CombinedInput>
            <CombinedInput>
                <p><T id="export.metadata" /></p>
                <div class="alignRight">
                    <Checkbox checked={pdfOptions.metadata} on:change={(e) => updatePdfOptions(e, "metadata")} />
                </div>
            </CombinedInput>
            <CombinedInput>
                <p><T id="export.page_numbers" /></p>
                <div class="alignRight">
                    <Checkbox checked={pdfOptions.pageNumbers} on:change={(e) => updatePdfOptions(e, "pageNumbers")} />
                </div>
            </CombinedInput>
            <CombinedInput>
                <p><T id="export.groups" /></p>
                <div class="alignRight">
                    <Checkbox checked={pdfOptions.groups} on:change={(e) => updatePdfOptions(e, "groups")} />
                </div>
            </CombinedInput>
            <CombinedInput>
                <p><T id="export.numbers" /></p>
                <div class="alignRight">
                    <Checkbox checked={pdfOptions.numbers} on:change={(e) => updatePdfOptions(e, "numbers")} />
                </div>
            </CombinedInput>
            <CombinedInput>
                <p><T id="export.invert" /></p>
                <div class="alignRight">
                    <Checkbox disabled={!pdfOptions.slides} checked={pdfOptions.invert} on:change={(e) => updatePdfOptions(e, "invert")} />
                </div>
            </CombinedInput>

            <br />

            <CombinedInput>
                <p><T id="export.text" /></p>
                <div class="alignRight">
                    <Checkbox disabled={!pdfOptions.slides} checked={pdfOptions.text} on:change={(e) => updatePdfOptions(e, "text")} />
                </div>
            </CombinedInput>
            <CombinedInput>
                <p><T id="export.slides" /></p>
                <div class="alignRight">
                    <Checkbox disabled={!pdfOptions.text} checked={pdfOptions.slides} on:change={(e) => updatePdfOptions(e, "slides")} />
                </div>
            </CombinedInput>
            <!-- <span>
        <p>repeats</p>
        <div class="alignRight">
            <Checkbox checked={pdfOptions.repeats} on:change={(e) => updatePdfOptions(e, "repeats")} />
        </div>
      </span> -->
            <CombinedInput>
                <p><T id="export.rows" /></p>
                <NumberInput disabled={!pdfOptions.slides} value={pdfOptions.grid[1]} min={1} max={7} on:change={(e) => (pdfOptions.grid[1] = e.detail)} />
            </CombinedInput>
            <CombinedInput>
                <p><T id="export.columns" /></p>
                <NumberInput disabled={pdfOptions.text} value={pdfOptions.grid[0]} min={1} max={6} on:change={(e) => (pdfOptions.grid[0] = e.detail)} />
            </CombinedInput>
        </div>

        <div>
            <h4 style="text-align: center;"><T id="export.preview" /></h4>
            <br />
            <div class="paper" bind:this={paper}>
                <Pdf {shows} options={pdfOptions} />
            </div>
        </div>
        <div style="display: flex;flex-direction: column;">
            <br />
            <br />
            <!-- aspect-ratio: 1/1.4142; -->
            <Button style="flex: 1;" on:click={() => paper.scrollBy(0, -paper.offsetHeight + 9.6)} dark><Icon id="up" white /></Button>
            <Button style="flex: 1;" on:click={() => paper.scrollBy(0, paper.offsetHeight - 7.001)} dark><Icon id="down" white /></Button>
        </div>
    </div>

    <hr />
{/if}

{#if loading}
    <Center>
        <Loader />
    </Center>
{/if}

<FolderPicker id="EXPORT">
    <Icon id="folder" right />
    {#if $exportPath}
        {$exportPath}
    {:else}
        <T id="inputs.change_folder" />
    {/if}
</FolderPicker>

<!-- TODO: all as one file -->
<!-- {#if shows.length > 1 && format.id !== "project"}
  <span>
    <p><T id="export.oneFile" /></p>
    <div class="alignRight">
        <Checkbox disabled={shows.length < 2} checked={pdfOptions.oneFile} on:change={(e) => updatePdfOptions(e, "oneFile")} />
    </div>
  </span>
{/if} -->

<Button disabled={!shows.length} on:click={exportClick} center>
    <Icon id="export" right />
    <T id="export.export" />
    {#if shows.length > 1 && format.id !== "project"}
        <span style="opacity: 0.5;padding-left: 10px;">({shows.length})</span>
    {/if}
</Button>

<style>
    .paper {
        background-color: white;
        aspect-ratio: 210/297;
        width: 800px;
        zoom: 0.4;
        overflow: auto;
    }

    .paper::-webkit-scrollbar-track,
    .paper::-webkit-scrollbar-corner {
        background: rgb(0 0 0 / 0.05);
    }
    .paper::-webkit-scrollbar-thumb {
        background: rgb(0 0 0 / 0.3);
    }
    .paper::-webkit-scrollbar-thumb:hover {
        background: rgb(0 0 0 / 0.5);
    }

    .options {
        display: flex;
        flex-direction: column;
    }

    h4 {
        color: var(--text);
    }

    hr {
        border: none;
        height: 2px;
        margin: 20px 0;
        background-color: var(--primary-lighter);
    }
</style>
