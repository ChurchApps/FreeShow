<script lang="ts">
    import { activeEdit, activePage, activeShow, editHistory, focusMode, labelsDisabled, overlays, refreshEditSlide, shows, templates, textEditActive } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { clone } from "../helpers/array"
    import { history } from "../helpers/history"
    import { getExtension, getFileName, getMediaType } from "../helpers/media"
    import { _show } from "../helpers/shows"
    import Button from "../inputs/Button.svelte"
    import Center from "../system/Center.svelte"
    import Slides from "./Slides.svelte"

    $: currentShowId = $activeShow?.id || $activeEdit.showId || ""

    function addSlide(e: any) {
        let index: number = 1
        let isParent: boolean = false

        // check that current edit slide exists
        if ($activeEdit?.slide !== null && $activeEdit?.slide !== undefined) {
            let ref = _show().layouts("active").ref()[0]
            if (ref[$activeEdit?.slide]) index = $activeEdit.slide + 1
        }

        if (e.shiftKey) isParent = true
        history({ id: "SLIDES", newData: { index, replace: { parent: isParent }, addItems: !e.ctrlKey && !e.metaKey } })
    }

    const names = {
        show: (id: string) => _show(id).get("name"),
        media: (id: string) => getFileName(id),
        overlay: (id: string) => $overlays[id]?.name || "",
        template: (id: string) => $templates[id]?.name || "",
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
            if (edit.icon === "template") edit.icon = "templates"
            if (edit.icon === "overlay") edit.icon = "overlays"

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
</script>

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
        <h3><T id="edit.recent" /></h3>
    </div>
    {#if $editHistory.length}
        <div class="edited">
            {#each clonedHistory as edited}
                <div class="item">
                    <Button
                        style="width: 100%;"
                        on:click={() => {
                            activeEdit.set(edited.edit)
                            refreshEditSlide.set(true)
                            if (edited.show) {
                                if ($focusMode) activeEdit.set({ items: [], slide: edited.show.index, type: "show", showId: edited.show.id })
                                else activeShow.set(edited.show)
                            }
                        }}
                        active={$activeEdit.id ? $activeEdit.id === edited.id : currentShowId === edited.id}
                        bold={false}
                        border
                    >
                        <Icon id={edited.icon} right />
                        <p style="margin: 3px 5px;">{edited.name || "—"}</p>
                    </Button>
                </div>
            {/each}
        </div>
    {:else}
        <Center faded>
            <T id="empty.general" />
        </Center>
    {/if}
{:else if $activeShow && ($activeShow.type === undefined || $activeShow.type === "show")}
    <Slides />
    <Button on:click={addSlide} center dark>
        <Icon id="add" right={!$labelsDisabled} />
        {#if !$labelsDisabled}<T id="new.slide" />{/if}
    </Button>
{:else}
    <Center faded>
        <T id="empty.show" />
    </Center>
{/if}

<style>
    .title {
        background-color: var(--primary-darker);
        text-align: center;
        padding: 3px 0;
        overflow: initial;
    }
    h3 {
        color: var(--text);
        font-style: italic;
        font-size: 1em;
        opacity: 0.7;
    }

    .edited {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: auto;
    }

    .item {
        display: flex;
    }
</style>
