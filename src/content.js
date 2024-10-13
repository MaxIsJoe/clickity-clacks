// Listen for keydown events on the entire document
window.addEventListener('keydown', (event) => {
    browser.runtime.sendMessage({ action: "playSound" });
});
