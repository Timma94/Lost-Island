/* =========================================================
   LOST ISLAND
   Chastify Extension Bridge + Game Engine
   Version 4.1
   ========================================================= */


/* =========================================================
   GAME SETTINGS
   ========================================================= */

const defaultSettings = {
    difficulty: "normal",

    rewardChance: 35,
    neutralChance: 40,
    punishmentChance: 25,

    rewardMin: 30,
    rewardMax: 60,

    punishmentMin: 60,
    punishmentMax: 300
};

let settings = { ...defaultSettings };


/* =========================================================
   GAME STATE
   ========================================================= */

let game = {
    health: 100,
    water: 2,
    food: 2,
    materials: 1,
    day: 1,

    actions: 0,

    chastifyConnected: false,
    sessionId: null,
    lockId: null,
    mainToken: null,

    config: {}
};


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const healthEl = document.getElementById("health");
const waterEl = document.getElementById("water");
const foodEl = document.getElementById("food");
const materialsEl = document.getElementById("materials");
const dayEl = document.getElementById("day");

const storyEl = document.getElementById("story");
const eventEl = document.getElementById("event");
const resultEl = document.getElementById("result");
const actionsEl = document.getElementById("actions");

const connectionDot = document.getElementById("connectionDot");
const connectionText = document.getElementById("connectionText");

const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");

const saveSettingsBtn = document.getElementById("saveSettings");
const closeSettingsBtn = document.getElementById("closeSettings");


/* =========================================================
   UI
   ========================================================= */

function updateUI() {

    healthEl.textContent = game.health;
    waterEl.textContent = game.water;
    foodEl.textContent = game.food;
    materialsEl.textContent = game.materials;
    dayEl.textContent = game.day;

    updateConnectionUI();
}


function updateConnectionUI() {

    if (game.chastifyConnected) {

        connectionDot.classList.remove("offline");
        connectionDot.classList.add("online");

        connectionText.textContent =
            "Chastify: Connected";

    } else {

        connectionDot.classList.remove("online");
        connectionDot.classList.add("offline");

        connectionText.textContent =
            "Chastify: Offline";
    }
}


/* =========================================================
   CHASTIFY EXTENSION BRIDGE
   ========================================================= */

/*
   Chastify communicates with extensions through postMessage.

   We listen for messages from the parent window.

   IMPORTANT:
   We do NOT trust arbitrary messages.

   The parent origin is checked when available.
*/

let chastifyParentOrigin = null;


window.addEventListener("message", function(event) {

    /*
       Remember the origin of the Chastify parent.

       When running directly on GitHub Pages there will normally
       be no Chastify parent, so this remains unused.
    */

    if (!event.origin) {
        return;
    }


    /*
       Ignore messages that don't look like Chastify messages.
    */

    const data = event.data;

    if (!data || typeof data !== "object") {
        return;
    }


    /*
       Log messages during development.

       This is useful while testing the extension.
    */

    console.log("Lost Island received message:", data);


    /*
       Setup initialization
    */

    if (data.type === "chastify:ext:setup:init") {

        handleSetupInit(data, event);

        return;
    }


    /*
       Runtime/session initialization.

       Different Chastify versions may provide slightly
       different message structures, so we handle common forms.
    */

    if (
        data.type === "chastify:ext:init" ||
        data.type === "chastify:ext:session:init" ||
        data.type === "chastify:ext:launch"
    ) {

        handleExtensionInit(data, event);

        return;
    }


    /*
       Session updates
    */

    if (
        data.type === "chastify:ext:session:update" ||
        data.type === "chastify:ext:session:updated"
    ) {

        handleSessionUpdate(data);

        return;
    }

});


/* =========================================================
   SETUP HANDLER
   ========================================================= */

function handleSetupInit(data, event) {

    console.log("Chastify setup initialized.");

    chastifyParentOrigin = event.origin;

    game.chastifyConnected = true;

    updateConnectionUI();


    /*
       Chastify expects the extension to provide its configuration.

       Our current game has no required configuration yet,
       so we return an empty object.
    */

    sendToChastify(
        {
            type: "chastify:ext:setup:config",
            config: {}
        },
        event.source,
        event.origin
    );
}


/* =========================================================
   EXTENSION INIT
   ========================================================= */

function handleExtensionInit(data, event) {

    console.log("Chastify extension initialized:", data);

    chastifyParentOrigin = event.origin;

    game.chastifyConnected = true;


    /*
       Try to locate the session information.

       Chastify may place this directly in the message
       or inside a payload object.
    */

    const payload = data.payload || data;


    game.sessionId =
        payload.sessionId ||
        payload.session_id ||
        null;

    game.lockId =
        payload.lockId ||
        payload.lock_id ||
        null;

    game.mainToken =
        payload.mainToken ||
        payload.main_token ||
        null;


    /*
       Save configuration if Chastify supplied it.
    */

    if (payload.config) {

        game.config = payload.config;

    }


    console.log("Lost Island session:", {
        sessionId: game.sessionId,
        lockId: game.lockId,
        hasMainToken: !!game.mainToken,
        config: game.config
    });


    updateConnectionUI();


    /*
       Display a small connection confirmation in the game.
    */

    showConnectionMessage();
}


/* =========================================================
   SESSION UPDATE
   ========================================================= */

function handleSessionUpdate(data) {

    console.log("Chastify session update:", data);

    const payload = data.payload || data;

    if (payload.sessionId) {
        game.sessionId = payload.sessionId;
    }

    if (payload.lockId) {
        game.lockId = payload.lockId;
    }

    if (payload.config) {
        game.config = payload.config;
    }

    game.chastifyConnected = true;

    updateConnectionUI();
}


/* =========================================================
   SEND MESSAGE TO CHASTIFY
   ========================================================= */

function sendToChastify(message, targetWindow, targetOrigin) {

    /*
       If we're running directly on GitHub Pages,
       there is no Chastify parent.
    */

    if (!window.parent || window.parent === window) {

        console.log(
            "Lost Island is running outside Chastify:",
            message
        );

        return;
    }


    const destination =
        targetWindow || window.parent;

    const origin =
        targetOrigin ||
        chastifyParentOrigin ||
        "*";


    destination.postMessage(
        message,
        origin
    );

}


/* =========================================================
   CONNECTION MESSAGE
   ========================================================= */

function showConnectionMessage() {

    resultEl.className = "result reward";

    resultEl.innerHTML = `
        <strong>🔗 Chastify connected</strong>

        <p>
            Lost Island is running inside Chastify.
        </p>

        ${
            game.sessionId
                ? `<p>Session detected ✓</p>`
                : `<p>Session information not detected yet.</p>`
        }

        <p>
            Time control is not active yet.
        </p>
    `;

    resultEl.classList.remove("hidden");
}


/* =========================================================
   GAME ACTIONS
   ========================================================= */

document.querySelectorAll(".action").forEach(button => {

    button.addEventListener("click", function() {

        const action = this.dataset.action;

        performAction(action);

    });

});


function performAction(action) {

    game.actions++;

    clearResult();

    switch (action) {

        case "water":
            searchWater();
            break;

        case "explore":
            explore();
            break;

        case "materials":
            gatherMaterials();
            break;

        case "wreck":
            investigateWreck();
            break;

        case "camp":
            workOnCamp();
            break;

        default:
            console.warn("Unknown action:", action);
    }

    updateUI();
}


/* =========================================================
   WATER
   ========================================================= */

function searchWater() {

    const roll = Math.random() * 100;

    if (roll < 60) {

        game.water += 2;

        showResult(
            "reward",
            "💧 Water found!",
            "You discover a small freshwater source hidden among the rocks.",
            "+2 Water"
        );

    } else if (roll < 85) {

        showResult(
            "neutral",
            "💧 No luck.",
            "You search for a long time but find nothing useful.",
            "+0 Water"
        );

    } else {

        game.health -= 5;

        triggerRngOutcome(
            "water",
            "☠️ Something went wrong.",
            "While searching for water you become disoriented and injure yourself."
        );
    }
}


/* =========================================================
   EXPLORE
   ========================================================= */

function explore() {

    const roll = Math.random() * 100;

    if (roll < 45) {

        game.materials += 1;

        showResult(
            "reward",
            "🌴 Useful discovery!",
            "You find a promising path deeper into the island.",
            "+1 Materials"
        );

    } else if (roll < 75) {

        showResult(
            "neutral",
            "🌴 Nothing useful.",
            "The jungle leads nowhere. You return to camp.",
            "+0"
        );

    } else {

        game.health -= 10;

        triggerRngOutcome(
            "explore",
            "⚠️ Dangerous exploration.",
            "You slip on wet rocks and hurt yourself."
        );
    }
}


/* =========================================================
   MATERIALS
   ========================================================= */

function gatherMaterials() {

    const roll = Math.random() * 100;

    if (roll < 65) {

        game.materials += 2;

        showResult(
            "reward",
            "🪵 Materials found!",
            "You collect branches, vines and useful pieces of wood.",
            "+2 Materials"
        );

    } else if (roll < 90) {

        showResult(
            "neutral",
            "🪵 Poor harvest.",
            "You find very little that can actually be used.",
            "+0 Materials"
        );

    } else {

        game.health -= 5;

        triggerRngOutcome(
            "materials",
            "🩸 You get injured.",
            "A sharp branch cuts your hand while gathering materials."
        );
    }
}


/* =========================================================
   WRECK
   ========================================================= */

function investigateWreck() {

    const roll = Math.random() * 100;

    if (roll < 50) {

        game.materials += 3;

        showResult(
            "reward",
            "⚓ Salvage!",
            "You recover useful parts from the wreckage.",
            "+3 Materials"
        );

    } else if (roll < 80) {

        showResult(
            "neutral",
            "⚓ Nothing useful.",
            "The remaining wreckage is badly damaged.",
            "+0"
        );

    } else {

        game.health -= 8;

        triggerRngOutcome(
            "wreck",
            "⚠️ The wreck shifts!",
            "A piece of the wreck collapses while you search it."
        );
    }
}


/* =========================================================
   CAMP
   ========================================================= */

function workOnCamp() {

    if (game.materials >= 2) {

        game.materials -= 2;

        showResult(
            "reward",
            "🏕️ Camp improved!",
            "You strengthen your shelter against the night.",
            "-2 Materials / Better shelter"
        );

    } else {

        showResult(
            "neutral",
            "🏕️ Not enough materials.",
            "You don't have enough materials to make meaningful improvements.",
            "+0"
        );
    }
}


/* =========================================================
   RNG OUTCOME
   ========================================================= */

function triggerRngOutcome(action, title, description) {

    const roll = Math.random() * 100;

    const rewardChance = settings.rewardChance;

    const neutralChance =
        rewardChance + settings.neutralChance;


    if (roll < rewardChance) {

        showRewardOutcome(action);

    } else if (roll < neutralChance) {

        showResult(
            "neutral",
            "😐 A close call.",
            description,
            "+0 time"
        );

    } else {

        showPunishmentOutcome(action, title, description);

    }
}


/* =========================================================
   REWARD OUTCOME
   ========================================================= */

function showRewardOutcome(action) {

    const minutes = randomInt(
        settings.rewardMin,
        settings.rewardMax
    );

    showResult(
        "reward",
        "🍀 Lucky break!",
        "Something unexpectedly works in your favor.",
        `Potential reward: -${minutes} minutes`
    );


    /*
       IMPORTANT:

       We only display the calculated value right now.

       We are NOT sending it to Chastify yet.

       Once the bridge/backend is confirmed, this function
       will call the secure time-action endpoint.
    */

    console.log(
        "REWARD:",
        minutes,
        "minutes",
        "Action:",
        action
    );
}


/* =========================================================
   PUNISHMENT OUTCOME
   ========================================================= */

function showPunishmentOutcome(action, title, description) {

    const minutes = randomInt(
        settings.punishmentMin,
        settings.punishmentMax
    );

    showResult(
        "punishment",
        title,
        description,
        `Potential punishment: +${minutes} minutes`
    );


    /*
       Same security rule:

       Do not call the Chastify API directly from this
       browser code.

       The backend will eventually handle this.
    */

    console.log(
        "PUNISHMENT:",
        minutes,
        "minutes",
        "Action:",
        action
    );
}


/* =========================================================
   RESULT DISPLAY
   ========================================================= */

function showResult(type, title, description, consequence) {

    resultEl.className = `result ${type}`;

    resultEl.innerHTML = `
        <h3>${title}</h3>

        <p>${description}</p>

        <strong>${consequence}</strong>
    `;

    resultEl.classList.remove("hidden");
}


function clearResult() {

    resultEl.className = "result hidden";
    resultEl.innerHTML = "";

}


/* =========================================================
   RANDOM INTEGER
   ========================================================= */

function randomInt(min, max) {

    min = Number(min);
    max = Number(max);

    if (min > max) {
        [min, max] = [max, min];
    }

    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;
}


/* =========================================================
   SETTINGS
   ========================================================= */

settingsBtn.addEventListener("click", function() {

    loadSettingsIntoForm();

    settingsModal.classList.remove("hidden");

});


closeSettingsBtn.addEventListener("click", function() {

    settingsModal.classList.add("hidden");

});


saveSettingsBtn.addEventListener("click", function() {

    saveSettings();

    settingsModal.classList.add("hidden");

});


function loadSettingsIntoForm() {

    document.getElementById("difficulty").value =
        settings.difficulty;

    document.getElementById("rewardChance").value =
        settings.rewardChance;

    document.getElementById("neutralChance").value =
        settings.neutralChance;

    document.getElementById("punishmentChance").value =
        settings.punishmentChance;

    document.getElementById("rewardMin").value =
        settings.rewardMin;

    document.getElementById("rewardMax").value =
        settings.rewardMax;

    document.getElementById("punishmentMin").value =
        settings.punishmentMin;

    document.getElementById("punishmentMax").value =
        settings.punishmentMax;
}


function saveSettings() {

    settings.difficulty =
        document.getElementById("difficulty").value;

    settings.rewardChance =
        Number(document.getElementById("rewardChance").value);

    settings.neutralChance =
        Number(document.getElementById("neutralChance").value);

    settings.punishmentChance =
        Number(document.getElementById("punishmentChance").value);

    settings.rewardMin =
        Number(document.getElementById("rewardMin").value);

    settings.rewardMax =
        Number(document.getElementById("rewardMax").value);

    settings.punishmentMin =
        Number(document.getElementById("punishmentMin").value);

    settings.punishmentMax =
        Number(document.getElementById("punishmentMax").value);


    /*
       Make sure the RNG percentages add up correctly.
    */

    const total =
        settings.rewardChance +
        settings.neutralChance +
        settings.punishmentChance;


    if (total !== 100) {

        alert(
            "Reward %, Neutral % and Punishment % must add up to 100%."
        );

        return;
    }


    console.log(
        "Settings saved:",
        settings
    );
}


/* =========================================================
   INITIALIZE
   ========================================================= */

function initializeGame() {

    updateUI();

    console.log("🏝️ Lost Island initialized.");

    console.log(
        "Running inside iframe:",
        window.parent !== window
    );


    /*
       If we're inside an iframe, announce that the game
       is ready.

       This does not expose any secret API key.
    */

    if (window.parent !== window) {

        sendToChastify({

            type: "chastify:ext:ready"

        });

    }
}


initializeGame();
