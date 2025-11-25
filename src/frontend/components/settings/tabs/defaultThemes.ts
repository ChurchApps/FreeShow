import type { Themes } from "../../../../types/Settings"

export const defaultThemes: { [key: string]: Themes } = {
    default: {
        name: "default",
        default: true,
        font: {
            family: "",
            size: "1em",
        },
        colors: {
            primary: "#001E17",
            "primary-lighter": "#363636",
            "primary-darker": "#121212",
            "primary-darkest": "#000000",
            text: "#FFFFFF",
            textInvert: "#131313",
            "secondary-text": "#f0f0ff",
            secondary: "#54EB77",
            "secondary-opacity": "#54EB77",
            hover: "#54EB77",
            focus: "#54EB77",
        },
    },
    // dark: {
    //     name: "dark",
    //     default: true,
    //     font: {
    //         family: "monospace",
    //         size: "1.1em",
    //     },
    //     colors: {
    //         primary: "#242832",
    //         "primary-lighter": "#2f3542",
    //         "primary-darker": "#191923",
    //         "primary-darkest": "#12121c",
    //         text: "#f0f0ff",
    //         textInvert: "#131313",
    //         "secondary-text": "#f0f0ff",
    //         secondary: "#E64934",
    //         "secondary-opacity": "rgb(230 73 52 / 0.5)",
    //         hover: "rgb(255 255 255 / 0.05)",
    //         focus: "rgb(255 255 255 / 0.1)",
    //     },
    // },
    // light: {
    //     name: "light",
    //     default: true,
    //     font: {
    //         family: "",
    //         size: "1em",
    //     },
    //     colors: {
    //         primary: "#DADDE2",
    //         "primary-lighter": "#B0B5C0",
    //         "primary-darker": "#E8EAED",
    //         "primary-darkest": "#EFF2F6",
    //         text: "#333748",
    //         textInvert: "#f0f0ff",
    //         "secondary-text": "#131313",
    //         secondary: "#F0008C",
    //         "secondary-opacity": "rgb(230 52 156 / 0.5)",
    //         hover: "rgb(0 0 0 / 0.05)",
    //         focus: "rgb(0 0 0 / 0.1)",
    //     },
    // }
}
