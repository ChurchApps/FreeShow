<script lang="ts">
    import { activeEdit, activeShow, labelsDisabled } from "../../stores"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { _show } from "../helpers/shows"
    import T from "../helpers/T.svelte"
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
</script>

{#if $activeShow && ($activeShow.type === undefined || $activeShow.type === "show")}
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
