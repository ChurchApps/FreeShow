<script lang="ts">
    import { actions, activeProject, activeShow, projects, special } from "../../stores"
    import { translateText } from "../../utils/language"
    import { getActionIcon, runAction } from "../actions/actions"
    import { keysToID, sortByName } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import InputRow from "../input/InputRow.svelte"
    import Title from "../input/Title.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../inputs/MaterialDropdown.svelte"
    import MaterialTimePicker from "../inputs/MaterialTimePicker.svelte"
    import TextInput from "../inputs/TextInput.svelte"
    import Notes from "./tools/Notes.svelte"

    export let section: any

    let note = ""
    $: if ($activeShow !== null || section) updateNote()

    function updateNote() {
        note = $projects[$activeProject || ""]?.shows[section.index]?.notes || ""
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
        updateSection("name", e.target.value || "")
    }

    function updateSection(key: string, value: any) {
        if (!$activeProject) return

        projects.update((a) => {
            let index = a[$activeProject!].shows.findIndex((a) => a.id === section.id)
            if (index >= 0) a[$activeProject!].shows[index][key] = value
            return a
        })
    }

    function keydown(e: KeyboardEvent) {
        if (e.key !== "Enter") return
        ;(document.activeElement as any)?.blur()
    }

    $: actionOptions = sortByName(keysToID($actions)).map((a) => ({ value: a.id, label: a.name }))

    function updateTrigger(e: any) {
        special.update((a) => {
            a.sectionTriggerAction = e.detail
            return a
        })
    }

    function updateTriggerLocal(e: any) {
        let actionId = e.detail
        updateSectionData("settings", { triggerAction: actionId })
    }

    function updateSectionData(key: string, value: any) {
        projects.update((a) => {
            const currentData = a[$activeProject!].shows[section.index].data || {}
            a[$activeProject!].shows[section.index].data = { ...currentData, [key]: value }
            return a
        })
    }

    let settingsOpened = false

    $: sectionUpdated = $projects[$activeProject || ""]?.shows[section.index] || {}
    $: localAction = $projects[$activeProject || ""]?.shows?.[section.index]?.data?.settings?.triggerAction || ""

    $: currentActionId = localAction || $special.sectionTriggerAction
    $: currentAction = currentActionId ? { ...$actions[currentActionId], id: currentActionId } : null
</script>

{#if settingsOpened}
    <div class="settings">
        <Title label="popup.action" icon="actions" />
        <div class="info">{translateText("settings.section_trigger_action")}</div>

        <InputRow>
            <MaterialDropdown label="groups.global" disabled={localAction && $actions[localAction]} options={actionOptions} value={$special.sectionTriggerAction} on:change={updateTrigger} allowEmpty />
            <MaterialDropdown label="groups.current" options={actionOptions} value={localAction} on:change={updateTriggerLocal} allowEmpty />
        </InputRow>
    </div>
{:else}
    {#key section}
        <InputRow>
            <h4 id="sectionTitle" class:empty={!sectionUpdated?.name} style="flex: 6;border-bottom: 2px solid {sectionUpdated.color || 'var(--primary-darker);'}">
                <TextInput value={section?.name || ""} placeholder={translateText("main.unnamed")} on:input={updateName} on:keydown={keydown} />
            </h4>
            <!-- WIP suggest titles based on previous titles? (maybe not needed as we have project templates) -->

            <MaterialTimePicker label="calendar.time" value={section?.data?.time} style="flex: 1;" on:change={(e) => updateSectionData("time", e.detail)} />
        </InputRow>

        <Notes value={note} on:edit={edit} />
    {/key}
{/if}

{#if currentAction && !settingsOpened}
    <FloatingInputs side="left" onlyOne>
        <MaterialButton title="actions.run_action" on:click={() => runAction(currentAction)}>
            <Icon id={getActionIcon(currentActionId)} />
            {currentAction.name}
        </MaterialButton>
    </FloatingInputs>
{/if}

<FloatingInputs round>
    <MaterialButton isActive={settingsOpened} title="menu.settings" on:click={() => (settingsOpened = !settingsOpened)}>
        <Icon size={1.1} id="options" white={!settingsOpened} />
    </MaterialButton>
</FloatingInputs>

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
        margin: 10px;
        padding: 10px;

        /* flex: 1; */
        margin-block-end: auto;
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
    }

    .settings .info {
        opacity: 0.8;
        font-size: 0.9em;
        margin-bottom: 10px;
    }
</style>
