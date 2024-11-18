<script lang="ts">
    import Button from "../../common/components/Button.svelte"
    import { getValue, isChecked } from "../../common/util/helpers"
    import { translate } from "../util/helpers"
    import { send } from "../util/socket"
    import { _get, _update, dictionary, password } from "../util/stores"

    function submit() {
        const password = _get("password").stored
        _update("password", "stored", password)
        send("ACCESS", password)
    }
</script>

<div class="center">
    <div class="card">
        <h1>RemoteShow</h1>

        <input
            class="input"
            style="text-align: center;"
            type="password"
            placeholder={translate("remote.password", $dictionary)}
            on:keydown={(e) => {
                if (e.key === "Enter") submit()
            }}
            on:change={(e) => _update("password", "stored", getValue(e))}
            value={$password.stored}
        />

        <Button on:click={submit} style="color: var(--secondary);" bold dark center>{translate("remote.submit", $dictionary)}</Button>

        <span style="text-align: center;">
            <input type="checkbox" checked={$password.remember} on:change={(e) => _update("password", "remember", isChecked(e))} />
            <span style="opacity: 0.6;padding-left: 10px;">{translate("remote.remember", $dictionary)}</span>
        </span>
    </div>
</div>

<style>
    .center {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .card {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 20px;
        width: 100%;
    }

    .input {
        background-color: rgb(0 0 0 / 0.2);
        color: var(--text);
        /* font-family: inherit; */
        padding: 10px 18px;
        border: none;
        font-size: inherit;
    }
    .input:active,
    .input:focus {
        outline: 2px solid var(--secondary);
        /* background-color: var(--secondary-opacity); */
    }
    .input::placeholder {
        color: inherit;
        opacity: 0.4;
    }
</style>
