<script lang="ts">
    import { onMount } from "svelte"
    import { get } from "svelte/store"
    import { uid } from "uid"
    import type { Tag } from "../../../../types/Show"
    import { actionTags, activeActionTagFilter, activeMediaTagFilter, activeTagFilter, globalTags, mediaTags, popupData, variableTags } from "../../../stores"
    import { keysToID, sortByName } from "../../helpers/array"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import Center from "../../system/Center.svelte"

    const store = {
        show: () => globalTags,
        media: () => mediaTags,
        action: () => actionTags,
        variable: () => variableTags
    }

    let type: keyof typeof store = $popupData.type || "show"
    let tags: (Tag & { id: string })[] = []

    let emptyTag = false
    onMount(getTags)
    function getTags() {
        if (!store[type]) return

        tags = sortByName(keysToID(get(store[type]())))

        emptyTag = !!tags.find(a => !a.name)
    }

    function createTag() {
        if (emptyTag) return

        store[type]().update(a => {
            a[uid(5)] = { name: "", color: "#ffffff" }
            return a
        })

        getTags()
    }

    function deleteTag(tagId: string) {
        store[type]().update(a => {
            delete a[tagId]
            return a
        })
        if (type === "show") activeTagFilter.set([])
        else if (type === "media") activeMediaTagFilter.set([])
        else if (type === "action") activeActionTagFilter.set([])

        getTags()
    }

    function updateKey(value: string, tagId: string, key: string) {
        store[type]().update(a => {
            a[tagId][key] = value
            return a
        })

        getTags()
    }
</script>

<div class="tags">
    {#if tags.length}
        {#key tags}
            {#each tags as tag}
                <InputRow>
                    <MaterialTextInput label="inputs.name" value={tag.name} on:change={e => updateKey(e.detail, tag.id, "name")} autofocus={!tag.name} />
                    <MaterialColorInput label="edit.color" value={tag.color} style="min-width: 200px;max-width: 200px;" on:change={e => updateKey(e.detail, tag.id, "color")} noLabel />
                    <MaterialButton icon="delete" title="actions.delete" on:click={() => deleteTag(tag.id)} white />
                </InputRow>
            {/each}
        {/key}
    {:else}
        <Center faded>
            <T id="empty.general" />
        </Center>
    {/if}

    <MaterialButton variant="outlined" icon="add" style="margin-top: 20px;width: 100%;" disabled={emptyTag} on:click={createTag}>
        <T id="meta.new_tag" />
    </MaterialButton>
</div>

<style>
    .tags {
        display: flex;
        flex-direction: column;
    }
</style>
