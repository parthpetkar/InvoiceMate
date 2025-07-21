const { BrowserWindow } = require("electron");
const path = require("path");
const { Menu, MenuItem } = require('electron');

function createWindow() {
    const win = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            preload: path.join(__dirname, "../Backend/preload.js"),
            spellcheck: true,
        },
    });

    // Setup spell check context menu
    win.webContents.on('context-menu', (event, params) => {
        const menu = new Menu();

        for (const suggestion of params.dictionarySuggestions) {
            menu.append(new MenuItem({
                label: suggestion,
                click: () => win.webContents.replaceMisspelling(suggestion)
            }));
        }

        if (params.misspelledWord) {
            menu.append(
                new MenuItem({
                    label: 'Add to dictionary',
                    click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
                })
            );
        }

        menu.popup();
    });

    win.loadFile("public/login.html");
    win.maximize();
    
    return win;
}

module.exports = { createWindow };