//import JZZ from "jzz"
//import { toApp } from ".."
import type { API_rest_command } from "./api"

export async function sendRestCommand(data: API_rest_command) {

    // For Debugging:
    //console.log("Send REST (isch) Command:");
    //console.log("URL:", data.url);
    //console.log("Method:", data.method);
    //console.log("Content-Type:", data.contentType);
    //console.log("Payload:", data.payload);

    // Prepare options:
    const options: RequestInit = {};

    // if a Method is set, use the given Method, else use GET as default
    if (data.method) {
        options.method = data.method;
    }
    else {
        // on default use GET-Request
        options.method = "GET";
        console.log("Using Default GET");
    }

    // if Content Type is set, add the corresponding field in the Request-Header
    if (data.contentType) {
        options.headers = { 'Content-Type': data.contentType }
    }

    // If a Payload is provoded, add it to the requests body
    if (data.payload && (data.method === 'POST' || data.method === 'PUT')) {
        //options.body = JSON.stringify(data.payload);
        options.body = data.payload;
    }

    // Check if URL starts with HTTP or HTTPS, if not insert HTTP on default
    if (!(data.url.startsWith("http://") || data.url.startsWith("https://"))) {
        data.url = "http://" + data.url;
    }

    try {
        const response = await fetch(data.url, options);

        if (!response.ok) {
            //throw new Error(`HTTP error! status: ${response.status}`);
            console.error(`HTTP error! status: ${response.status}`);
        }

        //let result : String = await response.json();
        let result: String = await response.text();
        console.log(result);

        //return result;

    } catch (error) {
        console.error('Request failed:', error);
        //throw error;
    }
}