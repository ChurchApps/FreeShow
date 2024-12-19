<script lang="ts">
    import { popupData } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"

    const outputTypes = [
        { id: "normal", name: "settings.normal", icon: "display_settings" },
        { id: "stage", name: "menu.stage", icon: "stage" },
    ]

    function selectOutput(id) {
        popupData.set({ id: "choose_output", value: id })
    }
</script>

<div>
    {#each outputTypes as type}
        <Button on:click={() => selectOutput(type.id)} style={type.id === "normal" ? "border: 2px solid var(--focus);" : ""}>
            <Icon id={type.icon} size={5} white />
            <p><T id={type.name} /></p>
        </Button>
    {/each}
</div>

<style>
    p {
        display: flex;
        align-items: center;
    }

    div {
        display: flex;
        gap: 10px;
        align-self: center;
    }

    div :global(button) {
        width: 200px;
        height: 200px;

        display: flex;
        gap: 10px;
        flex-direction: column;
        justify-content: center;
    }
</style>
