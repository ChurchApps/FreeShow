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
        opacity: 0.7;

        display: inline-flex;
        gap: 5px;
        align-items: flex-end;

        -webkit-user-drag: none;
    }
    a:hover {
        opacity: 0.75;
    }
    a:active {
        opacity: 0.9;
    }
</style>
