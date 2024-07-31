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

    export let list: boolean = false

    $: currentShow = $shows[$activeShow!.id]
    $: showTags = currentShow.quickAccess?.tags || []

    // sort by name, then color
    $: tags = sortObject(sortByName(keysToID($globalTags)), "color")

    function createNewTag() {
        history({ id: "UPDATE", oldData: { id: uid(5) }, location: { page: "show", id: "tag" } })
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
