<script lang="ts">
    import { openedFolders } from "../../stores"
    import type { Tree } from "../../../types/Projects"
    import SelectElem from "../system/SelectElem.svelte"
    import ProjectButton from "../inputs/ProjectButton.svelte"
    import ProjectFolder from "../inputs/ProjectFolder.svelte"
    import Center from "../system/Center.svelte"
    import T from "../helpers/T.svelte"

    export let tree: Tree[]

    function checkIfShown(project: any) {
        let allOpened = true
        project.path!.split("/").forEach((id: string) => {
            if (id.length && !$openedFolders.includes(id)) allOpened = false
        })
        return allOpened
    }
</script>

{#if tree.length}
    {#each tree as project}
        {@const opened = $openedFolders.includes(project.id || "")}
        {@const shown = checkIfShown(project)}
        <div style="margin-left: {8 * (project.index || 0)}px;background-color: rgb(255 255 255 / {0.01 * (project.index || 0)});">
            <!-- , path: project.path -->
            <SelectElem id={project.type || "project"} data={{ type: project.type || "project", id: project.id }} draggable trigger="column" borders="center">
                {#if project.type === "folder" && (project.parent === "/" || shown)}
                    <ProjectFolder {project} {opened} />
                {:else if project.id && shown}
                    <ProjectButton name={project.name} parent={project.parent} id={project.id} />
                {/if}
            </SelectElem>
        </div>
    {/each}
{:else}
    <Center faded>
        <T id="empty.general" />
    </Center>
{/if}
