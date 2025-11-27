<script lang="ts">
    import type { Line, Show, TrimmedShow } from "../../../../types/Show"
    import { activeShow, activeTagFilter, categories, globalTags, shows, showsCache, templates } from "../../../stores"
    import { hasNewerUpdate } from "../../../utils/common"
    import { keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import InfoMetadata from "./InfoMetadata.svelte"

    let show: TrimmedShow | null = null
    let fullShow: Show | null = null
    $: if ($shows || $showsCache) updateShows()
    async function updateShows() {
        if (await hasNewerUpdate("SHOW_INFO", 200)) return

        show = $activeShow?.id ? $shows[$activeShow.id] : null
        fullShow = $activeShow?.id ? $showsCache[$activeShow.id] : null
    }

    $: created = show?.timestamps?.created || null
    $: modified = show?.timestamps?.modified || null
    $: used = show?.timestamps?.used || null

    $: category = show?.category ? ($categories[show.category]?.name ?? "error.not_found") || "main.unnamed" : "main.none"

    $: tags = sortByName(keysToID($globalTags).filter(a => show?.quickAccess?.tags?.includes(a.id))).map(({ name }) => name)

    let words = 0
    let allLines: Line[][]
    $: if (fullShow)
        allLines = _show($activeShow?.id || "")
            .slides()
            .items()
            .lines()
            .get()
    $: if (allLines) getWords()

    function getWords() {
        words = 0
        allLines.forEach(lines => {
            lines.forEach(line => {
                line?.text?.forEach(text => (words += text.value.split(" ").length))
            })
        })
    }

    $: template = fullShow?.settings?.template ? ($templates[fullShow.settings.template]?.name ?? "error.not_found") || "main.unnamed" : "main.none"

    $: info = [{ label: "info.created", value: created, type: "date" }, { label: "info.modified", value: modified, type: "date" }, { label: "info.used", value: used, type: "date" }, { label: "info.category", value: category }, ...(Object.keys($globalTags).length ? [{ label: "meta.tags", value: tags.join(", ") }] : []), { label: "info.slides", value: Object.keys(fullShow?.slides || {}).length }, { label: "info.words", value: words }, { label: "info.template", value: template }]
</script>

<div class="scroll">
    <InfoMetadata title={show?.name} {info} />
</div>

{#if $activeTagFilter?.length}
    <Button style="width: 100%;" on:click={() => activeTagFilter.set([])} center dark>
        <Icon id="close" right />
        <T id="meta.clear_tag_filter" />
    </Button>
{/if}

<style>
    .scroll {
        flex: 1;
    }
</style>
