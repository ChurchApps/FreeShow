<script lang="ts">
    import Center from "../common/components/Center.svelte"
    import Error from "../common/components/Error.svelte"
    import Auth from "./components/Auth.svelte"
    import Main from "./components/Main.svelte"
    import { translate } from "./util/helpers"
    import { initSocket } from "./util/socket"
    import { dictionary, errors, isConnected, password } from "./util/stores"

    initSocket()

    // test API actions
    // send("API:get_playlists")
</script>

<Error errors={$errors} />

{#if $isConnected}
    <Main />
{:else if $password.required}
    <Auth />
{:else}
    <Center>
        {translate("remote.loading", $dictionary)}
    </Center>
{/if}

<svelte:head>
    <style>
        :root {
            --primary: #292c36;
            --primary-lighter: #363945;
            --primary-darker: #191923;
            --primary-darkest: #12121c;
            --text: #f0f0ff;
            --textInvert: #131313;
            --secondary: #f0008c;
            --secondary-opacity: rgba(240, 0, 140, 0.5);
            --secondary-text: #f0f0ff;

            --hover: rgb(255 255 255 / 0.05);
            --focus: rgb(255 255 255 / 0.1);
            /* --active: rgb(230 52 156 / .8); */

            /* --navigation-width: 18vw; */
            --navigation-width: 300px;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            user-select: none;

            outline-offset: -4px;
            outline-color: var(--secondary);
        }

        html {
            height: 100%;
        }

        body {
            background-color: var(--primary);
            color: var(--text);
            /* transition: background-color 0.5s; */

            font-family: sans-serif;
            font-size: 1.5em;

            height: 100%;
            /* width: 100vw;
height: 100vh; */
        }

        h1 {
            color: var(--secondary);
            text-align: center;
            padding-bottom: 20px;
        }

        h2 {
            color: var(--secondary);
            text-align: center;
            font-size: 1.3em;
            padding: 0.2em 0.8em;
            width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .header {
            display: flex;
            justify-content: center;
            align-items: center;

            background-color: var(--primary-darker);
            color: var(--text);
            width: 100%;

            padding: 0.2em 0.8em;
            font-weight: 600;
            font-size: 0.9em;
        }

        /* CHECKERED */

        .checkered {
            /* background-color: var(--transparent); */
            background: repeating-conic-gradient(rgba(70, 70, 80, 0.1) 0% 25%, transparent 0% 50%) 50% / 26px 26px;
        }
    </style>
</svelte:head>
