<script lang="ts">
    import { activeShow, activeTagFilter, categories, globalTags, shows, showsCache, templates } from "../../../stores"
    import { keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Date from "../../system/Date.svelte"

    $: show = $activeShow?.id ? $shows[$activeShow.id] : null
    $: fullShow = $activeShow?.id ? $showsCache[$activeShow.id] : null

    $: created = show?.timestamps?.created || null
    $: modified = show?.timestamps?.modified || null
    $: used = show?.timestamps?.used || null

    let words: number = 0
    let allLines: any[]
    $: if (fullShow) allLines = _show($activeShow!.id).slides().items().lines().get()
    $: if (allLines) getWords()

    function getWords() {
        words = 0
        allLines.forEach((lines: any) => {
            lines.forEach((line: any) => {
                line?.text?.forEach((text: any) => (words += text.value.split(" ").length))
            })
        })
    }
</script>

<main>
    <h2 style="text-align: center;padding: 10px;" title={show?.name}>
        {#if show?.name.length}
            {show.name}
        {:else}
            <span style="opacity: 0.5">
                <T id={"main.unnamed"} />
            </span>
        {/if}
    </h2>

    <div class="table">
        <p>
            <span class="title"><T id={"info.created"} /></span>
            {#if created}
                <span><Date d={created} /></span>
            {:else}
                <span>—</span>
            {/if}
        </p>
        <p>
            <span class="title"><T id={"info.modified"} /></span>
            {#if modified}
                <span><Date d={modified} /></span>
            {:else}
                <span>—</span>
            {/if}
        </p>
        <p>
            <span class="title"><T id={"info.used"} /></span>
            {#if used}
                <span><Date d={used} /></span>
            {:else}
                <span>—</span>
            {/if}
        </p>
        <p>
            <span class="title"><T id={"info.category"} /></span>
            <span>
                {#if show?.category}
                    {#if $categories[show?.category]}
                        {#if $categories[show?.category].default}
                            <T id={$categories[show?.category].name} />
                        {:else}
                            {$categories[show?.category].name}
                        {/if}
                    {:else}
                        <T id="error.not_found" />
                    {/if}
                {:else}
                    —
                {/if}
            </span>
        </p>

        {#if Object.keys($globalTags).length}
            <p>
                <span class="title"><T id={"meta.tags"} /></span>
                <span style="overflow: hidden;text-overflow: ellipsis;">
                    {sortByName(keysToID($globalTags).filter((a) => show?.quickAccess?.tags?.includes(a.id)))
                        .map(({ name }) => name)
                        .join(", ") || "—"}
                </span>
            </p>
        {/if}

        <p>
            <span class="title"><T id={"info.slides"} /></span>
            <span>{Object.keys(fullShow?.slides || {}).length}</span>
        </p>
        <p>
            <span class="title"><T id={"info.words"} /></span>
            <span>{words}</span>
        </p>
        <p>
            <span class="title"><T id={"info.template"} /></span>
            <span>
                {#if fullShow?.settings?.template}
                    {#if $templates[fullShow?.settings.template]}
                        {$templates[fullShow?.settings.template]?.name || "—"}
                    {:else}
                        <T id="error.not_found" />
                    {/if}
                {:else}
                    <T id="main.none" />
                {/if}
            </span>
        </p>
    </div>
</main>

{#if $activeTagFilter?.length}
    <Button style="width: 100%;" on:click={() => activeTagFilter.set([])} center dark>
        <Icon id="close" right />
        <T id="meta.clear_tag_filter" />
    </Button>
{/if}

<style>
    main {
        flex: 1;
        overflow-y: auto;
    }

    .table p {
        display: flex;
        justify-content: space-between;
        gap: 5px;
        padding: 2px 10px;
    }
    .table p:nth-child(odd) {
        background-color: rgb(0 0 20 / 0.15);
    }

    .title {
        font-weight: 600;
    }
    .table p span:not(.title) {
        opacity: 0.8;

        overflow: hidden;
        /* direction: rtl; */
    }
</style>
