<div class="loader" />

<style>
    .loader {
        border: 5px solid var(--primary-lighter);
        border-radius: 50%;
        border-top: 5px solid var(--secondary);
        /* border-top: 20px solid var(--secondary); */
        /* border-top: 35px solid var(--secondary); */
        width: 40px;
        height: 40px;
        -webkit-animation: spin 0.5s ease-in infinite; /* Safari */
        animation: spin 0.5s ease-in infinite;
    }

    /* Safari */
    @-webkit-keyframes spin {
        0% {
            -webkit-transform: rotate(0deg);
        }
        100% {
            -webkit-transform: rotate(360deg);
        }
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }
</style>
