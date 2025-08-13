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
        <h1 class="title">RemoteShow</h1>

        <form on:submit|preventDefault={submit} class="auth-form">
            <!-- Hidden username field for better password manager compatibility -->
            <label class="sr-only" for="username-input">Username</label>
            <input
                id="username-input"
                class="sr-only"
                type="text"
                name="username"
                autocomplete="username"
                inputmode="text"
                autocapitalize="none"
                autocorrect="off"
                spellcheck="false"
                tabindex="-1"
                aria-hidden="true"
            />
            <label class="sr-only" for="password-input">{translate("remote.password", $dictionary)}</label>
            <input
                id="password-input"
                class="input"
                style="text-align: center;"
                type="password"
                name="password"
                autocomplete="current-password"
                placeholder={translate("remote.password", $dictionary)}
                on:change={(e) => _update("password", "stored", getValue(e))}
                value={$password.stored}
            />

            <Button type="submit" bold dark center style="width: 100%; border-radius: 10px;">{translate("remote.submit", $dictionary)}</Button>

            <label class="remember-row">
                <input class="remember-checkbox" type="checkbox" checked={$password.remember} on:change={(e) => _update("password", "remember", isChecked(e))} />
                <span class="remember-label">{translate("remote.remember", $dictionary)}</span>
            </label>
        </form>
    </div>
</div>

<style>
    .center {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
    }

    .card {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 24px;
        width: min(560px, 92vw);
        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 14px;
        box-shadow: 0 6px 24px rgb(0 0 0 / 0.3);
    }

    .title {
        margin: 0;
        text-align: center;
        color: var(--secondary);
    }

    .auth-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 1, 1);
        white-space: nowrap;
        border: 0;
    }

    .input {
        background-color: rgb(255 255 255 / 0.06);
        color: var(--text);
        padding: 12px 18px;
        border: 1px solid var(--primary-lighter);
        border-radius: 10px;
        font-size: inherit;
    }
    .input:active,
    .input:focus {
        outline: 2px solid var(--secondary);
        background-color: rgb(255 255 255 / 0.08);
    }
    .input::placeholder {
        color: inherit;
        opacity: 0.5;
    }

    .remember-row {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 2px;
        user-select: none;
    }
    .remember-checkbox {
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 6px;
        border: 1px solid var(--primary-lighter);
        background-color: rgb(255 255 255 / 0.06);
        display: inline-block;
        position: relative;
        outline: none;
        cursor: pointer;
    }
    .remember-checkbox:focus { box-shadow: 0 0 0 2px var(--secondary-opacity); }
    .remember-checkbox:checked { background-color: var(--secondary); border-color: var(--secondary); }
    .remember-checkbox:checked::after {
        content: "";
        position: absolute;
        left: 5px;
        top: 2px;
        width: 4px;
        height: 8px;
        border: solid var(--secondary-text);
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
    }
    .remember-label {
        opacity: 0.8;
        font-size: 0.95em;
    }

    @media only screen and (max-width: 500px) {
        .title {
            font-size: 1.4em;
        }
        .card { padding: 20px; }
        .input { padding: 10px 16px; }
    }
</style>
