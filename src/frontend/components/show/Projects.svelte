<script lang="ts">
    import { slide } from "svelte/transition"
    import { uid } from "uid"
    import { Main } from "../../../types/IPC/Main"
    import type { Project, Tree } from "../../../types/Projects"
    import { sendMain } from "../../IPC/main"
    import { activeProject, activeRename, drawer, editingProjectTemplate, focusMode, folders, openedFolders, projects, projectTemplates, projectView, showRecentlyUsedProjects, sorted, special } from "../../stores"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import { exportProject } from "../export/project"
    import { clone, keysToID, removeDuplicateValues, sortByName } from "../helpers/array"
    import { history } from "../helpers/history"
    import { getDefaultProjectName, getProjectName, projectReplacers } from "../helpers/historyHelpers"
    import Icon from "../helpers/Icon.svelte"
    import { checkInput } from "../helpers/showActions"
    import T from "../helpers/T.svelte"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import HiddenInput from "../inputs/HiddenInput.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../inputs/MaterialToggleSwitch.svelte"
    import Autoscroll from "../system/Autoscroll.svelte"
    import DropArea from "../system/DropArea.svelte"
    import { getRecentlyUsedProjects, openProject } from "./project"
    import ProjectContentList from "./ProjectContentList.svelte"
    import ProjectList from "./ProjectList.svelte"

    let tree: Tree[] = []

    if (Object.keys($projects).length) deleteDuplicatedProjects()
    function deleteDuplicatedProjects() {
        projects.set(removeDuplicateValues($projects))
    }

    let profile = getAccess("projects")
    let readOnly = profile.global === "read"

    $: f = Object.entries($folders)
        .filter(([id, a]) => !a.deleted && profile[id] !== "none")
        .map(([id, folder]) => ({ ...folder, id, type: "folder" as const }))
    $: p = Object.entries($projects)
        .filter(([_, a]) => !a.deleted)
        .map(([id, project]) => ({ ...project, parent: $folders[project.parent] ? project.parent : "/", id, shows: [] as any }))
    $: templates = sortByName(keysToID($projectTemplates)).filter((a) => !a.deleted)

    $: {
        let sortType = $sorted.projects?.type || "name"
        // sort by name regardless because project folders <= 0.9.5 doesn't have created date
        let sortedFolders = sortByName(f)
        let sortedProjects = sortByName(p)
        if (sortType === "created") {
            sortedFolders = sortedFolders.sort((a, b) => (b.created || 0) - (a.created || 0))
            sortedProjects = sortedProjects.sort((a, b) => (b.created || 0) - (a.created || 0))
        } else if (sortType === "modified") {
            sortedProjects = sortedProjects.sort((a, b) => (b.modified || 0) - (a.modified || 0))
        } else if (sortType === "name_des") {
            sortedFolders = sortedFolders.reverse()
            sortedProjects = sortedProjects.reverse()
        }

        // sort by archived state
        sortedProjects = sortedProjects.sort((a, b) => (!!a.archived === !!b.archived ? 0 : a.archived ? 1 : -1))

        tree = [...(sortedFolders as any), ...sortedProjects]

        // update parents (if folders are missing)
        tree = tree.map((a) => ({ ...a, parent: !$folders[a.parent] || $folders[a.parent].deleted ? "/" : a.parent }))

        folderSorted = []
        sortFolders()
        tree = folderSorted
    }

    let folderSorted: Tree[] = []
    function sortFolders(parent = "/", index = 0, path = "") {
        let filtered = tree.filter((a) => a.parent === parent).map((a) => ({ ...a, index, path }))
        filtered.forEach((folder) => {
            const rootParentId = path.split("/")[0] || folder.id
            if (profile[rootParentId] === "none") return

            const isReadOnly = profile[rootParentId] === "read"
            folder.readOnly = isReadOnly

            folderSorted.push(folder)
            if (folder.type !== "folder") return

            sortFolders(folder.id, index + 1, path + folder.id + "/")
        })
    }

    $: projectActive = !$projectView && $activeProject !== null
    $: currentProject = $activeProject ? $projects[$activeProject] : null

    function createProject(folder = false) {
        let parent = interactedFolder || ($folders[currentProject?.parent || ""] ? currentProject?.parent || "/" : "/")
        if (profile[parent] === "none" || tree.find((a) => a.id === parent)?.readOnly) parent = "/"
        history({ id: "UPDATE", newData: { replace: { parent } }, location: { page: "show", id: `project${folder ? "_folder" : ""}` } })
    }

    function createProjectTemplate() {
        const id = uid()
        const project = { name: "", parent: "/", shows: [], created: 0 }

        activeRename.set("project_" + id)

        history({ id: "UPDATE", newData: { data: project }, oldData: { id }, location: { page: "show", id: "project_template" } })
    }

    // autoscroll
    let listScrollElem: HTMLElement | undefined
    let listOffset = -1
    $: if (listScrollElem) {
        let time = tree.length * 0.5 + 20
        setTimeout(() => {
            if (!listScrollElem) return
            const projectElements = [...(listScrollElem.querySelector(".fullTree")?.querySelectorAll("button") || [])]
            const activeProject = projectElements.findLast((a) => a?.classList.contains("isActive"))
            if (!activeProject) return

            listOffset = Math.max(0, ((activeProject.closest(".projectItem") as HTMLElement)?.offsetTop || 0) + listScrollElem.offsetTop - ($drawer.height < 400 ? 120 : 20))
        }, time)
    }

    function back() {
        projectView.set(true)
        showRecentlyUsedProjects.set(false)
        editingProjectTemplate.set("")
    }

    // last used
    let recentlyUsedList: any[] = []
    // listen for $projects updates in case it has been updated from sync
    $: if ($showRecentlyUsedProjects && $projects) lastUsed()
    else recentlyUsedList = []

    function lastUsed() {
        recentlyUsedList = getRecentlyUsedProjects()
        if (!recentlyUsedList.length) showRecentlyUsedProjects.set(false)
    }

    // most recently interacted with folder (to put new project inside)
    // if no project is opened this will also select an opened folder if any
    let interactedFolder = ""
    let previouslyOpened: string[] = []
    $: if ($openedFolders) checkInteraction()
    function checkInteraction() {
        if ($openedFolders.length > previouslyOpened.length) {
            $openedFolders.forEach((folderId) => {
                if (!previouslyOpened.includes(folderId)) interactedFolder = folderId
            })
        }
        previouslyOpened = clone($openedFolders)
    }
    $: if (!$folders[interactedFolder]) interactedFolder = ""

    // TEMPLATE

    function createFromTemplate(e: any, id: string) {
        // prevent extra single click on (template) double click
        let { ctrl, doubleClick, target } = e.detail

        if (target.closest(".edit") || target.querySelector(".edit") || editActive || doubleClick) return

        let project = clone($projectTemplates[id])
        if (!project) return

        project.parent = interactedFolder || ($folders[currentProject?.parent || ""] ? currentProject?.parent || "/" : "/")

        if (project.name.includes("{") ? !ctrl : ctrl)
            project.name = getProjectName({ default_project_name: project.name }) // replace actual name values
        else project.name = getProjectName() // use default (auto) project name

        let projectId = uid()
        history({ id: "UPDATE", newData: { data: project }, oldData: { id: projectId }, location: { page: "show", id: "project" } })
        setTimeout(() => activeRename.set("project_" + projectId))
    }

    let editActive = false
    function rename(value: string, id: string) {
        // if (editActive) return

        history({ id: "UPDATE", newData: { key: "name", data: value }, oldData: { id }, location: { page: "show", id: "project_template" } })
    }

    // RECENTLY USED

    function openRecentlyUsed(e: any, id: string) {
        if (e.detail.target.closest(".edit") || e.detail.target.querySelector(".edit")) return

        openProject(id, !e.detail.alt)
    }

    function getRootFolder(project: Project) {
        let folder = $folders[project.parent]
        if (!folder) return "/"

        let iterations = 0
        while ($folders[folder.parent]?.parent !== "/" && iterations < 20) {
            if (!$folders[folder.parent]) break
            folder = $folders[folder.parent]
            if (!folder) break
            iterations++
        }

        return folder?.parent
    }

    function importProject() {
        const extensions = ["project", "shows", "json", "zip"]
        const name = translateText("formats.project")
        sendMain(Main.IMPORT, { channel: "freeshow_project", format: { extensions, name } })
    }

    let contentScrollElem: HTMLElement | undefined
    let listScrollY = 0
    let isScrollbarVisible = true
    $: if (listScrollElem) startScrollListener(listScrollElem)
    $: if (contentScrollElem) startScrollListener(contentScrollElem)
    $: if (!listScrollElem && !contentScrollElem) {
        listScrollY = 0
        // isScrollbarVisible = false
    }
    function startScrollListener(scrollElem: HTMLElement | undefined) {
        listScrollY = 0
        // isScrollbarVisible = false

        scrollElem = scrollElem?.querySelector(".droparea") as HTMLElement | undefined
        if (!scrollElem) return

        // should be automatically removed when element is removed
        scrollElem.addEventListener("scroll", scrollHandler)

        function scrollHandler() {
            listScrollY = scrollElem?.scrollTop || 0
        }
        // function resizeHandler() {
        //     isScrollbarVisible = scrollElem ? scrollElem.scrollHeight > scrollElem.clientHeight : false
        // }
    }

    let addMenuOpen = false
    $: if (projectActive) addMenuOpen = false

    let showProjectsOptions = false
    let showProjectDropdown = false

    function mousedown(e: any) {
        if (!e.target.closest(".projectDropdown") && !e.target.closest(".header .right")) showProjectDropdown = false
        // if (!e.target.closest(".projectsOptions") && !e.target.closest(".header .right")) showProjectsOptions = false
        if (!e.target.closest(".addMenu") && !e.target.closest(".addButton")) addMenuOpen = false
    }

    // options

    function updateSpecial(value: any, key: string, allowEmpty = false) {
        special.update((a) => {
            if (!allowEmpty && !value) delete a[key]
            else a[key] = value

            return a
        })
    }

    $: projectName = $special.default_project_name ?? getDefaultProjectName()

    let projectReplacerTitle = getReplacerTitle()
    function getReplacerTitle() {
        let titles: string[] = []
        projectReplacers.forEach((a) => {
            if (a.id === "D0") titles.push("")
            else titles.push(`• <b>${a.title}:</b> {${a.id}}`)
        })

        return titles.join("<br>")
    }

    function lockSections() {
        const projectId = $activeProject || ""
        projects.update((a) => {
            if (!a[projectId]) return a

            a[projectId].sectionsLocked = !a[projectId].sectionsLocked
            return a
        })
    }
</script>

<svelte:window on:keydown={checkInput} on:mousedown={mousedown} />

<div class="main" class:focusMode={$focusMode}>
    <span class="tabs">
        {#if projectActive || recentlyUsedList.length}
            {#if !$focusMode}
                <div class="header {recentlyUsedList.length ? '' : 'context #projectTab'}" class:shadow={listScrollY > 0} class:isScrollbarVisible data-title={translateText("remote.project: ") + `<b>${currentProject?.name || ""}</b>`}>
                    <div class="left context">
                        <MaterialButton style="width: 42px;height: 100%;padding: 0.3em 0.5em;" icon="back" iconSize={1.1} title="remote.projects" on:click={back} />
                    </div>
                    <!-- {recentlyUsedList.length ? '' : 'border-bottom: 1px solid var(--secondary);'} -->

                    <!-- <Icon id="project" white right /> -->
                    {#if recentlyUsedList.length}
                        <p style="margin-left: 42px;font-style: italic;opacity: 0.7;font-size: 1.08em;"><T id="info.recently_used" /></p>
                    {:else}
                        <p style="max-width: 80%;font-size: 1.08em;">
                            {#if currentProject?.name}
                                {currentProject.name}
                            {:else}
                                <span style="opacity: 0.5;font-style: italic;"><T id="main.unnamed" /></span>
                            {/if}
                        </p>

                        <div class="right context">
                            <MaterialButton style="width: 32px;height: 100%;padding: 0.3em 0.5em;border-bottom-right-radius: 10px;{showProjectDropdown ? '' : 'opacity: 0.8;'}" title="create_show.more_options" icon="more" on:click={() => (showProjectDropdown = !showProjectDropdown)} white={!showProjectDropdown}>
                                <!-- prevent force "white" -->
                                <span style="display: none;"></span>
                            </MaterialButton>

                            {#if showProjectDropdown && currentProject}
                                <!-- WIP use context menu style -->
                                <div class="projectDropdown" transition:slide={{ duration: 150 }} role="none" on:click={() => (showProjectDropdown = false)}>
                                    {#if currentProject.sourcePath}
                                        <MaterialButton title="actions.save_to_file" icon="save" on:click={() => exportProject(currentProject, $activeProject || "", currentProject.sourcePath)} white>
                                            <T id="actions.save_to_file" />
                                        </MaterialButton>
                                    {/if}

                                    <!-- export -->
                                    <!-- WIP set sourcePath to export path -->
                                    <MaterialButton title="actions.export" icon="export" on:click={() => exportProject(currentProject, $activeProject || "")} white>
                                        <T id="actions.export" />
                                    </MaterialButton>

                                    <div class="DIVIDER"></div>

                                    {#if currentProject.shows?.some((a) => a.type === "section")}
                                        <MaterialButton title="actions.lock_sections" icon="lock" on:click={() => lockSections()} white={!currentProject.sectionsLocked}>
                                            {#if currentProject.sectionsLocked}
                                                <Icon id="check" size={0.7} white />
                                            {/if}

                                            <T id="actions.lock_sections" />
                                        </MaterialButton>

                                        <div class="DIVIDER"></div>
                                    {/if}

                                    <MaterialButton title="timeline.toggle_timeline" on:click={() => special.update((a) => ({ ...a, projectTimelineActive: !a.projectTimelineActive }))}>
                                        <Icon id="timeline" white={!$special.projectTimelineActive} />

                                        {#if $special.projectTimelineActive}
                                            <Icon id="check" size={0.7} white />
                                        {/if}

                                        <p><T id="timeline.toggle_timeline" /></p>
                                    </MaterialButton>
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            {/if}
        {:else if $editingProjectTemplate}
            <div class="header {recentlyUsedList.length ? '' : 'context #projectTab'}" class:shadow={listScrollY > 0} class:isScrollbarVisible data-title={translateText("remote.project: ") + `<b>${currentProject?.name || ""}</b>`}>
                <div class="left context">
                    <MaterialButton style="width: 42px;height: 100%;padding: 0.3em 0.5em;" icon="back" iconSize={1.1} title="remote.projects" on:click={back} />
                </div>

                <p style="max-width: 80%;">{$projectTemplates[$editingProjectTemplate]?.name || ""}</p>

                <div class="right" style="display: flex;align-items: center;margin-right: 8px;opacity: 0.6;" data-title={translateText("actions.project_template")}>
                    <Icon id="templates" size={0.9} white />
                </div>
            </div>
        {:else}
            <div class="header context #projects" class:shadow={listScrollY > 0} class:isScrollbarVisible data-title={translateText("<b>remote.projects</b><br>guide_description.project_manage<br>guide_description.project_create")}>
                {#if showProjectsOptions}
                    <div class="left context">
                        <MaterialButton style="width: 42px;height: 100%;padding: 0.3em 0.5em;" icon="back" iconSize={1.1} title="actions.back" on:click={() => (showProjectsOptions = false)} />
                    </div>
                {/if}

                <!-- <Icon id="folder" white right /> -->
                <p style="font-size: 1.08em;{showProjectsOptions ? 'margin-left: 20px;' : 'margin-right: 20px;'}"><T id="remote.projects" /></p>

                {#if !showProjectsOptions}
                    <div class="right">
                        <MaterialButton style="width: 32px;height: 100%;padding: 0.3em 0.5em;border-bottom-right-radius: 10px;{showProjectDropdown ? '' : 'opacity: 0.8;'}" title="create_show.more_options" icon="more" on:click={() => (showProjectDropdown = !showProjectDropdown)} white={!showProjectDropdown}>
                            <span style="display: none;"></span>
                        </MaterialButton>

                        {#if showProjectDropdown}
                            <div class="projectDropdown" transition:slide={{ duration: 150 }} role="none" on:click={() => (showProjectDropdown = false)}>
                                <MaterialButton title="edit.options" icon="options" on:click={() => (showProjectsOptions = !showProjectsOptions)} white>
                                    <T id="edit.options" />
                                </MaterialButton>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        {/if}
    </span>

    {#if recentlyUsedList.length}
        <div id="projectsArea" class="list projects" style="overflow: auto;padding-top: 30px;">
            {#each recentlyUsedList as project}
                {@const rootParentId = getRootFolder(project)}
                {@const isVisible = profile[rootParentId] !== "none"}

                {#if isVisible}
                    <MaterialButton style="width: 100%;padding: 0.08rem 0.65rem;font-weight: normal;" title="actions.id_select_project: <b>{project.name}</b>" on:click={(e) => openRecentlyUsed(e, project.id)} isActive={$activeProject === project.id} tab>
                        <Icon id="project" />
                        <HiddenInput value={project.name} id={"project_" + project.id} allowEdit={false} />
                    </MaterialButton>
                {/if}
            {/each}
        </div>
    {:else if $editingProjectTemplate}
        <ProjectContentList tree={[]} on:scrollElem={(e) => (contentScrollElem = e.detail)} isTemplate />
    {:else if !projectActive && showProjectsOptions}
        <div class="options">
            <MaterialTextInput label="settings.default_project_name<span style='opacity: 0.5;padding-left: 8px;font-size: 0.8em;color: var(--text);'>{getProjectName($special)}</span>" title={projectReplacerTitle} value={projectName} defaultValue={getDefaultProjectName()} on:change={(e) => updateSpecial(e.detail, "default_project_name", true)} />
            <MaterialToggleSwitch label="settings.startup_projects_list" checked={$special.startupProjectsList} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "startupProjectsList")} />
        </div>
    {:else if !projectActive}
        <div id="projectsArea" class:float={!templates.length} class="list projects {readOnly ? '' : 'context #projects'}">
            <Autoscroll offset={listOffset} bind:scrollElem={listScrollElem} timeout={150} smoothTimeout={0}>
                <DropArea id="projects">
                    <ProjectList {tree} {readOnly} />
                </DropArea>
            </Autoscroll>

            <!-- <FloatingInputs>
                <MaterialButton icon="folder" title="new.folder" on:click={() => createProject(true)} white />
                <div class="divider"></div>
                <MaterialButton icon="add" title="<b>new.project</b><br>tooltip.project" on:click={() => createProject()}>
                    {#if !$labelsDisabled}<T id="new.project" />{/if}
                </MaterialButton>
            </FloatingInputs> -->

            {#if addMenuOpen}
                <div class="addMenu" transition:slide={{ duration: 100 }} role="none" on:click={() => (addMenuOpen = false)}>
                    <MaterialButton variant="outlined" icon="project" title="<b>new.project</b><br>tooltip.project" on:click={() => createProject()}>
                        <T id="formats.project" />
                    </MaterialButton>

                    <MaterialButton variant="outlined" icon="folder" title="new.folder" on:click={() => createProject(true)} white>
                        <T id="media.folder_type" />
                    </MaterialButton>

                    <MaterialButton variant="outlined" icon="templates" title="actions.project_template" on:click={createProjectTemplate} white>
                        <T id="actions.project_template" />
                    </MaterialButton>

                    <MaterialButton variant="outlined" icon="import" title="actions.import: formats.project" on:click={importProject} white>
                        <T id="actions.import" />

                        <div class="actionType">
                            <Icon id="folder" size={0.7} white />
                        </div>
                    </MaterialButton>
                </div>
            {/if}

            <FloatingInputs gradient style="width: 50px;height: 50px;border: none;">
                <MaterialButton class="addButton" title="context.addToProject" style="width: 50px;height: 50px;" on:click={() => (addMenuOpen = !addMenuOpen)} on:dblclick={() => (addMenuOpen ? null : createProject())}>
                    <Icon id="add" size={1.5} style={addMenuOpen ? "transform: rotate(135deg);" : ""} white />
                </MaterialButton>
            </FloatingInputs>
        </div>

        {#if templates.length}
            <div class="projectTemplates">
                <div class="title">{translateText("tabs.templates")}</div>
                <div class="scroll">
                    {#each templates as project}
                        <MaterialButton id={project.id} style="width: 100%;padding: 0.1rem 0.65rem;font-weight: normal;" on:click={(e) => createFromTemplate(e, project.id)} class="context #project_template{readOnly ? '_readonly' : ''}" isActive={$activeProject === project.id} tab>
                            <Icon id="templates" white={$projects[project.id]?.archived} />
                            <HiddenInput value={project.name} id={"project_" + project.id} on:edit={(e) => rename(e.detail.value, project.id)} bind:edit={editActive} />
                        </MaterialButton>
                    {/each}
                </div>
            </div>
        {/if}
    {:else}
        <ProjectContentList {tree} {recentlyUsedList} on:scrollElem={(e) => (contentScrollElem = e.detail)} />
    {/if}
</div>

<style>
    .main {
        /* max-height: 50%; */
        /* width: 100%; */
        position: relative;
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
    }

    .tabs {
        display: flex;
        /* background-color: var(--primary-darker); */
        /* width: 100%;
    justify-content: space-between; */
    }

    .tabs .header {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        /* left: 5px;
        width: calc(100% - (5px * 2)); */

        padding: 0.2em 0.8em;
        font-weight: 600;

        height: 30px;

        /* padding: 5px 0; */

        display: flex;
        justify-content: center;
        align-items: center;

        backdrop-filter: blur(10px);

        border-bottom-left-radius: 10px;
        border-bottom-right-radius: 10px;

        background-color: rgb(0 0 10 / 0.3);

        z-index: 200;
        transition: box-shadow 0.2s ease;
    }
    .tabs .header.shadow {
        background-color: rgb(0 0 10 / 0.12);
        box-shadow: 0 2px 4px rgb(0 0 10 / 0.3);
    }
    .tabs .header.isScrollbarVisible {
        left: 0;
        width: calc(100% - 8px);
        /* left: 8px;
        width: calc(100% - (8px * 2)); */
    }

    .header .left,
    .header .right {
        position: absolute;
        top: 0;
        height: 100%;
    }
    .header .left {
        left: 0;
    }
    .header .right {
        right: 0;
    }

    /* #projectsArea :global(.scroll) {
        padding-top: 33px;
    } */
    .main:not(.focusMode) :global(.scroll .droparea) {
        padding-top: 30px;
    }

    .list {
        position: relative;
        display: flex;
        flex-direction: column;
        /* overflow-y: auto;
    overflow-x: hidden; */
        overflow: hidden;
        /* height: 100%; */
        flex: 1;
    }

    .list.projects :global(.droparea) {
        /* "new project" buttons */
        padding-bottom: 57px;
    }

    .list :global(.section) {
        padding: 4px 40px;
        font-size: 0.8em;
        /* font-weight: bold; */
        width: 100%;
    }
    .list :global(.section.active) {
        outline-offset: -2px;
        outline: 2px solid var(--primary-lighter);
    }

    .projectTemplates {
        display: flex;
        flex-direction: column;

        border-top: 1px solid var(--primary-lighter);
        box-shadow: 0 -3px 5px rgb(0 0 0 / 0.05);

        background-color: var(--primary-darker);

        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
        overflow: hidden;
    }
    .projectTemplates .scroll {
        max-height: calc(33px * 4);
        overflow-y: auto;
    }

    .title {
        font-weight: 500;
        padding: 4px 14px;
        font-size: 0.8rem;
        opacity: 0.8;
        background: var(--primary-darkest);
        border-bottom: 1px solid var(--primary-lighter);
    }

    /* add menu */

    .addMenu {
        position: absolute;
        bottom: 70px; /* 10px + 50px + 10px */
        right: 12px;

        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .addMenu :global(button) {
        justify-content: start;
        padding: 10px 16px;

        border-radius: 50px;

        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);

        backdrop-filter: blur(10px);
    }

    .actionType {
        position: absolute;
        top: 50%;
        right: 14px;
        transform: translateY(-50%);

        display: flex;
        align-items: center;

        opacity: 0.2;
    }

    /* options */

    .options {
        margin-top: 30px;

        padding: 8px;
        padding-top: 10px;
    }

    /* dropdown */

    .projectDropdown {
        position: absolute;
        top: 31px;
        right: 5px;
        overflow: hidden;

        display: flex;
        flex-direction: column;
        align-items: flex-start;

        /* backdrop-filter: blur(10px);
        background-color: rgb(0 0 10 / 0.3); */

        background-color: var(--primary-darkest);
        border-radius: 6px;

        border: 1px solid var(--primary-lighter);

        z-index: 1;
        box-shadow: 0 2px 5px rgb(0 0 0 / 0.3);
    }

    .projectDropdown :global(button) {
        width: 100%;
        justify-content: start;
        padding: 8px 12px;
        border-radius: 0;

        font-weight: normal;
        font-size: 0.9em;
    }

    .projectDropdown .DIVIDER {
        width: 100%;
        height: 1px;
        background-color: var(--primary-lighter);
    }
</style>
