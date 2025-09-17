<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { uid } from "uid"
    import { actions, activePopup, activeShow, drawerTabsData, groups, popupData, showsCache, templates, timers } from "../../../stores"
    import { translate, translateText } from "../../../utils/language"
    import CreateAction from "../../actions/CreateAction.svelte"
    import MidiValues from "../../actions/MidiValues.svelte"
    import { actionData } from "../../actions/actionData"
    import type { API_midi } from "../../actions/api"
    import { customActionActivations } from "../../actions/customActivation"
    import { convertOldMidiToNewAction, defaultMidiActionChannels, midiInListen } from "../../actions/midi"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, keysToID, moveToPos, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getLayoutRef, updateCachedShows } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialPopupButton from "../../inputs/MaterialPopupButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    $: id = $popupData.id || ""
    $: mode = $popupData.mode || ""

    let action: any = { name: "", triggers: [] }
    let actionMidi: API_midi = { type: "noteon", values: { note: 0, velocity: mode === "slide" ? 0 : -1, channel: 1 }, defaultValues: true }

    let loaded = false
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
                let ref = getLayoutRef()
                let layoutSlide = ref[$popupData.index ?? $popupData.indexes[0]] || {}
                let slideActions = layoutSlide.data?.actions?.slideActions || []
                let existingAction = slideActions.find((a) => a.id === id)
                if (existingAction) showMidi = existingAction
            }
            action = $actions[id] || showMidi || action

            action = convertOldMidiToNewAction(action)
        }

        if (!action.name) action.name = ""

        loaded = true
    }

    // saveSlide(true)
    onDestroy(removeEmptyAction)
    function removeEmptyAction(actionId = "") {
        let ref = getLayoutRef()
        let indexes = $popupData.index !== undefined ? [$popupData.index] : $popupData.indexes
        if (!indexes) return

        let newActions: any[] = []
        let changed = false
        indexes.forEach((i) => {
            let layoutSlide = ref[i] || {}
            let slideDataActions = layoutSlide.data?.actions || {}
            let slideActions = slideDataActions.slideActions || []
            let existingActionIndex = slideActions.findIndex((a) => a.id === (actionId || id))

            // if actionId is set remove action regardless, else remove if empty
            if (existingActionIndex < 0 || (!actionId && slideActions[existingActionIndex].triggers?.[0])) {
                newActions.push(slideDataActions)
                return
            }

            slideActions.splice(existingActionIndex, 1)
            slideDataActions.slideActions = slideActions

            changed = true
            newActions.push(slideDataActions)
        })

        if (!changed) return
        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: newActions, indexes } })
    }

    let existingSearched = false
    $: if (action.triggers?.[0]) findExisting()
    function findExisting() {
        if (mode !== "slide" || ($popupData.index === undefined && !$popupData.indexes?.length) || existingSearched) return
        existingSearched = true

        let ref = getLayoutRef()
        let layoutSlide = ref[$popupData.index ?? $popupData.indexes[0]] || {}
        let slideActions = layoutSlide.data?.actions?.slideActions || []

        // find any action with the same trigger type
        const triggerId = action.triggers?.[0]
        if (!triggerId) return

        // Check if this action type can have multiple instances
        const data = actionData[triggerId.split(":")[0]] // remove unique suffix if present
        const canAddMultiple = data?.canAddMultiple

        // For actions that can't have multiple instances, find and replace existing
        if (!canAddMultiple) {
            let existingAction = slideActions.find((a) => a.triggers?.[0] === triggerId && (!id || a.id !== id))

            if (!existingAction) return

            // remove new action if already existing
            if (id !== existingAction.id && mode === "slide") removeEmptyAction(id)

            id = existingAction.id
            action = existingAction
            popupData.set({ ...$popupData, id })
        }
        // For actions that can have multiple instances, don't auto-replace
    }

    function updateValue(key: string, e: any) {
        let value = e.detail ?? e

        action[key] = value
    }
    function updateAction(key: string, value: string) {
        if (!value) return updateValue(key, "")

        actions.update((a) => {
            if (!a[id]) return a
            a[id][key] = value
            return a
        })
    }

    let autoActionName = ""
    function changeAction(e, index = -1) {
        let actionId = e.detail.id || ""
        if (!actionId) return

        const canAddMultiple = actionData[actionId]?.canAddMultiple
        if (canAddMultiple && !actionId.includes(":")) actionId += ":" + uid(5)

        if (e.detail.index !== undefined) index = e.detail.index

        // add extra action data (used for "slide action">"run action">"override category action", toggle)
        if (e.detail.customDataKey) {
            if (!action.name) action.name = actionId
            if (!action.customData) action.customData = {}
            if (!action.customData[actionId]) action.customData[actionId] = {}
            action.customData[actionId][e.detail.customDataKey] = e.detail.customDataValue
            return
        }

        // update action value instead of action id
        if (e.detail.actionValue) {
            if (!action.name) action.name = actionId
            if (!action.actionValues) action.actionValues = {}
            action.actionValues[actionId] = e.detail.actionValue
            return
        }

        // move up action id
        if (actionId === "move_up") {
            if (index === undefined) return
            action.triggers = moveToPos(action.triggers, index, index - 1)
            action = action
            return
        }

        // remove action id
        if (actionId === "remove") {
            if (index === undefined) return
            action.triggers.splice(index, 1)
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

    let stopUpdate = false
    let saveTimeout: any = 0
    $: if (action) {
        if (saveTimeout) clearTimeout(saveTimeout)
        saveTimeout = setTimeout(saveAction, 50)
    }
    function saveAction() {
        if (!loaded || stopUpdate) return
        if (mode !== "slide" && mode !== "template" && !action.name) return

        if (action.midiEnabled && !action.midi) action.midi = actionMidi

        if (mode === "template") {
            let templateId = $popupData.templateId
            let template = $templates[templateId]
            if (!template) return activePopup.set(null)
            if (!action.triggers?.length) return

            let templateSettings = template?.settings || {}

            let templateActions = templateSettings.actions || []
            let existingIndex = templateActions.findIndex((a) => a.id === id || a.triggers?.[0] === action.triggers?.[0])
            if (existingIndex > -1) templateActions[existingIndex] = action
            else templateActions.push(action)

            templateSettings.actions = templateActions
            let newData = { key: "settings", data: templateSettings }
            history({ id: "UPDATE", newData, oldData: { id: templateId }, location: { page: "drawer", id: "template_settings", override: `actions_${templateId}` } })
        } else if (mode !== "slide") {
            let exists = !!$actions[id]
            actions.update((a) => {
                // set tag
                if (!exists && $drawerTabsData.functions?.activeSubTab === "actions" && $drawerTabsData.functions?.activeSubmenu) {
                    action.tags = [$drawerTabsData.functions?.activeSubmenu]
                }

                a[id] = clone(action)

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

        stopUpdate = true
        setTimeout(() => (stopUpdate = false), 100)
    }

    function saveSlide(remove = false) {
        let ref = getLayoutRef()
        let indexes = $popupData.index !== undefined ? [$popupData.index] : $popupData.indexes
        if (!Array.isArray(indexes)) return

        let newActions: any[] = []
        let changed = false
        indexes.forEach((i) => {
            let slideDataActions = clone(ref[i]?.data?.actions) || {}
            if (!slideDataActions.slideActions) slideDataActions.slideActions = []

            let currentSlideActionIndex = slideDataActions.slideActions.findIndex((a) => a.id === id)
            if (currentSlideActionIndex < 0) {
                newActions.push(slideDataActions)
                return
            }

            if (remove) slideDataActions.slideActions.splice(currentSlideActionIndex, 1)
            else slideDataActions.slideActions[currentSlideActionIndex] = { ...action, id }

            changed = true
            newActions.push(slideDataActions)
        })

        if (!changed) return
        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: newActions, indexes } })
    }

    let addTrigger = false

    // set show when selected
    $: if (action.triggers?.find((a) => a === "start_show") && $popupData.showId) {
        let setShow = { id: "start_show", actionValue: { id: $popupData.showId } }
        changeAction({ detail: setShow }, $popupData.actionIndex)
    }

    // custom activations
    $: customActivation = action.customActivation || (action.startupEnabled ? "startup" : "") || ""
    $: specificActivation = action.specificActivation?.includes(customActivation) ? action.specificActivation.split("__")[1] || "" : ""

    const specificActivations = {
        timer_end: {
            name: "items.timer",
            list: () => sortByName(keysToID($timers)).map(({ id, name }) => ({ value: id, label: name }))
        },
        timer_start: {
            name: "items.timer",
            list: () => sortByName(keysToID($timers)).map(({ id, name }) => ({ value: id, label: name }))
        },
        group_start: {
            name: "actions.choose_group",
            list: () => sortByName(keysToID($groups)).map((a) => ({ value: a.id, label: a.default ? translateText("groups." + a.name) : a.name }))
        }
    }
    // .map((a) => ({ ...a, value: `${customActivation}__${a.value}` }))
    function getSpecificActivation(customActivation) {
        return [{ value: "", label: translateText("actions.any") }, ...specificActivations[customActivation].list()]
    }

    // keys
    $: existingShortcuts = Object.values($actions)
        .map((a) => a.keypressActivate || "")
        .filter(Boolean)

    let actionSelector: any = null
    let actionActivationSelector = false

    // function nameKeydown(e: any) {
    //     if (e.key === "Enter" && !action?.triggers?.length) {
    //         // WIP enter to open choose list
    //     }
    // }

    // pre 1.3.9
    $: if (action?.midiEnabled && !customActivation) {
        updateValue("customActivation", "midi_signal_received")
    }

    $: showMore = action.keypressActivate || customActivation
    let showCommonActivate = false

    $: hasNoName = !action.name
</script>

<!-- min-height: 50vh; -->
<div style="min-width: 45vw;">
    {#if mode === "slide" || mode === "template"}
        <CreateAction
            mainId={id}
            actionId={action.triggers?.[0] || ""}
            existingActions={action.triggers || []}
            actionValue={action.actionValues?.[action.triggers?.[0] || ""] || {}}
            customData={action.customData?.[action.triggers?.[0] || ""] || {}}
            {mode}
            on:change={changeAction}
            list
        />
    {:else}
        {#if actionActivationSelector}
            <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => (actionActivationSelector = false)} />

            <MaterialButton
                class="popup-options {showCommonActivate ? 'active' : ''}"
                icon={showCommonActivate ? "eye" : "hide"}
                iconSize={1.3}
                title={showCommonActivate ? "actions.close" : "create_show.more_options"}
                on:click={() => (showCommonActivate = !showCommonActivate)}
                white
            />

            <div class="buttons">
                {#each customActionActivations as activation}
                    {#if activation.common || showCommonActivate}
                        <MaterialButton
                            style="width: 100%;font-weight: normal;justify-content: start;padding: 5px 20px;gap: 12px;"
                            showOutline={customActivation === activation.id}
                            isActive={customActivation === activation.id}
                            on:click={() => {
                                updateValue("customActivation", activation.id)
                                actionActivationSelector = false
                            }}
                        >
                            <Icon id={activation.icon} white />
                            <p>{translateText(activation.name)}</p>
                        </MaterialButton>
                    {/if}
                {/each}
            </div>
            <!-- <Dropdown options={customActivations} value={customActivations.find((a) => a.id === customActivation)?.name || "—"} on:click={(e) => updateValue("customActivation", e.detail.id)} /> -->
        {:else if actionSelector !== null}
            <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => (actionSelector = null)} />

            <CreateAction
                mainId={id}
                actionId={actionSelector.id}
                existingActions={action.triggers}
                actionValue={action.actionValues?.[actionSelector.id] || {}}
                on:change={(e) => {
                    changeAction(e, actionSelector.index)
                    actionSelector = null
                }}
                {mode}
                list
                full
            />
        {:else}
            {#key hasNoName}
                <MaterialTextInput label="midi.name" value={action.name} on:change={(e) => updateValue("name", e)} autofocus={hasNoName} />
            {/key}
        {/if}

        {#if !mode && !actionSelector && !actionActivationSelector}
            <MaterialButton class="popup-options {showMore ? 'active' : ''}" icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} on:click={() => (showMore = !showMore)} white />
        {/if}

        <!-- if not slide specific trigger action -->
        {#if showMore && !mode && !actionSelector && !actionActivationSelector}
            <MaterialPopupButton
                label="midi.activate_keypress"
                disabled={!action.name}
                style="margin-top: 10px;"
                {id}
                name={(action.keypressActivate || "").toUpperCase()}
                value={action.keypressActivate}
                icon="shortcut"
                popupId="assign_shortcut"
                data={{
                    ...$popupData,
                    mode: "action",
                    revert: $activePopup,
                    existingShortcuts
                }}
                on:change={(e) => updateAction("keypressActivate", e?.detail || "")}
                allowEmpty
            />

            <!-- only used to disable customActionActivation if any -->
            {#if customActivation || action.enabled === false}
                <MaterialToggleSwitch label="settings.enabled" style="margin-top: 10px;" checked={action.enabled ?? true} defaultValue={true} on:change={(e) => updateValue("enabled", e.detail)} />
            {/if}

            <InputRow arrow={customActionActivations.find((a) => a.id === customActivation)?.inputs}>
                <MaterialPopupButton
                    label="actions.custom_activation"
                    disabled={!action.name}
                    name={customActionActivations.find((a) => a.id === customActivation)?.name || ""}
                    value={customActivation}
                    icon="trigger"
                    popupId="about"
                    openEvent={() => (actionActivationSelector = true)}
                    on:change={() => {
                        updateValue("customActivation", "")
                        updateValue("enabled", true)
                    }}
                    allowEmpty
                />

                <div slot="menu">
                    {#if ["timer_end", "timer_start", "group_start"].includes(customActivation)}
                        <MaterialDropdown
                            label={specificActivations[customActivation]?.name}
                            options={getSpecificActivation(customActivation)}
                            value={specificActivation}
                            on:change={(e) => updateValue("specificActivation", `${customActivation}__${e.detail}`)}
                        />
                    {:else if customActivation === "midi_signal_received"}
                        <MidiValues value={clone(action.midi || actionMidi)} firstActionId={action.triggers?.[0]} on:change={(e) => updateValue("midi", e)} simple />
                    {/if}
                </div>
            </InputRow>

            <hr />
        {/if}

        {#if !actionSelector && !actionActivationSelector}
            <!-- {#if action.triggers?.length}<hr />{/if} -->
            {#if !mode && !actionSelector && !actionActivationSelector}
                {#if !showMore}
                    <div style="height: 15px;"></div>
                {/if}
            {:else}
                <hr />
            {/if}

            <!-- multiple actions -->
            <div class="actions">
                {#each action.triggers as actionId, i}
                    {#key actionId}
                        <CreateAction
                            mainId={id}
                            {actionId}
                            existingActions={action.triggers}
                            actionValue={action.actionValues?.[actionId]}
                            actionNameIndex={i + 1}
                            on:change={(e) => changeAction(e, i)}
                            on:choose={() => (actionSelector = { id: actionId, index: i })}
                            {mode}
                            choosePopup
                        />
                    {/key}
                {/each}
                {#if !action.triggers?.length || addTrigger}
                    <CreateAction actionId="" existingActions={action.triggers || []} on:change={changeAction} on:choose={() => (actionSelector = { id: "" })} {mode} choosePopup />
                {:else}
                    <MaterialButton
                        variant="outlined"
                        style="margin-top: 10px;width: 100%;"
                        icon="add"
                        on:click={() => {
                            addTrigger = true
                            actionSelector = { id: "" }
                        }}
                    >
                        <T id="settings.add" />
                    </MaterialButton>
                {/if}
            </div>
        {/if}

        {#if action.midiEnabled && customActivation !== "midi_signal_received" && !actionSelector && !actionActivationSelector}
            <h3><T id="midi.midi" /></h3>

            <MidiValues value={clone(action.midi || actionMidi)} firstActionId={action.triggers?.[0]} on:change={(e) => updateValue("midi", e)} />
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

    .buttons {
        display: flex;
        flex-direction: column;

        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        overflow: hidden;

        padding: 10px 0;
    }
    .buttons :global(button:not(.active):nth-child(odd)) {
        background-color: rgb(0 0 20 / 0.08) !important;
    }
</style>
