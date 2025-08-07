<script lang="ts">
    import { onMount } from "svelte"
    import { get } from "svelte/store"
    import { uid } from "uid"
    import type { Tag } from "../../../../types/Show"
    import { actionTags, activeActionTagFilter, activeMediaTagFilter, activeTagFilter, dictionary, globalTags, mediaTags, popupData, variableTags } from "../../../stores"
    import { keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
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

        emptyTag = !!tags.find((a) => !a.name)
    }

    function createTag() {
        if (emptyTag) return

        store[type]().update((a) => {
            a[uid(5)] = { name: "", color: "#ffffff" }
            return a
        })

        getTags()
    }

    function deleteTag(tagId: string) {
        store[type]().update((a) => {
            delete a[tagId]
            return a
        })
        if (type === "show") activeTagFilter.set([])
        else if (type === "media") activeMediaTagFilter.set([])
        else if (type === "action") activeActionTagFilter.set([])

        getTags()
    }

    function updateKey(e: any, tagId: string, key: string) {
        let value = e.detail ?? e.target?.value ?? ""

        store[type]().update((a) => {
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
                <CombinedInput>
                    <TextInput value={tag.name} on:change={(e) => updateKey(e, tag.id, "name")} autofocus={!tag.name} />
                    <Color value={tag.color} style="min-width: 100px;" on:input={(e) => updateKey(e, tag.id, "color")} rightAlign />

                    <Button on:click={() => deleteTag(tag.id)} title={$dictionary.actions?.delete}>
                        <Icon id="delete" />
                    </Button>
                </CombinedInput>
            {/each}
        {/key}
    {:else}
        <Center faded>
            <T id="empty.general" />
        </Center>
    {/if}

    <br />

    <CombinedInput>
        <Button style="width: 100%;" disabled={emptyTag} on:click={createTag} dark center>
            <Icon id="add" right />
            <T id="meta.new_tag" />
        </Button>
    </CombinedInput>
</div>

<style>
    .tags {
        display: flex;
        flex-direction: column;
    }
</style>
