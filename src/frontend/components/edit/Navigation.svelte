<script lang="ts">
    import type { ClickEvent } from "../../../types/Main"
    import { activeEdit, activePage, activeShow, editHistory, effects, focusMode, labelsDisabled, overlays, refreshEditSlide, shows, templates, textEditActive } from "../../stores"
    import { getAccess } from "../../utils/profile"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { clone } from "../helpers/array"
    import { history } from "../helpers/history"
    import { getExtension, getFileName, getMediaType } from "../helpers/media"
    import { getLayoutRef } from "../helpers/show"
    import { _show } from "../helpers/shows"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import Button from "../inputs/Button.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import Center from "../system/Center.svelte"
    import Slides from "./Slides.svelte"

    $: currentShowId = $activeShow?.id || $activeEdit.showId || ""

    function addSlide(e: ClickEvent) {
        let index = 1
        let isParent = false

        // check that current edit slide exists
        if ($activeEdit?.slide !== null && $activeEdit?.slide !== undefined) {
            let ref = getLayoutRef()
            if (ref[$activeEdit?.slide]) index = $activeEdit.slide + 1
        }

        if (e.detail.shift) isParent = true
        history({ id: "SLIDES", newData: { index, replace: { parent: isParent }, addItems: !e.detail.ctrl } })
    }

    const names = {
        show: (id: string) => _show(id).get("name"),
        media: (id: string) => getFileName(id),
        camera: () => $activeEdit.data?.name,
        audio: (id: string) => getFileName(id),
        overlay: (id: string) => $overlays[id]?.name || "",
        template: (id: string) => $templates[id]?.name || "",
        effect: (id: string) => $effects[id]?.name || ""
    }

    $: if ($activeEdit) updateEditHistory()
    function updateEditHistory() {
        editHistory.update((a) => {
            if (!$activeEdit.id && currentShowId && !$shows[currentShowId]) return a

            let edit: any = { edit: clone($activeEdit) }
            edit.id = edit.edit.id || currentShowId
            if (!edit.id) return a

            let type = edit.edit.type || "show"
            edit.icon = type === "show" ? "slide" : type // showIcon
            if (edit.icon === "media") edit.icon = getMediaType(getExtension(edit.id))
            else if (edit.icon === "audio") edit.icon = "music"
            else if (edit.icon === "template") edit.icon = "templates"
            else if (edit.icon === "overlay") edit.icon = "overlays"
            else if (edit.icon === "effect") edit.icon = "effects"

            if (!names[type]) return a
            edit.name = names[type](edit.id)
            if (edit.name === undefined) return a

            if (type === "show") {
                let active = clone($activeShow)
                // focus mode
                if (!active && currentShowId) active = { type: "show", id: currentShowId, index: $activeEdit.slide || 0 }

                edit.show = active
            }

            a.push(edit)

            // remove duplicates
            let ids: string[] = []
            a = a
                .reverse()
                .filter((a) => {
                    if (ids.includes(a.id)) return false
                    ids.push(a.id)
                    return true
                })
                .reverse()

            return a
        })
    }

    let clonedHistory: any[] = []
    // don't change order when changing edits
    $: if ($editHistory.length !== clonedHistory.length || (!$activeEdit.id && !$activeShow?.id)) setTimeout(() => (clonedHistory = clone($editHistory).reverse()))

    function openRecent(edited) {
        activeEdit.set(edited.edit)
        if (edited.edit?.type !== "audio") refreshEditSlide.set(true)
        if (edited.show) {
            if ($focusMode) activeEdit.set({ items: [], slide: edited.show.index, type: "show", showId: edited.show.id })
            else activeShow.set(edited.show)
        }
    }

    let profile = getAccess("shows")
    $: isLocked = $shows[currentShowId]?.locked || profile.global === "read" || profile[$shows[currentShowId]?.category || ""] === "read"
</script>

<!-- WIP history keyboard navigation up/down? -->

{#if $focusMode}
    <Button on:click={() => activePage.set("show")} center dark>
        <Icon id="back" right />
        <T id="actions.back" />
    </Button>
{/if}

{#if $focusMode && currentShowId}
    <Slides />
{:else if $activeEdit.id || ((!currentShowId || !$shows[currentShowId]) && $editHistory.length) || $textEditActive}
    <div class="title">
        <h3 style="font-style: italic;opacity: 0.7;"><T id="edit.recent" /></h3>
    </div>
    {#if $editHistory.length}
        <div class="edited">
            {#each clonedHistory as edited}
                <MaterialButton style="width: 100%;padding: 0.15rem 0.65rem;font-weight: normal;justify-content: left;" on:click={() => openRecent(edited)} isActive={$activeEdit.id ? $activeEdit.id === edited.id : currentShowId === edited.id} tab>
                    <Icon id={edited.icon} />
                    <p style="margin: 3px 5px;">{edited.name || "—"}</p>
                </MaterialButton>
            {/each}
        </div>
    {:else}
        <Center faded>
            <T id="empty.general" />
        </Center>
    {/if}
{:else if $activeShow && ($activeShow.type === undefined || $activeShow.type === "show")}
    <div class="title">
        <h3 style="opacity: 0.8;">{$shows[currentShowId]?.name || ""}</h3>
    </div>

    <Slides />

    <FloatingInputs onlyOne>
        <MaterialButton disabled={isLocked} icon="add" title="new.slide" on:click={addSlide}>
            {#if !$labelsDisabled}<T id="new.slide" />{/if}
        </MaterialButton>
    </FloatingInputs>
{:else}
    <Center faded>
        <T id="empty.show" />
    </Center>
{/if}

<style>
    .title {
        background-color: var(--primary-darker);
        text-align: center;
        padding: 3px 8px;
        overflow: initial;
    }
    h3 {
        color: var(--text);
        font-size: 1em;
    }

    .edited {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: auto;
    }
</style>
