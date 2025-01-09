<script lang="ts">
    import Button from "../../../common/components/Button.svelte"
    import Center from "../../../common/components/Center.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import Loading from "../../../common/components/Loading.svelte"
    import { keysToID } from "../../../common/util/helpers"
    import { translate } from "../../util/helpers"
    import { send } from "../../util/socket"
    import { dictionary, isCleared, scriptureCache, scriptures } from "../../util/stores"
    import Clear from "../show/Clear.svelte"
    import ScriptureContent from "./ScriptureContent.svelte"

    export let tablet: boolean = false

    let openedScripture = localStorage.scripture || ""
    $: if (openedScripture && !$scriptureCache[openedScripture]) send("GET_SCRIPTURE", { id: openedScripture })

    function openScripture(id: string) {
        openedScripture = id
        localStorage.setItem("scripture", id)
    }

    // WIP collections: remove with API Bibles, get correct ID etc.
    $: sortedBibles = keysToID($scriptures)
        .filter((a) => !a.api && !a.collection)
        .map((a: any) => ({ ...a, icon: a.api ? "scripture_alt" : a.collection ? "collection" : "scripture" }))
        .sort((a: any, b: any) => (b.customName || b.name).localeCompare(a.customName || a.name))
        .sort((a: any, b: any) => (a.api === true && b.api !== true ? 1 : -1))
        .sort((a: any, b: any) => (a.collection !== undefined && b.collection === undefined ? -1 : 1))

    let depth = 0
</script>

<h2 class="header">
    {#if openedScripture}
        {$scriptures[openedScripture]?.customName || $scriptures[openedScripture]?.name || ""}
    {:else}
        {translate("tabs.scripture", $dictionary)}
    {/if}
</h2>

{#if openedScripture}
    <div class="bible">
        {#if $scriptureCache[openedScripture]}
            <ScriptureContent scripture={$scriptureCache[openedScripture]} {tablet} bind:depth />
        {:else}
            <Loading />
        {/if}
    </div>

    {#if $isCleared.all}
        <Button on:click={() => (depth ? depth-- : openScripture(""))} style="width: 100%;" center dark>
            <Icon id="back" right />
            {translate("actions.back", $dictionary)}
        </Button>
    {:else}
        <Clear />
    {/if}
{:else if sortedBibles.length}
    {#each sortedBibles as scripture}
        <Button on:click={() => openScripture(scripture.id)} title={scripture.customName || scripture.name} style="padding: 0.5em 0.8em;" bold={false}>
            <Icon id={scripture.icon} right />
            <p>{scripture.customName || scripture.name}</p>
        </Button>
    {/each}
{:else}
    <Center faded>{translate("empty.general", $dictionary)}</Center>
{/if}

<style>
    p {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .bible {
        flex: 1;
        overflow-y: hidden;
    }
</style>
