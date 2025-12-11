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

<div class="center">
    <div class="card">
        <div class="brand">
            <h1 class="title">RemoteShow</h1>
        </div>

        <form on:submit|preventDefault={submit} class="auth-form">
            <!-- Hidden username field for better password manager compatibility -->
            <label class="sr-only" for="username-input">Username</label>
            <input id="username-input" class="sr-only" type="text" name="username" autocomplete="username" inputmode="text" autocapitalize="none" autocorrect="off" spellcheck="false" tabindex="-1" aria-hidden="true" />

            <label class="sr-only" for="password-input">{translate("remote.password", $dictionary)}</label>
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

            <div class="actions">
                <label class="remember-row">
                    <input class="remember-checkbox" type="checkbox" checked={$password.remember} on:change={(e) => _update("password", "remember", isChecked(e))} />
                    <span class="remember-label">{translate("remote.remember", $dictionary)}</span>
                </label>

                <div class="submit-wrap">
                    <button type="submit" class="submit-button">{translate("remote.submit", $dictionary)}</button>
                </div>
            </div>
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
        gap: 24px;
        padding: 32px;
        width: min(560px, 92vw);
        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 20px;
        box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.25),
            0 2px 8px rgba(0, 0, 0, 0.15);
        position: relative;
        overflow: hidden;
    }

    .brand {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin-bottom: 8px;
    }
    .title {
        margin: 0;
        text-align: center;
        color: var(--secondary);
        letter-spacing: 0.3px;
        font-weight: 500;
        font-size: 1.75em;
    }

    .auth-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
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

    .field {
        position: relative;
        display: flex;
        align-items: center;
    }
    .icon {
        position: absolute;
        left: 14px;
        color: color-mix(in oklab, var(--text) 65%, transparent);
        pointer-events: none;
        z-index: 1;
    }
    .input {
        width: 100%;
        background-color: rgb(255 255 255 / 0.05);
        color: var(--text);
        padding: 14px 18px 14px 44px;
        border: 1.5px solid var(--primary-lighter);
        border-radius: 14px;
        font-size: inherit;
        transition: all 150ms ease;
    }
    .input:hover {
        border-color: color-mix(in oklab, var(--primary-lighter) 70%, var(--secondary));
        background-color: rgb(255 255 255 / 0.07);
    }
    .input:active,
    .input:focus {
        outline: none;
        background-color: rgb(255 255 255 / 0.09);
        box-shadow: 0 0 0 3px var(--secondary-opacity);
        border-color: var(--secondary);
        transform: translateY(-1px);
    }
    .input::placeholder {
        color: inherit;
        opacity: 0.5;
    }

    .actions {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 16px;
        align-items: center;
        margin-top: 4px;
    }
    .submit-wrap {
        width: 100%;
    }

    .remember-row {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        user-select: none;
        cursor: pointer;
    }
    .remember-checkbox {
        appearance: none;
        width: 19px;
        height: 19px;
        border-radius: 6px;
        border: 1.5px solid var(--primary-lighter);
        background-color: rgb(255 255 255 / 0.05);
        display: inline-block;
        position: relative;
        outline: none;
        cursor: pointer;
        transition: all 150ms ease;
        flex-shrink: 0;
    }
    .remember-checkbox:hover {
        border-color: color-mix(in oklab, var(--primary-lighter) 70%, var(--secondary));
        background-color: rgb(255 255 255 / 0.07);
    }
    .remember-checkbox:focus {
        box-shadow: 0 0 0 3px var(--secondary-opacity);
    }
    .remember-checkbox:checked {
        background-color: var(--secondary);
        border-color: var(--secondary);
    }
    .remember-checkbox:checked::after {
        content: "";
        position: absolute;
        left: 6px;
        top: 3px;
        width: 5px;
        height: 9px;
        border: solid var(--secondary-text);
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
    }
    .remember-label {
        opacity: 0.85;
        font-size: 0.95em;
        cursor: pointer;
    }

    .submit-button {
        width: 100%;
        padding: 14px 18px;
        background-color: var(--secondary);
        color: var(--secondary-text);
        border: none;
        border-radius: 14px;
        font-family: inherit;
        font-size: inherit;
        font-weight: 500;
        letter-spacing: 0.2px;
        cursor: pointer;
        transition: all 150ms ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    .submit-button:hover {
        background-color: color-mix(in oklab, var(--secondary) 90%, white);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transform: translateY(-1px);
    }

    .submit-button:active {
        transform: translateY(0);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
    }

    .submit-button:focus {
        outline: none;
        box-shadow:
            0 0 0 3px var(--secondary-opacity),
            0 4px 12px rgba(0, 0, 0, 0.2);
    }

    @media only screen and (max-width: 560px) {
        .card {
            padding: 24px;
            gap: 20px;
        }
        .title {
            font-size: 1.5em;
        }
        .auth-form {
            gap: 18px;
        }
        .input {
            padding: 12px 16px 12px 42px;
        }
        .actions {
            grid-template-columns: 1fr;
            gap: 14px;
        }
        .submit-wrap {
            margin-top: 0;
        }
        .submit-button {
            padding: 12px 16px;
        }
    }
</style>
