<script lang="ts">
    import type { Show } from "../../../../types/Show"
    import Icon from "../../../common/components/Icon.svelte"
    import Reordable from "../../../common/components/Reordable.svelte"
    import { send } from "../../util/socket"
    import { groupsCache } from "../../util/stores"

    export let show: Show

    send("API:get_groups", { id: show.id })

    $: groups = $groupsCache[show.id!] || []
    $: activeLayout = show.settings?.activeLayout
    $: layoutGroups = show.layouts?.[activeLayout]?.slides
        .map(a => {
            // let slide = show.slides[a.id] || {}
            // if (slide.group === null) return

            let group = groups.find(({ id }: any) => id === a.id)
            if (!group) return

            let layoutSlide: any = { id: a.id, ...group }
            return layoutSlide
        })
        .filter(Boolean)

    function updateGroups({ detail: data }: any) {
        if (!show.layouts) return
        send("API:rearrange_groups", { showId: show.id, from: data.dragIndex, to: data.dropIndex })
    }
</script>

<div class="groups">
    {#key layoutGroups}
        <Reordable items={layoutGroups} let:item on:end={updateGroups}>
            <div class="group" style="--color: {item.color};">
                <p>{item.group || "—"}</p>
                <div class="icon">
                    <Icon id="dragHandle" />
                </div>
            </div>
        </Reordable>
    {/key}
</div>

<style>
    .groups {
        flex: 1;
        overflow-y: auto;
        /* FreeShow UI scrollbar */
        scrollbar-width: thin; /* Firefox */
        scrollbar-color: rgb(255 255 255 / 0.3) rgb(255 255 255 / 0.05);
    }
    .groups::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    .groups::-webkit-scrollbar-track,
    .groups::-webkit-scrollbar-corner {
        background: rgb(255 255 255 / 0.05);
    }
    .groups::-webkit-scrollbar-thumb {
        background: rgb(255 255 255 / 0.3);
        border-radius: 8px;
    }
    .groups::-webkit-scrollbar-thumb:hover {
        background: rgb(255 255 255 / 0.5);
    }

    .groups :global(#sortable) {
        display: flex;
        flex-direction: column;
        gap: 5px;

        padding: 10px;
    }

    .group {
        display: flex;
        justify-content: center;
        width: 100%;

        background-color: var(--primary-darker);

        --color: var(--text);
        border-bottom: 2px solid var(--color);
        color: var(--color);
    }

    .group p {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        padding-right: 25px;
        padding-left: 10px;
    }

    .group .icon {
        position: absolute;
        inset-inline-end: 12px;
    }
    .group .icon :global(svg) {
        fill: var(--text);
        opacity: 0.3;
    }
</style>
