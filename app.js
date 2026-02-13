// ================= TELEGRAM & GLOBAL STATE =================
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    // Set background color to match the app's theme
    tg.setHeaderColor('#101218');
    tg.setBackgroundColor('#101218');
}

// Global variables for mock data
let localCoin = 1250;
let energy = 850;
const maxEnergy = 1000;

// ================= UI FUNCTIONS =================
function showLoader(show) {
    const loader = document.getElementById('loader-overlay');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.innerText = value;
    }
}

// ================= APP ENTRY POINT =================
async function main() {
    showLoader(true);
    
    // Using mock data as there is no Firebase connection in this version.
    // This allows you to see the design working immediately.
    const mockData = {
        username: "CyberUser",
        localCoin: localCoin,
        clickerEnergy: energy
    };
    
    updateUI(mockData);
    bindAllEvents();
    
    showLoader(false);
}

// ================= CORE UI UPDATE FUNCTION =================
function updateUI(data) {
    if (!data) return;
    
    const username = data.username || 'User';
    
    updateElement('username', username);
    updateElement('user-avatar', username.charAt(0).toUpperCase());
    updateElement('local-coin', Math.floor(data.localCoin));
    
    const currentEnergy = data.clickerEnergy ?? maxEnergy;
    updateElement('energy-level', `${currentEnergy}`);
}

// ================= EVENT BINDING =================
function bindAllEvents() {
    const clickerButton = document.getElementById('clicker-button');
    if (clickerButton) {
        clickerButton.addEventListener('click', handleTap);
    }
    
    // You can add event listeners for other buttons here if needed
    // Example:
    // document.getElementById('go-to-tasks-page').addEventListener('click', () => {
    //     alert('Go to Tasks Page');
    // });
}

// ================= EVENT HANDLERS =================
function handleTap(event) {
    if (energy <= 0) {
        // Optional: Add a visual indicator that energy is depleted
        const clicker = event.currentTarget;
        clicker.style.animation = 'shake 0.3s';
        setTimeout(() => {
            clicker.style.animation = '';
        }, 300);
        return;
    }

    // Update mock data
    localCoin++;
    energy--;
    
    // Update the UI with the new values
    updateElement('local-coin', localCoin);
    updateElement('energy-level', energy);

    // Create and animate the +1 feedback
    const feedback = document.createElement('div');
    feedback.className = 'click-feedback';
    feedback.innerText = '+1';
    document.body.appendChild(feedback);
    
    // Position the feedback at the click location
    const x = event.clientX;
    const y = event.clientY;
    feedback.style.left = `${x}px`;
    feedback.style.top = `${y}px`;

    // Remove the element after the animation ends to prevent clutter
    feedback.addEventListener('animationend', () => {
        feedback.remove();
    });
}

// ================= START THE APP =================
// This function call starts the entire application
main();
