let mainWindow = null;
const defaultSoundFile = browser.runtime.getURL("sounds/default-sound.wav");
let currentVolume = 0.5; // Default volume
let currentSoundFiles = { [defaultSoundFile]: defaultSoundFile }; // Default to built-in sound as an object

// Listener for messages from popup.js
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case "bg-getCurrentState":
            getCurrentStateFromStorage().then(currentState => {
                console.log("Sending state: ", currentState);
                sendResponse(currentState);
            });
            return true; // Indicates that we will send a response asynchronously

        case "bg-setSoundFiles":
            getCurrentStateFromStorage().then(currentState => {
                message.files.forEach(file => {
                    currentSoundFiles[file.name] = file.data;
                });
                return saveState();
            }).then(() => {
                console.log('Custom sound files saved:', message.files);
                sendResponse({ success: true });
            }).catch(error => {
                console.error('Error saving sound files:', error);
                sendResponse({ success: false, error: error.message });
            });
            return true;

        case "setVolume":
            setVolume(message.volume);
            break;

        case "resetSounds":
            resetSounds();
            console.log('Resetting sounds to default');
            break;

        default:
            console.warn(`Unhandled action: ${message.action}`);
    }
});

browser.windows.onRemoved.addListener((windowId) => {
    if (mainWindow && mainWindow.id === windowId) {
        mainWindow = null;
    }
});

browser.browserAction.onClicked.addListener(() => {
    if (mainWindow) {
        browser.windows.update(mainWindow.id, { focused: true });
    } else {
        browser.windows.create({
            url: browser.runtime.getURL("src/main-window.html"),
            type: "popup",
            width: 375,
            height: 650
        }).then((window) => {
            mainWindow = window;
        });
    }
});


function playRandomSound() {
    const soundKeys = Object.keys(currentSoundFiles);
    const randomIndex = Math.floor(Math.random() * soundKeys.length);
    const soundFile = soundKeys[randomIndex];

    const audio = new Audio(currentSoundFiles[soundFile]);
    audio.volume = currentVolume;

    // Set a random pitch between 0.65 (lower pitch) and 2.0 (higher pitch)
    const randomPitch = 0.65 + Math.random() * 1.35; // Random value between 0.75 and 2.0
    audio.playbackRate = randomPitch;

    audio.play().catch((error) => {
        console.error('Error playing random sound:', error);
    });
}

function setVolume(volume) {
    currentVolume = volume;
    saveState();
    browser.runtime.sendMessage({ action: "stateUpdated" });
}

function resetSounds() {
    currentSoundFiles = { "default-sound.wav": browser.runtime.getURL("sounds/default-sound.wav") }; // Reset to default sound files as an object
    saveState();
    browser.runtime.sendMessage({ action: "stateUpdated" });
}

function saveState() {
    console.log("Saving state:", currentVolume, currentSoundFiles);
    // Notify popup to update its UI
    return browser.storage.local.set({
        volume: currentVolume,
        soundFiles: currentSoundFiles
    }).catch(error => {
        console.error('Error saving state:', error);
    });
}

function loadState() {
    browser.storage.local.get(['volume', 'soundFiles']).then((result) => {
        if (result.volume !== undefined) {
            currentVolume = result.volume;
        }
        if (result.soundFiles) {
            currentSoundFiles = result.soundFiles;
        }
    });
}

function getCurrentStateFromStorage() {
    return new Promise((resolve, reject) => {
        browser.storage.local.get(['volume', 'soundFiles'], (result) => {
            if (browser.runtime.lastError) {
                reject(browser.runtime.lastError);
            } else {
                resolve({
                    sounds: result.soundFiles || {}, // Fallback to empty object if undefined
                    volume: result.volume || 0.5     // Fallback to default volume if undefined
                });
            }
        });
    });
}

function initialize() {
    browser.runtime.onMessage.addListener((message) => {
        if (message.action === "stateUpdated") {
            loadState();
        } else if (message.action === "playSound") {
            playRandomSound();
        }
    });
    loadState();
}

initialize();
