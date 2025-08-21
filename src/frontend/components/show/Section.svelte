<script lang="ts">
    import { actions, activeProject, activeShow, dictionary, projects, special } from "../../stores"
    import { getActionIcon, runAction } from "../actions/actions"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Dropdown from "../inputs/Dropdown.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
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
        if (!$activeProject) return

        projects.update((a) => {
            let index = a[$activeProject!].shows.findIndex((a) => a.id === section.id)
            if (index >= 0) a[$activeProject!].shows[index].name = e.target.value || ""
            return a
        })
    }

    function keydown(e: KeyboardEvent) {
        if (e.key !== "Enter") return
        ;(document.activeElement as any)?.blur()
    }

    $: actionOptions = [
        { id: "", name: "—" },
        ...Object.entries($actions)
            .map(([id, a]) => ({ id, name: a.name }))
            .sort((a, b) => a.name?.localeCompare(b.name))
    ]
    function updateTrigger(e: any) {
        special.update((a) => {
            a.sectionTriggerAction = e.detail.id
            return a
        })
    }

    function updateTriggerLocal(e: any) {
        let actionId = e.detail.id

        projects.update((a) => {
            a[$activeProject!].shows[section.index].data = { settings: { triggerAction: actionId } }
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
        <!-- WIP change color? -->

        <!-- GLOBAL -->
        <h5><T id="groups.global" /></h5>

        <CombinedInput>
            <p><T id="settings.section_trigger_action" /></p>
            <Dropdown disabled={localAction && $actions[localAction]} options={actionOptions} value={actionOptions.find((a) => a.id === $special.sectionTriggerAction || "")?.name || "—"} on:click={updateTrigger} />
        </CombinedInput>

        <h5><T id="groups.current" /></h5>

        <CombinedInput>
            <p><T id="settings.section_trigger_action" /></p>
            <Dropdown options={actionOptions} value={actionOptions.find((a) => a.id === localAction)?.name || "—"} on:click={updateTriggerLocal} />
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

    h5 {
        overflow: visible;
        text-align: center;
        color: var(--text);
        text-transform: uppercase;

        padding: 20px;
    }

    .settings {
        flex: 1;
        /* background-color: var(--primary); */
    }
</style>
