let volumeControl, resetSoundsButton, soundFilesList, fileInput, saveButton;
let currentSounds = {};
let newlySelectedFiles = [];

document.addEventListener('DOMContentLoaded', setup);

function setup() {
    console.log("Setting up extension popup");
    volumeControl = document.getElementById('volumeControl');
    resetSoundsButton = document.getElementById('resetSounds');
    soundFilesList = document.getElementById('soundFilesList');
    fileInput = document.getElementById('soundFiles');
    saveButton = document.getElementById('saveButton');

    const collapsibleButton = document.querySelector('.collapsible-button');
    const collapsibleContent = document.querySelector('.collapsible-content');

    collapsibleButton.addEventListener('click', () => {
        collapsibleContent.style.display = collapsibleContent.style.display === "block" ? "none" : "block";
        collapsibleButton.classList.toggle("active");
    });

    // Load initial state
    popup_loadState();

    // Set volume when the range slider changes
    volumeControl.addEventListener('input', () => {
        const volume = parseFloat(volumeControl.value);
        sendMessageToBackground({ action: "setVolume", volume: volume });
    });

    // Reset sounds to default
    resetSoundsButton.addEventListener('click', () => {
        sendMessageToBackground({ action: "resetSounds" });
    });

    // Listen for file input changes
    fileInput.addEventListener('change', (event) => {
        newlySelectedFiles = Array.from(event.target.files);
        updateNewSoundsList();
    });

    // Save selected sound files
    saveButton.addEventListener('click', () => {
        if (newlySelectedFiles.length > 0) {
            const promises = newlySelectedFiles.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const audioData = e.target.result;
                        const fileName = file.name; // Get file name
                        sendMessageToBackground({
                            action: "bg-setSoundFiles",
                            files: [{ name: fileName, data: audioData }] // Store as an object with name and data
                        }).then(() => {
                            currentSounds[fileName] = audioData; // Update current sounds object
                            resolve();
                        }).catch(error => {
                            console.error('Error setting sound files:', error);
                            alert(`Failed to set sound files: ${error.message}`);
                            reject(error);
                        });
                    };
                    reader.onerror = (error) => {
                        console.error('Error reading file:', error);
                        alert('Failed to read the file.');
                        reject(error);
                    };

                    reader.readAsDataURL(file); // Start reading the file
                });
            });

            // Wait for all file reads and saves to complete
            Promise.all(promises).then(() => {
                alert('Sound files saved successfully.');
                updateSoundFilesList(currentSounds); // Refresh the list to show new sounds
            }).catch(() => {
                alert('Some sound files could not be saved. Please check the console for more details.');
            });
        } else {
            alert('Please select at least one file first.');
        }
    });

    // Listen for state updates from the background script
    browser.runtime.onMessage.addListener((message) => {
        if (message.action === "stateUpdated") {
            popup_loadState();
        }
    });
}


function updateSoundFilesList(files) {
    soundFilesList.innerHTML = ''; // Clear the list
    Object.keys(files).forEach((fileName) => {
        const li = document.createElement('li');
        li.textContent = fileName; // Display file name

        // Create a remove button
        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.className = 'remove-button';
        removeButton.onclick = () => {
            delete files[fileName]; // Remove sound from the currentSounds object
            sendMessageToBackground({
                action: "bg-setSoundFiles",
                files: Object.entries(files).map(([name, data]) => ({ name, data })) // Convert back to array format
            }).then(() => {
                alert(`${fileName} removed successfully.`);
                updateSoundFilesList(files); // Refresh the list to reflect changes
            }).catch((error) => {
                console.error('Error removing sound file:', error);
                alert(`Failed to remove sound file: ${error.message}`);
            });
        };

        // Append buttons to the list item
        li.appendChild(removeButton);
        soundFilesList.appendChild(li);
    });
}


function updateNewSoundsList() {
    const newSoundsList = document.getElementById('newSoundsList');
    newSoundsList.innerHTML = '';
    newlySelectedFiles.forEach(file => {
        const li = document.createElement('li');
        li.textContent = file.name;
        li.className = 'sound-item new-sound';
        newSoundsList.appendChild(li);
    });
}

function popup_loadState() {
    sendMessageToBackground({ action: "bg-getCurrentState" })
        .then(state => {
            if (state) {
                volumeControl.value = state.volume;
                currentSounds = state.sounds; // Load current sounds as an object
                updateSoundFilesList(currentSounds); // Update the list of current sounds
            } else {
                throw new Error("Received undefined state");
            }
        })
        .catch(error => {
            console.error('Error loading state:', error);
            alert(`Error loading state: ${error.message}`);
        });
}

function sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
        browser.runtime.sendMessage(message, (response) => {
            if (browser.runtime.lastError) {
                reject(browser.runtime.lastError);
            } else {
                resolve(response);
            }
        });
    });
}
