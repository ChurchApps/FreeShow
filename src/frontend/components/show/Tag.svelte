<script lang="ts">
    import { activeShow, globalTags, selected } from "../../stores"
    import { history } from "../helpers/history"
    import { _show } from "../helpers/shows"
    import HiddenInput from "../inputs/HiddenInput.svelte"
    import { triggerClickOnEnterSpace } from "../../utils/clickable"

    export let tag
    export let active = false

    let editActive = false

    function rename(e: any, tagId: string) {
        let value = e.detail?.value

        if ($globalTags[tagId]?.name) {
            if (!value) {
                tag.name = $globalTags[tagId].name
                return
            }

            history({ id: "UPDATE", newData: { data: value, key: "name" }, oldData: { id: tagId }, location: { page: "show", id: "tag_key" } })
        } else {
            // set initial name!
            globalTags.update((a) => {
                a[tagId].name = value // || "—"
                return a
            })
        }
    }

    function select(e, id) {
        if (e.button !== 2) return
        selected.set({ id: "tag", data: [{ id }] })
    }

    function toggleTag(tagId: string) {
        if (editActive) return

        let quickAccess = _show().get("quickAccess") || {}

        let tags = quickAccess.tags || []
        let existingIndex = tags.indexOf(tagId)
        if (existingIndex < 0) tags.push(tagId)
        else tags.splice(existingIndex, 1)

        quickAccess.tags = tags

        let showId: string = $activeShow!.id
        history({ id: "UPDATE", newData: { data: quickAccess, key: "quickAccess" }, oldData: { id: showId }, location: { page: "show", id: "show_key", override: "toggle_tag" } })
    }

</script>

<div on:mouseup={(e) => select(e, tag.id)} class="tag context #tag" class:active={active || editActive} style="--color: {tag.color || 'white'};" on:click={() => toggleTag(tag.id)} on:keydown={triggerClickOnEnterSpace} tabindex="0" role="button">
    <HiddenInput id="tag_{tag.id}" value={tag.name || ""} on:edit={(e) => rename(e, tag.id)} bind:edit={editActive} />
</div>

<style>
    .tag {
        --color: white;

        display: flex;
        padding: 0px 5px;

        color: var(--color);
        font-weight: 600;

        border-radius: 20px;
        border: 2px solid var(--color);

        opacity: 0.5;
    }
    .tag.active {
        opacity: 1;
    }

    .tag :global(p) {
        margin: 0;
    }
</style>
