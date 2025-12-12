<script lang="ts">
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

<div class="auth-page">
    <div class="panel">
        <div class="brand">
            <img class="logo" src="./import-logos/freeshow.webp" alt="FreeShow logo" draggable="false" />
            <h1>RemoteShow</h1>
        </div>

        <form on:submit|preventDefault={submit} class="auth-form">
            <div class="field-group">
                <label class="field-label" for="password-input">{translate("remote.password", $dictionary)}</label>
                <div class="field">
                    <span class="icon" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7 10V8a5 5 0 0 1 10 0v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                            <rect x="4.75" y="10" width="14.5" height="9.5" rx="2.5" stroke="currentColor" stroke-width="1.5" />
                            <circle cx="12" cy="14.75" r="1.25" fill="currentColor" />
                        </svg>
                    </span>
                    <input id="password-input" class="input" type="password" name="password" autocomplete="current-password" placeholder={translate("remote.password", $dictionary)} on:input={(e) => _update("password", "stored", getValue(e))} on:change={(e) => _update("password", "stored", getValue(e))} value={$password.stored} />
                </div>
            </div>

            <div class="actions">
                <label class="remember">
                    <input class="remember-checkbox" type="checkbox" checked={$password.remember} on:change={(e) => _update("password", "remember", isChecked(e))} />
                    <span class="toggle" aria-hidden="true"></span>
                    <span class="remember-label">{translate("remote.remember", $dictionary)}</span>
                </label>

                <button type="submit" class="submit-button">{translate("remote.submit", $dictionary)}</button>
            </div>
        </form>
    </div>
</div>

<style>
    .auth-page {
        position: relative;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: var(--primary-darkest);
    }

    .panel {
        position: relative;
        z-index: 1;
        width: min(560px, 94vw);
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding: 28px;
        border-radius: 18px;
        background: linear-gradient(160deg, rgb(255 255 255 / 0.06), rgb(255 255 255 / 0.03));
        border: 1px solid color-mix(in oklab, var(--primary-lighter) 80%, transparent);
        backdrop-filter: blur(12px);
    }

    .brand {
        display: inline-flex;
        gap: 12px;
        align-items: center;
        justify-content: center;
        align-self: center;
    }
    .logo {
        width: 50px;
        height: 50px;
        object-fit: contain;
        flex-shrink: 0;
        display: block;
    }
    h1 {
        margin: 0;
        font-size: 1.9em;
        color: var(--text);
        letter-spacing: 0.4px;
        line-height: 1;
        display: flex;
        align-items: center;
        padding-top: 20px;
    }

    .auth-form {
        display: flex;
        flex-direction: column;
        gap: 18px;
    }

    .field-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .field-label {
        font-size: 0.95em;
        color: color-mix(in oklab, var(--text) 75%, transparent);
        padding-left: 4px;
    }
    .field {
        position: relative;
        display: flex;
        align-items: center;
    }
    .icon {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-40%);
        color: color-mix(in oklab, var(--text) 65%, transparent);
        pointer-events: none;
        z-index: 1;
    }
    .input {
        width: 100%;
        background: rgb(255 255 255 / 0.06);
        color: var(--text);
        padding: 14px 16px 14px 44px;
        border: 1.5px solid color-mix(in oklab, var(--primary-lighter) 75%, transparent);
        border-radius: 12px;
        font-size: 1em;
        transition: all 140ms ease;
        box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.04);
    }
    .input:hover {
        border-color: color-mix(in oklab, var(--primary-lighter) 65%, var(--secondary) 35%);
        background: rgb(255 255 255 / 0.08);
    }
    .input:focus-visible {
        outline: none;
        border-color: var(--secondary);
        box-shadow:
            0 0 0 3px var(--secondary-opacity),
            inset 0 1px 0 rgb(255 255 255 / 0.08);
        background: rgb(255 255 255 / 0.1);
        transform: translateY(-1px);
    }
    .input::placeholder {
        color: color-mix(in oklab, var(--text) 70%, transparent);
    }

    .actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 4px;
    }
    .remember {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        user-select: none;
        cursor: pointer;
        color: color-mix(in oklab, var(--text) 75%, transparent);
    }
    .remember-checkbox {
        appearance: none;
        width: 46px;
        height: 26px;
        border-radius: 999px;
        border: 1.5px solid color-mix(in oklab, var(--primary-lighter) 80%, transparent);
        background: rgb(255 255 255 / 0.08);
        position: relative;
        outline: none;
        cursor: pointer;
        transition: all 140ms ease;
        box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.05);
        flex-shrink: 0;
    }
    .remember-checkbox::after {
        content: "";
        position: absolute;
        left: 3px;
        top: 3px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: color-mix(in oklab, var(--text) 92%, transparent);
        box-shadow: 0 4px 12px rgb(0 0 0 / 0.2);
        transition: all 140ms ease;
    }
    .remember-checkbox:hover {
        border-color: color-mix(in oklab, var(--primary-lighter) 60%, var(--secondary) 40%);
        background: rgb(255 255 255 / 0.12);
    }
    .remember-checkbox:focus-visible {
        box-shadow:
            0 0 0 4px var(--secondary-opacity),
            inset 0 1px 0 rgb(255 255 255 / 0.06);
    }
    .remember-checkbox:checked {
        background: linear-gradient(130deg, var(--secondary), color-mix(in oklab, var(--secondary) 70%, white));
        border-color: var(--secondary);
    }
    .remember-checkbox:checked::after {
        transform: translateX(18px);
        background: var(--secondary-text);
        box-shadow: 0 4px 12px rgb(240 0 140 / 0.3);
    }
    .remember-label {
        font-size: 0.98em;
        transform: translateY(-2px);
    }

    .submit-button {
        padding: 14px 18px;
        min-width: 160px;
        background: var(--secondary);
        color: var(--secondary-text);
        border: none;
        border-radius: 12px;
        font-family: inherit;
        font-size: 1em;
        font-weight: 600;
        letter-spacing: 0.2px;
        cursor: pointer;
        transition: all 140ms ease;
    }
    .submit-button:hover {
        transform: translateY(-1px);
        filter: brightness(1.08);
    }
    .submit-button:active {
        transform: translateY(0);
        filter: brightness(0.95);
    }
    .submit-button:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--secondary-opacity);
    }

    @media only screen and (max-width: 620px) {
        .panel {
            padding: 22px;
            gap: 20px;
        }
        h1 {
            font-size: 1.6em;
        }
        .actions {
            flex-direction: column;
            align-items: stretch;
        }
        .submit-button {
            width: 100%;
            text-align: center;
        }
        .remember {
            justify-content: flex-start;
        }
    }
</style>
