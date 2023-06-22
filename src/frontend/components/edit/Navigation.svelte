<script lang="ts">
    import { activeEdit, activeShow, editHistory, labelsDisabled, overlays, templates } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { clone } from "../helpers/array"
    import { history } from "../helpers/history"
    import { getExtension, getFileName, getMediaType } from "../helpers/media"
    import { _show } from "../helpers/shows"
    import Button from "../inputs/Button.svelte"
    import Center from "../system/Center.svelte"
    import Slides from "./Slides.svelte"

    function addSlide(e: any) {
        let index: number = 1
        let isParent: boolean = false

        // check that current edit slide exists
        if ($activeEdit?.slide !== null && $activeEdit?.slide !== undefined) {
            let ref = _show().layouts("active").ref()[0]
            if (ref[$activeEdit?.slide]) index = $activeEdit.slide + 1
        }

        if (e.ctrlKey || e.metaKey) isParent = true
        history({ id: "SLIDES", newData: { index, replace: { parent: isParent } } })
    }

    const names = {
        show: (id: string) => _show(id).get("name"),
        media: (id: string) => getFileName(id),
        overlay: (id: string) => $overlays[id].name,
        template: (id: string) => $templates[id].name,
    }

    $: if ($activeEdit) updateEditHistory()
    function updateEditHistory() {
        editHistory.update((a) => {
            let edit: any = { edit: clone($activeEdit) }
            edit.id = edit.edit.id || $activeShow?.id || ""
            let type = edit.edit.type || "show"
            edit.icon = type === "show" ? "showIcon" : type
            if (edit.icon === "media") edit.icon = getMediaType(getExtension(edit.id))
            if (edit.icon === "template") edit.icon = "templates"
            if (edit.icon === "overlay") edit.icon = "overlays"

            edit.name = names[type](edit.id)
            if (edit.name === undefined) return a

            if (type === "show") edit.show = clone($activeShow)

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
</script>

{#if $activeEdit.id || (!$activeShow && $editHistory.length)}
    <h3><T id="edit.recent" /></h3>
    {#if $editHistory.length}
        <div class="edited">
            {#each clone($editHistory).reverse() as edited, i}
                <div class="item">
                    <Button
                        style="width: 100%;"
                        on:click={() => {
                            activeEdit.set(edited.edit)
                            if (edited.show) activeShow.set(edited.show)
                        }}
                        active={i === 0 && !!$activeEdit.id}
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
    h3 {
        color: var(--text);
        text-align: center;
        margin-bottom: 10px;
        overflow: initial;
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
