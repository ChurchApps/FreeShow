<script lang="ts">
    import { MAIN } from "../../../types/Channels"
    import { send } from "../../utils/request"

    export let url: string

    function openURL() {
        send(MAIN, ["URL"], url)
    }
</script>

<a href="#void" on:click={openURL}>
    <slot />
</a>

<style>
    a {
        color: var(--text);
        opacity: 0.6;
    }
    a:hover {
        opacity: 0.7;
    }
    a:active {
        opacity: 0.9;
    }
</style>
