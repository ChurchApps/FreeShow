"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Store = require("electron-store");
const electronSettings = new Store({
    defaults: {
        loaded: false,
        width: 800,
        height: 600,
        maximized: false,
    },
});
exports.default = electronSettings;
//# sourceMappingURL=settings.js.map