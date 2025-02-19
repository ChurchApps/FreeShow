<script lang="ts">
    import { activeEdit, activePopup, activeShow, activeTriggerFunction, dictionary, groups, popupData, showsCache, templates } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Notes from "../../show/tools/Notes.svelte"

    // TODO: templates / overlays

    $: slideId = _show().layouts("active").ref()[0]?.[$activeEdit.slide || 0]?.id
    $: editSlide = $showsCache && $activeEdit.slide !== null && slideId ? _show().slides([slideId]).get()[0] : null

    $: globalGroup = _show().get("slides")[slideId]?.globalGroup || ""
    $: groupData = $groups[globalGroup] || {}
    $: groupTemplate = groupData.template

    let notesElem: any = null
    $: if (notesElem && $activeTriggerFunction === "slide_notes") {
        setTimeout(() => {
            // focus after any textbox is focused
            notesElem.querySelector("textarea").focus()
            notesElem.scrollIntoView()

            activeTriggerFunction.set("")
        }, 20)
    }

    let settings: any = {}

    $: if ($showsCache || editSlide) setValues()
    function setValues() {
        settings = {
            template: editSlide?.settings?.template,
            color: editSlide?.settings?.color || "",
        }
    }

    function update() {
        if (!editSlide) return

        let newData: any = { style: clone(settings) }

        history({
            id: "slideStyle",
            oldData: { style: editSlide?.settings },
            newData,
            location: { page: "edit", show: $activeShow!, slide: slideId },
        })
    }

    let note: string = ""
    $: if ($activeEdit.slide !== null && $activeEdit.slide !== undefined) note = editSlide?.notes || ""

    function edit(e: any) {
        if (editSlide.notes === e.detail || !slideId) return

        _show($activeShow!.id).slides([slideId]).set({ key: "notes", value: e.detail })
    }
</script>

<div class="section">
    <CombinedInput>
        <p><T id="edit.background_color" /></p>
        <Color
            bind:value={settings.color}
            on:input={(e) => {
                settings.color = e.detail
                update()
            }}
            enableNoColor
        />
    </CombinedInput>
    <CombinedInput>
        <p>
            <T id="show.slide_template" />
            {#if groupTemplate && !settings.template}
                <span style="display: flex;align-items: center;padding: 0 10px;font-size: 0.8em;opacity: 0.7;"><T id="settings.overrided_value" /></span>
            {/if}
        </p>
        <Button
            on:click={() => {
                popupData.set({
                    action: "select_template",
                    active: settings.template || "",
                    trigger: (id) => {
                        settings.template = id
                        update()
                    },
                })
                activePopup.set("select_template")
            }}
            style="overflow: hidden;"
            bold={!settings.template}
        >
            <div style="display: flex;align-items: center;padding: 0;">
                <Icon id="templates" />
                <p style="opacity: 1;font-size: 1em;">
                    {#if settings.template}
                        {$templates[settings.template || ""]?.name || "—"}
                    {:else}
                        <T id="popup.select_template" />
                    {/if}
                </p>
            </div>
        </Button>
        {#if settings.template}
            <Button
                title={$dictionary.actions?.remove}
                on:click={() => {
                    settings.template = ""
                    update()
                }}
                redHover
            >
                <Icon id="close" size={1.2} white />
            </Button>
        {/if}
    </CombinedInput>

    <h6><T id="tools.notes" /></h6>
    <div class="notes" bind:this={notesElem}>
        <Notes value={note} on:edit={edit} />
    </div>
</div>

<style>
    .section {
        display: flex;
        flex-direction: column;
        margin: 10px;
    }

    h6 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    }

    p {
        opacity: 0.8;
        font-size: 0.9em;
    }

    .notes :global(div) {
        display: block !important;
    }

    .notes :global(div.paper) {
        position: relative;
        display: block;
        background: var(--primary-darker);
    }
</style>
