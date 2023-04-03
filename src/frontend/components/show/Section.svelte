<script lang="ts">
    import { activeProject, activeShow, projects } from "../../stores"
    import TextInput from "../inputs/TextInput.svelte"
    import Notes from "./tools/Notes.svelte"

    export let section: any

    let note: string = ""
    $: if ($activeShow !== null) updateNote()

    function updateNote() {
        note = $projects[$activeProject!].shows[section.index]?.notes || ""
    }

    function edit(e: any) {
        if (section.notes === e.detail || !$activeProject) return

        projects.update((a) => {
            let index = a[$activeProject!].shows.findIndex((a) => a.id === section.id)
            if (index >= 0) a[$activeProject!].shows[index].notes = e.detail
            return a
        })
    }

    function updateName(e: any) {
        if (!$activeProject) return

        projects.update((a) => {
            let index = a[$activeProject!].shows.findIndex((a) => a.id === section.id)
            if (index >= 0) a[$activeProject!].shows[index].name = e.target.value || ""
            return a
        })
    }
</script>

{#key section}
    <h4 id="sectionTitle"><TextInput value={section?.name || ""} on:change={updateName} /></h4>

    <Notes value={note} on:edit={edit} />
{/key}

<style>
    h4 {
        font-size: 2em;
    }

    h4 :global(input) {
        /* text-align: center; */
        /* color: var(--secondary); */
        background-color: var(--primary-darkest);
    }
</style>
