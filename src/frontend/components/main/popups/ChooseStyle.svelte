<script lang="ts">
    import { popupData } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"

    const styleTypes = [
        { id: "normal", name: "settings.normal", icon: "styles" },
        { id: "live", name: "settings.stream_ready", icon: "camera" }
    ]

    function selectStyle(id) {
        popupData.set({ id: "choose_style", value: id })
    }
</script>

<div>
    {#each styleTypes as type}
        <Button on:click={() => selectStyle(type.id)} style={type.id === "normal" ? "border: 2px solid var(--focus);" : ""}>
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
