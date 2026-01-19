<script lang="ts">
    import { slide } from "svelte/transition"
    import { activeProfile, profiles } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"

    const currentProfile = $activeProfile ? $profiles[$activeProfile]?.name || "" : translateText("profile.admin")
</script>

<div class="profile-changer-menu" transition:slide>
    <p style="display: flex;align-items: center;gap: 0.5em;">
        <Icon id="profiles" white />
        <span>{currentProfile}</span>
    </p>

    <MaterialButton variant="outlined" on:click={() => activeProfile.set(null)}>
        {translateText("profile.change_profile")}
    </MaterialButton>
</div>

<style>
    .profile-changer-menu {
        position: absolute;
        bottom: 1em;
        left: 50%;
        transform: translateX(-50%);

        background-color: var(--primary-darkest);
        padding: 0.5em 1.2em;

        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);

        display: flex;
        gap: 1.2em;

        z-index: 4999;
    }
</style>
