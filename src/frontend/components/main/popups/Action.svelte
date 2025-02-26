<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { uid } from "uid"
    import { activePopup, activeShow, drawerTabsData, midiIn, popupData, showsCache, templates, timers } from "../../../stores"
    import { translate } from "../../../utils/language"
    import CreateAction from "../../actions/CreateAction.svelte"
    import MidiValues from "../../actions/MidiValues.svelte"
    import { actionData } from "../../actions/actionData"
    import type { API_midi } from "../../actions/api"
    import { customActionActivations } from "../../actions/customActivation"
    import { convertOldMidiToNewAction, defaultMidiActionChannels, midiInListen } from "../../actions/midi"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, convertToOptions } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { updateCachedShows } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    $: id = $popupData.id || ""
    $: mode = $popupData.mode || ""

    let action: any = { name: "", triggers: [] }
    let actionMidi: API_midi = { type: "noteon", values: { note: 0, velocity: mode === "slide" ? 0 : -1, channel: 1 }, defaultValues: true }

    let loaded: boolean = false
    onMount(setAction)
    function setAction() {
        if (!id) {
            id = uid()
            popupData.set({ ...$popupData, id })
        } else if (mode === "template") {
            if (id) action = $templates[$popupData.templateId]?.settings?.actions?.find((a) => a.id === id) || action
            else id = uid()
        } else {
            // old
            let showMidi = _show().get("midi")?.[id]
            if (mode === "slide" && ($popupData.index !== undefined || $popupData.indexes?.length)) {
                let ref = _show().layouts("active").ref()[0] || []
                let layoutSlide = ref[$popupData.index ?? $popupData.indexes[0]] || {}
                let slideActions = layoutSlide.data?.actions?.slideActions || []
                let existingAction = slideActions.find((a) => a.id === id)
                if (existingAction) showMidi = existingAction
            }
            action = $midiIn[id] || showMidi || action

            action = convertOldMidiToNewAction(action)
        }

        if (!action.name) action.name = ""
        if (mode === "slide_midi") action.midiEnabled = true

        loaded = true
    }

    // saveSlide(true)
    onDestroy(removeEmptyAction)
    function removeEmptyAction(actionId = "") {
        let ref = _show().layouts("active").ref()[0] || []
        let indexes = $popupData.index !== undefined ? [$popupData.index] : $popupData.indexes
        if (!indexes) return

        let newActions: any[] = []
        let changed: boolean = false
        indexes.forEach((i) => {
            let layoutSlide = ref[i] || {}
            let actions = layoutSlide.data?.actions || {}
            let slideActions = actions.slideActions || []
            let existingActionIndex = slideActions.findIndex((a) => a.id === (actionId || id))

            // if actionId is set remove action regardless, else remove if empty
            if (existingActionIndex < 0 || (!actionId && slideActions[existingActionIndex].triggers?.[0])) {
                newActions.push(actions)
                return
            }

            slideActions.splice(existingActionIndex, 1)
            actions.slideActions = slideActions

            changed = true
            newActions.push(actions)
        })

        if (!changed) return
        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: newActions, indexes } })
    }

    let existingSearched: boolean = false
    $: if (action.triggers?.[0]) findExisting()
    function findExisting() {
        if (mode !== "slide" || ($popupData.index === undefined && !$popupData.indexes?.length) || existingSearched) return
        existingSearched = true

        let ref = _show().layouts("active").ref()[0] || []
        let layoutSlide = ref[$popupData.index ?? $popupData.indexes[0]] || {}
        let slideActions = layoutSlide.data?.actions?.slideActions || []
        // find any action with the same value, but different id
        let existingAction = slideActions.find((a) => a.triggers?.[0] === action.triggers?.[0] && (!id || a.id !== id))

        if (!existingAction) return

        // remove new action if already existing
        if (id !== existingAction.id && mode === "slide") removeEmptyAction(id)

        id = existingAction.id
        action = existingAction
        popupData.set({ ...$popupData, id })
    }

    function updateValue(key: string, e: any, checkbox: boolean = false) {
        let value = e.detail ?? e.target?.value ?? e
        if (checkbox) value = e.target?.checked

        action[key] = value
    }

    let autoActionName = ""
    function changeAction(e, index: number = -1) {
        let actionId = e.detail.id || ""
        if (!actionId) return

        const canAddMultiple = actionData[actionId]?.canAddMultiple
        if (canAddMultiple && !actionId.includes(":")) actionId += ":" + uid(5)

        if (e.detail.index !== undefined) index = e.detail.index

        // update action value instead of action id
        if (e.detail.actionValue) {
            if (!action.name) action.name = actionId
            if (!action.actionValues) action.actionValues = {}
            action.actionValues[actionId] = e.detail.actionValue
            return
        }

        // remove action id
        if (actionId === "remove") {
            if (index === undefined) index = action.triggers.length - 1
            action.triggers.splice(index)
            action = action
            return
        }

        if (!action.triggers) action.triggers = []
        // can't set if it exists already
        if (!canAddMultiple && action.triggers.find((id) => id === actionId)) return

        if (index > -1) action.triggers[index] = actionId
        else action.triggers.push(actionId)

        // set all MIDI values
        if (action.midiEnabled && action.midi?.defaultValues && defaultMidiActionChannels[actionId]) {
            action.midi = { ...action.midi, ...defaultMidiActionChannels[actionId] }
        }

        // auto name (if empty or not changed by user)
        if ((action.name || "") === autoActionName && action.triggers.length === 1) {
            autoActionName = translate(actionData[e.detail.id]?.name || "") || e.detail.id
            if (autoActionName) action.name = autoActionName
        }

        // reset velocity
        if (actionId.includes("index_") && action.midi?.values) {
            action.midi.values.velocity = mode === "slide" ? 0 : -1
        }

        // update
        action = action
        addTrigger = false

        // update names/icons
        if (mode === "slide") updateCachedShows($showsCache)
    }

    // TODO: history!
    // WIP MIDI remove unused / empty actions from slide

    let saveTimeout: any = 0
    $: if (action) {
        if (saveTimeout) clearTimeout(saveTimeout)
        saveTimeout = setTimeout(saveAction, 50)
    }
    function saveAction() {
        if (!loaded) return
        if (mode !== "slide_midi" && mode !== "slide" && mode !== "template" && !action.name) return

        if (action.midiEnabled && !action.midi) action.midi = actionMidi

        if (mode === "template") {
            let templateId = $popupData.templateId
            let template = $templates[templateId]
            if (!template) return activePopup.set(null)
            if (!action.triggers?.length) return

            let templateSettings = template?.settings || {}

            let actions = templateSettings.actions || []
            let existingIndex = actions.findIndex((a) => a.id === id || a.triggers?.[0] === action.triggers?.[0])
            if (existingIndex > -1) actions[existingIndex] = action
            else actions.push(action)

            templateSettings.actions = actions
            let newData = { key: "settings", data: templateSettings }
            history({ id: "UPDATE", newData, oldData: { id: templateId }, location: { page: "drawer", id: "template_settings", override: `actions_${templateId}` } })
        } else if (mode !== "slide") {
            let exists = !!$midiIn[id]
            midiIn.update((a) => {
                if (mode === "slide_midi") {
                    let shows = a[id]?.shows || []
                    let showId = $popupData.index === undefined && !$popupData.indexes?.length ? "" : $activeShow?.id || ""
                    if (showId && !shows.find((a) => a.id === showId)) shows.push({ id: showId })
                    action.shows = shows

                    if (action.midi?.defaultValues) delete action.midi.defaultValues
                }

                a[id] = clone(action)

                // set tag
                if (!exists && $drawerTabsData.functions?.activeSubTab === "actions" && $drawerTabsData.functions?.activeSubmenu) {
                    a[id].tags = [$drawerTabsData.functions?.activeSubmenu]
                }

                return a
            })

            midiInListen()
        } else if ($activeShow) {
            // WIP move this from show to action
            let showMidi = _show().get("midi") || {}
            if (showMidi[id]) {
                if (JSON.stringify(showMidi[id] || {}) === JSON.stringify(action)) return
                showMidi[id] = action
                _show().set({ key: "midi", value: showMidi })
                return
            }

            saveSlide()
        }
    }

    function saveSlide(remove: boolean = false) {
        let ref = _show().layouts("active").ref()[0]
        let indexes = $popupData.index !== undefined ? [$popupData.index] : $popupData.indexes
        if (!Array.isArray(indexes)) return

        let newActions: any[] = []
        let changed: boolean = false
        indexes.forEach((i) => {
            let actions = clone(ref[i]?.data?.actions) || {}
            if (!actions.slideActions) actions.slideActions = []

            let currentSlideActionIndex = actions.slideActions.findIndex((a) => a.id === id)
            if (currentSlideActionIndex < 0) {
                newActions.push(actions)
                return
            }

            if (remove) actions.slideActions.splice(currentSlideActionIndex, 1)
            else actions.slideActions[currentSlideActionIndex] = { ...action, id }

            changed = true
            newActions.push(actions)
        })

        if (!changed) return
        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: newActions, indexes } })
    }

    let addTrigger: boolean = false

    // set show when selected
    $: if (action.triggers?.find((a) => a === "start_show") && $popupData.showId) {
        let setShow = { id: "start_show", actionValue: { id: $popupData.showId } }
        changeAction({ detail: setShow }, $popupData.actionIndex)
    }

    // custom activations
    const customActivations = [{ id: "", name: "—" }, ...customActionActivations]
    $: customActivation = action.customActivation || (action.startupEnabled ? "startup" : "") || ""
    $: specificActivation = action.specificActivation || ""

    const specificActivations = {
        timer_end: {
            name: "items.timer",
            list: () => convertToOptions($timers),
        },
    }
    function getSpecificActivation(customActivation) {
        return [{ id: "", name: "$:actions.any:$" }, ...specificActivations[customActivation].list()]
    }

    // keys
    const keys = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"]
    let shortcuts: any[] = [{ name: "—", id: "" }, ...keys.map((key) => ({ name: key }))]
</script>

<div style="min-width: 45vw;min-height: 50vh;">
    {#if mode === "slide" || mode === "template"}
        <CreateAction mainId={id} actionId={action.triggers?.[0] || ""} existingActions={action.triggers || []} actionValue={action.actionValues?.[action.triggers?.[0] || ""]} on:change={changeAction} list />
    {:else}
        {#if mode !== "slide_midi"}
            <CombinedInput>
                <p><T id="midi.name" /></p>
                <TextInput value={action.name} on:change={(e) => updateValue("name", e)} />
            </CombinedInput>

            <!-- multiple actions -->
            <div class="actions" style="margin: 10px 0;">
                {#each action.triggers as actionId, i}
                    {#key actionId}
                        <CreateAction mainId={id} {actionId} existingActions={action.triggers} actionValue={action.actionValues?.[actionId]} actionNameIndex={i + 1} on:change={(e) => changeAction(e, i)} />
                    {/key}
                {/each}
                {#if !action.triggers?.length || addTrigger}
                    <CreateAction actionId="" existingActions={action.triggers || []} on:change={changeAction} />
                {:else}
                    <CombinedInput style="border-top: 2px solid var(--primary-lighter);">
                        <Button on:click={() => (addTrigger = true)} style="width: 100%;" center>
                            <Icon id="add" right />
                            <T id="settings.add" />
                        </Button>
                    </CombinedInput>
                {/if}
            </div>
        {/if}

        <!-- if not slide specific trigger action -->
        {#if !mode}
            <!-- Custom Activations -->
            <hr />

            <CombinedInput>
                <p><T id="actions.custom_activation" /></p>
                <Dropdown options={customActivations} value={customActivations.find((a) => a.id === customActivation)?.name || "—"} on:click={(e) => updateValue("customActivation", e.detail.id)} />
            </CombinedInput>
            {#if customActivation === "timer_end"}
                <CombinedInput>
                    <p><T id={specificActivations[customActivation]?.name} /></p>
                    <Dropdown
                        options={getSpecificActivation(customActivation)}
                        value={getSpecificActivation(customActivation).find((a) => (specificActivation ? `${customActivation}__${a.id}` === specificActivation : a.id === ""))?.name || "—"}
                        on:click={(e) => updateValue("specificActivation", e.detail.id ? `${customActivation}__${e.detail.id}` : "")}
                    />
                </CombinedInput>
            {/if}

            <!-- can be activated by Keypress -->
            <CombinedInput>
                <p><T id="midi.activate_keypress" /></p>
                <Dropdown options={shortcuts} value={shortcuts.find((a) => a.name === action.keypressActivate)?.name || "—"} on:click={(e) => updateValue("keypressActivate", e.detail.id ?? e.detail.name)} />
            </CombinedInput>

            <!-- only used to disable keypressActivate/customActionActivation if any -->
            {#if action.keypressActivate || customActivation || action.enabled === false}
                <CombinedInput>
                    <p><T id="settings.enabled" /></p>
                    <div class="alignRight">
                        <Checkbox checked={action.enabled ?? true} on:change={(e) => updateValue("enabled", e, true)} />
                    </div>
                </CombinedInput>
            {/if}

            <!-- can be activated by MIDI input signal -->
            <CombinedInput>
                <p><T id="midi.activate" /></p>
                <div class="alignRight">
                    <Checkbox checked={action.midiEnabled} on:change={(e) => updateValue("midiEnabled", e, true)} />
                </div>
            </CombinedInput>
        {/if}

        {#if action.midiEnabled}
            {#if mode === "slide_midi"}
                <p style="opacity: 0.8;font-size: 0.8em;text-align: center;margin-bottom: 20px;"><T id="actions.play_on_midi_tip" /></p>
            {:else}
                <h3><T id="midi.midi" /></h3>
            {/if}

            <MidiValues value={clone(action.midi || actionMidi)} firstActionId={action.triggers?.[0]} on:change={(e) => updateValue("midi", e)} playSlide={mode === "slide_midi"} />
        {/if}
    {/if}
</div>

<style>
    hr {
        margin: 20px 0;
        height: 2px;
        border: none;
        background-color: var(--primary-lighter);
    }

    h3 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    }
</style>
