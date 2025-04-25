<script lang="ts">
    import { uid } from "uid"
    import { activeShow, globalTags, shows } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { keysToID, sortByName, sortObject } from "../helpers/array"
    import { history } from "../helpers/history"
    import Button from "../inputs/Button.svelte"
    import Center from "../system/Center.svelte"
    import Tag from "./Tag.svelte"
    import { _show } from "../helpers/shows"

    export let list = false

    $: currentShow = $shows[$activeShow!.id]
    $: showTags = currentShow.quickAccess?.tags || []

    // sort by name, then color
    $: tags = sortObject(sortByName(keysToID($globalTags)), "color")

    function createNewTag() {
        const tagId = uid(5)
        history({ id: "UPDATE", oldData: { id: tagId }, location: { page: "show", id: "tag" } })
        enableTag(tagId)
    }

    function enableTag(tagId: string) {
        let quickAccess = _show().get("quickAccess") || {}
        quickAccess.tags = [...(quickAccess.tags || []), tagId]

        let showId: string = $activeShow!.id
        history({ id: "UPDATE", newData: { data: quickAccess, key: "quickAccess" }, oldData: { id: showId }, location: { page: "show", id: "show_key", override: "toggle_tag" } })
    }
</script>

<div class="tags" class:list>
    {#if tags.length}
        {#each tags as tag}
            <Tag {tag} active={showTags.includes(tag.id)} />
        {/each}
    {:else}
        <Center faded>
            <T id="empty.general" />
        </Center>
    {/if}
</div>

{#if !list}
    <Button on:click={createNewTag} style="width: 100%;" dark center>
        <Icon id="tag" right />
        <T id="meta.new_tag" />
    </Button>
{/if}

<style>
    .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        padding-bottom: 8px;
    }
    .tags.list {
        width: 100%;
        flex-wrap: nowrap;
        overflow-x: auto;
    }

    .tags :global(p) {
        opacity: 1;
    }
</style>
