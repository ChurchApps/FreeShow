<script lang="ts">
    import { OPEN_FILE } from "../../../../types/Channels"
    import { driveData, driveKeys } from "../../../stores"
    import { driveConnect } from "../../../utils/drive"
    import Icon from "../../helpers/Icon.svelte"
    import Button from "../../inputs/Button.svelte"

    function getKeysFile() {
        window.api.send(OPEN_FILE, { channel: "GOOGLE_KEYS", title: "Select keys file", filter: { name: "JSON", extensions: ["json"] }, multiple: false, read: true })
    }
</script>

<p>Connect to the cloud</p>

<div>
    <Button on:click={getKeysFile}>
        <Icon id="key" right />
        {#if $driveKeys}
            Update keys file
        {:else}
            Select keys (client secret) file
        {/if}
    </Button>
</div>

{#if $driveKeys}
    <!-- TODO: enable/disable sync -->

    <div>
        <Button on:click={() => driveConnect($driveKeys)}>Reconnect & Sync</Button>
    </div>

    <div>
        <p>Main Folder Id</p>
        <!-- TODO: change main folder... -->
        <p><span>https://drive.google.com/drive/folders/</span>{$driveData.mainFolderId || ""}</p>
    </div>
{:else}
    <p>You need to provide your own Google API key so the program can automatically upload to your google drive. Keep in mind you have a 750 GB limit per day, and 20,000 queries per second which should be plenty.</p>
    <p>Don't know how to get one? Click here for a guide.</p>
{/if}

<!-- save to update -->

<!-- HOW to:
    - (Use the google account you want to store the files in the drive... (If you are a team, you could create a new google account for that team. (You can use you own drive, they don't need the password to your google account...)))
    - ((https://www.youtube.com/watch?v=1y0-IfRW114))
    - Go to your Google Developer Console: https://console.developers.google.com/apis/api/drive.googleapis.com/overview
    - Create a new project
    - Enable the Drive API

    - Click on "Create Credentials" (Service Account)
    - Choose ("User data" or) "Application data", then "No, I'm not using them"
    - Click "Next"
    - Next you just need an ID, e.g. "freeshow", but can enter a name/description if you want, it doesn't really matter, because this will probably only be used inside of FreeShow
    - Click "Create and continue"
    - No need to enter a role, click "Continue"
    - No need to enter anything here either, click "Done"
    - Then in the page "Credentials", you will find the service account
    - In your service account, click on the "Keys" menu, then "Add key", then "Create new key", keep as "JSON" and click "Create".
    - This file is the key to connect to your drive, you need to store this and use it all of the places where you want to connect to the drive...

    - Copy your mail: should be something like this: freeshow@project_id.iam.gserviceaccount.com
    - Then create a new folder in the drive, click "Share" and paste the mail, you can uncheck "Send notifications". Make sure the permission is set to "Edit"

    - Now you are done and dont need to do this again (Maybe). Just make sure to keep the Keys file, or else you have to go make and create a new, then update all of freeshow.....

    -----

    ((- Go to "Credentials" inside of the "Google Drive API"
    - Click "Configure consent screen" for OAuth
    - Select "External"
    - Click "Save and continue"
    - Type "FreeShow" in App name
    - Select you email in "User support email"
    - Type your own email in "Developer contact information"
    - Click "Save and continue"
    - You don't need to change any scopes, click "Save and continue"
    - You have to add a test user. Click "Add users"
    - In the menu, type the email adress of the Google Account you want to use, then click "Add"
    - Then click "Save and continue"
    - You can check the summary and click "Back to dashboard"

    - In the "Credentials" page
    - Click "Create credentials", then "OAuth client ID"
    - Select "Web application"
    - Then under "Authorized redirect URIs", click "Add URI" and paste this: "http://localhost:3000/oauth2callback",
    - Then click "Create"

    - Next you will get a popup with some "passwords", you can download them as JSON and import the JSON file, or just paste the keys in manually.))


(It is free, you don't need to add "billing" info)
Create video!!!
-->
