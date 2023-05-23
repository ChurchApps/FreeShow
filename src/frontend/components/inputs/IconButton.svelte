<script lang="ts">
    import { labelsDisabled } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import Button from "./Button.svelte"

    export let title: string = ""
    export let name: boolean = false
</script>

<Button id="icon" on:click {title} disabled={$$props.disabled} center style={"flex: 1;"}>
    <Icon id={$$props.icon} size={1.2} white={!$$props.active && (!name || !title || $labelsDisabled)} right={name && !!title && !$labelsDisabled} />
    {#if name && title && !$labelsDisabled}{title}{/if}
</Button>
