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
		<div class="brand">
			<h1 class="title">RemoteShow</h1>
		</div>

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
			<div class="field">
				<span class="icon" aria-hidden="true">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M7 10V8a5 5 0 0 1 10 0v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						<rect x="4.75" y="10" width="14.5" height="9.5" rx="2.5" stroke="currentColor" stroke-width="1.5"/>
						<circle cx="12" cy="14.75" r="1.25" fill="currentColor"/>
					</svg>
				</span>
				<input
					id="password-input"
					class="input"
					type="password"
					name="password"
					autocomplete="current-password"
					placeholder={translate("remote.password", $dictionary)}
					on:input={(e) => _update("password", "stored", getValue(e))}
					on:change={(e) => _update("password", "stored", getValue(e))}
					value={$password.stored}
				/>
			</div>

			<div class="actions">
				<label class="remember-row">
					<input class="remember-checkbox" type="checkbox" checked={$password.remember} on:change={(e) => _update("password", "remember", isChecked(e))} />
					<span class="remember-label">{translate("remote.remember", $dictionary)}</span>
				</label>

				<div class="submit-wrap">
					<Button type="submit" bold center variant="contained" style="width: 100%; border-radius: 12px;">{translate("remote.submit", $dictionary)}</Button>
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
		gap: 18px;
		padding: 28px;
		width: min(560px, 92vw);
		background-color: var(--primary-darker);
		border: 1px solid var(--primary-lighter);
		border-radius: 16px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2);
		position: relative;
		overflow: hidden;
	}

	.brand {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
	}
	.title {
		margin: 0;
		text-align: center;
		color: var(--secondary);
		letter-spacing: 0.2px;
	}

	.auth-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
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
		left: 12px;
		color: color-mix(in oklab, var(--text) 70%, transparent);
		pointer-events: none;
	}
	.input {
		width: 100%;
		background-color: rgb(255 255 255 / 0.06);
		color: var(--text);
		padding: 12px 16px 12px 40px;
		border: 1px solid var(--primary-lighter);
		border-radius: 12px;
		font-size: inherit;
		transition: outline-color 120ms ease, background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
	}
	.input:hover {
		border-color: color-mix(in oklab, var(--primary-lighter) 60%, var(--secondary));
		background-color: rgb(255 255 255 / 0.08);
	}
	.input:active,
	.input:focus {
		outline: 2px solid var(--secondary);
		outline-offset: 0;
		background-color: rgb(255 255 255 / 0.1);
		box-shadow: 0 0 0 4px var(--secondary-opacity);
		border-color: var(--secondary);
	}
	.input::placeholder {
		color: inherit;
		opacity: 0.55;
	}

	.actions {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 12px;
		align-items: center;
	}
	.submit-wrap { width: 100%; }

	.remember-row {
		display: inline-flex;
		align-items: center;
		gap: 10px;
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
		transition: box-shadow 120ms ease, border-color 120ms ease, background-color 120ms ease;
	}
	.remember-checkbox:hover { border-color: color-mix(in oklab, var(--primary-lighter) 60%, var(--secondary)); }
	.remember-checkbox:focus { box-shadow: 0 0 0 3px var(--secondary-opacity); }
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
	.remember-label { opacity: 0.8; font-size: 0.95em; }

	@media only screen and (max-width: 560px) {
		.card { padding: 22px; }
		.title { font-size: 1.4em; }
		.input { padding: 10px 14px 10px 38px; }
		.actions { grid-template-columns: 1fr; }
		.submit-wrap { margin-top: 12px; }
	}
</style>
