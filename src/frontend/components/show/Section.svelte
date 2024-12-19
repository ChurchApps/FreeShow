<script lang="ts">
    import { activeProject, activeShow, dictionary, midiIn, projects, special } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Dropdown from "../inputs/Dropdown.svelte"
    import TextInput from "../inputs/TextInput.svelte"
    import Notes from "./tools/Notes.svelte"

    export let section: any

    let note: string = ""
    $: if ($activeShow !== null || section) updateNote()

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

    function keydown(e: any) {
        if (e.key !== "Enter") return
        ;(document.activeElement as any)?.blur()
    }

    $: actionOptions = [
        { id: "", name: "—" },
        ...Object.entries($midiIn)
            .map(([id, a]) => ({ id, name: a.name }))
            .sort((a, b) => a.name?.localeCompare(b.name)),
    ]
    function updateTrigger(e: any) {
        special.update((a) => {
            a.sectionTriggerAction = e.detail.id
            return a
        })
    }

    let settingsOpened: boolean = false

    $: sectionUpdated = $projects[$activeProject || ""]?.shows[section.index] || {}
</script>

{#if settingsOpened}
    <div class="settings">
        <!-- WIP change color? -->

        <!-- GLOBAL -->

        <CombinedInput>
            <p><T id="settings.section_trigger_action" /></p>
            <Dropdown options={actionOptions} value={actionOptions.find((a) => a.id === $special.sectionTriggerAction || "")?.name || "—"} on:click={updateTrigger} />
        </CombinedInput>
    </div>
{:else}
    {#key section}
        <h4 id="sectionTitle" class:empty={!sectionUpdated?.name} style="border-bottom: 2px solid {sectionUpdated.color || 'var(--primary-darker);'}">
            <TextInput value={section?.name || ""} placeholder={$dictionary.main?.unnamed} on:input={updateName} on:keydown={keydown} />
        </h4>
        <!-- WIP suggest titles based on previous titles? (maybe not needed as we have project templates) -->

        <Notes value={note} on:edit={edit} />
    {/key}
{/if}

<div class="settingsButton">
    <Button title={$dictionary.menu?.settings} on:click={() => (settingsOpened = !settingsOpened)} style="padding: 10px;" dark>
        <Icon id="settings" white={settingsOpened} size={1.1} />
    </Button>
</div>

<style>
    h4 {
        font-size: 2em;
    }

    h4 :global(input) {
        background-color: var(--primary-darkest);
    }
    /* ::placeholder opacity does not work for some reason */
    h4.empty :global(input::placeholder) {
        color: rgb(255 255 255 / 0.4);
    }

    .settings {
        flex: 1;
        /* background-color: var(--primary); */
    }

    .settingsButton {
        position: absolute;
        bottom: 0;
        right: 0;
    }
</style>
