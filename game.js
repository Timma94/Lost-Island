/* =========================================================
   LOST ISLAND
   Chastify Extension Integration + Game Engine
   ========================================================= */

"use strict";

/* =========================================================
   GAME STATE
   ========================================================= */

const gameState = {
    health: 100,
    water: 2,
    food: 2,
    materials: 1,
    day: 1,

    totalActions: 0,
    totalTimeChange: 0,

    chastifyConnected: false,
    configReceived: false,

    lastResult: null
};


/* =========================================================
   DEFAULT SETTINGS
   ========================================================= */

const settings = {

    difficulty: "normal",

    rewardChance: 35,
    neutralChance: 40,
    punishmentChance: 25,

    rewardMin: 30,
    rewardMax: 60,

    punishmentMin: 60,
    punishmentMax: 300
};


/* =========================================================
   DIFFICULTY
   ========================================================= */

const difficultySettings = {

    easy: {
        name: "Easy",
        rewardMin: 30,
        rewardMax: 60,
        punishmentMin: 60,
        punishmentMax: 180
    },

    normal: {
        name: "Normal",
        rewardMin: 60,
        rewardMax: 180,
        punishmentMin: 120,
        punishmentMax: 360
    },

    hard: {
        name: "Hard",
        rewardMin: 120,
        rewardMax: 360,
        punishmentMin: 720,
        punishmentMax: 1440
    },

    brutal: {
        name: "Brutal",
        rewardMin: 720,
        rewardMax: 1440 * 5,
        punishmentMin: 1440,
        punishmentMax: 1440 * 5
    }
};


/* =========================================================
   UTILITY
   ========================================================= */

function randomNumber(min, max) {

    min = Number(min);
    max = Number(max);

    if (max < min) {
        [min, max] = [max, min];
    }

    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;
}


function clamp(value, min, max) {

    return Math.max(
        min,
        Math.min(max, value)
    );
}


function formatMinutes(minutes) {

    minutes = Math.round(minutes);

    if (minutes < 60) {
        return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours < 24) {

        if (remainingMinutes === 0) {
            return `${hours} hour${hours === 1 ? "" : "s"}`;
        }

        return `${hours}h ${remainingMinutes}m`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (remainingHours === 0) {
        return `${days} day${days === 1 ? "" : "s"}`;
    }

    return `${days}d ${remainingHours}h`;
}


/* =========================================================
   DEBUG PANEL
   ========================================================= */

function showDebug(message) {

    let debug = document.getElementById("debug");

    if (!debug) {

        debug = document.createElement("div");

        debug.id = "debug";

        debug.style.marginTop = "20px";
        debug.style.padding = "12px";
        debug.style.background = "#111";
        debug.style.border = "1px solid #444";
        debug.style.borderRadius = "8px";
        debug.style.fontSize = "12px";
        debug.style.lineHeight = "1.5";
        debug.style.whiteSpace = "pre-wrap";
        debug.style.color = "#aaa";

        const main = document.querySelector("main");

        if (main) {
            main.appendChild(debug);
        }
    }

    debug.textContent += `\n${message}`;
}


/* =========================================================
   CONNECTION STATUS
   ========================================================= */

function setConnectionStatus(connected) {

    gameState.chastifyConnected = connected;

    const dot = document.getElementById("connectionDot");
    const text = document.getElementById("connectionText");

    if (!dot || !text) {
        return;
    }

    if (connected) {

        dot.classList.remove("offline");
        dot.classList.add("online");

        text.textContent = "Chastify: Connected";

    } else {

        dot.classList.remove("online");
        dot.classList.add("offline");

        text.textContent = "Chastify: Offline";
    }
}


/* =========================================================
   CHASTIFY MESSAGE HELPERS
   ========================================================= */

function sendToChastify(message) {

    try {

        if (!window.parent || window.parent === window) {

            showDebug("Not running inside an iframe.");

            return false;
        }

        window.parent.postMessage(
            message,
            "*"
        );

        showDebug(
            "SENT TO CHASTIFY:\n" +
            JSON.stringify(message, null, 2)
        );

        return true;

    } catch (error) {

        showDebug(
            "ERROR sending message:\n" +
            error.message
        );

        return false;
    }
}


/* =========================================================
   CHASTIFY SETUP HANDSHAKE
   ========================================================= */

function requestSetup() {

    showDebug("Requesting Chastify setup...");

    sendToChastify({

        type: "chastify:ext:setup:init"

    });
}


/* =========================================================
   SETUP CONFIG RESPONSE
   ========================================================= */

function sendSetupConfig() {

    const config = {

        difficulty: settings.difficulty,

        rewardChance: settings.rewardChance,
        neutralChance: settings.neutralChance,
        punishmentChance: settings.punishmentChance,

        rewardMin: settings.rewardMin,
        rewardMax: settings.rewardMax,

        punishmentMin: settings.punishmentMin,
        punishmentMax: settings.punishmentMax
    };

    sendToChastify({

        type: "chastify:ext:setup:config",

        config: config

    });

    gameState.configReceived = true;

    showDebug("Setup configuration sent.");
}


/* =========================================================
   REQUEST CURRENT CONFIG
   ========================================================= */

function requestConfig() {

    showDebug("Requesting current Chastify configuration...");

    sendToChastify({

        type: "chastify:ext:setup:get_config"

    });
}


/* =========================================================
   CHASTIFY MESSAGE RECEIVER
   ========================================================= */

window.addEventListener("message", function(event) {

    /*
     * IMPORTANT:
     *
     * We intentionally don't restrict event.origin yet.
     * During testing we want to see exactly what Chastify sends.
     */

    showDebug(
        "MESSAGE RECEIVED:\n" +
        "Origin: " + event.origin +
        "\nData:\n" +
        JSON.stringify(event.data, null, 2)
    );

    const data = event.data;

    if (!data) {
        return;
    }

    /*
     * Some systems send strings instead of objects.
     */

    if (typeof data === "string") {

        try {
            const parsed = JSON.parse(data);
            handleChastifyMessage(parsed);
        } catch (error) {

            showDebug(
                "Received string message but it was not JSON."
            );
        }

        return;
    }

    handleChastifyMessage(data);

});


/* =========================================================
   HANDLE CHASTIFY MESSAGE
   ========================================================= */

function handleChastifyMessage(data) {

    if (!data || typeof data !== "object") {
        return;
    }

    const messageType =
        data.type ||
        data.event ||
        data.action ||
        data.messageType;

    if (!messageType) {

        showDebug(
            "Message received but no message type detected."
        );

        return;
    }


    /* ---------------------------------------------
       SETUP INIT
       --------------------------------------------- */

    if (
        messageType ===
        "chastify:ext:setup:init"
    ) {

        showDebug(
            "Chastify requested setup configuration."
        );

        setConnectionStatus(true);

        sendSetupConfig();

        return;
    }


    /* ---------------------------------------------
       GET CONFIG
       --------------------------------------------- */

    if (
        messageType ===
        "chastify:ext:setup:get_config"
    ) {

        showDebug(
            "Chastify requested current configuration."
        );

        sendSetupConfig();

        return;
    }


    /* ---------------------------------------------
       CONFIG RESPONSE
       --------------------------------------------- */

    if (
        messageType ===
        "chastify:ext:setup:config"
    ) {

        gameState.configReceived = true;

        setConnectionStatus(true);

        if (data.config) {
            applyRemoteConfig(data.config);
        }

        return;
    }


    /* ---------------------------------------------
       SESSION CREATED
       --------------------------------------------- */

    if (
        messageType ===
        "chastify:session:created"
    ) {

        setConnectionStatus(true);

        showDebug(
            "Chastify session created."
        );

        return;
    }


    /* ---------------------------------------------
       SESSION UPDATED
       --------------------------------------------- */

    if (
        messageType ===
        "chastify:session:updated"
    ) {

        setConnectionStatus(true);

        showDebug(
            "Chastify session updated."
        );

        return;
    }


    /* ---------------------------------------------
       GENERIC READY / CONNECTED EVENTS
       --------------------------------------------- */

    if (
        messageType === "ready" ||
        messageType === "connected" ||
        messageType === "chastify:ready"
    ) {

        setConnectionStatus(true);

        showDebug(
            "Chastify reports connection ready."
        );

        return;
    }
}


/* =========================================================
   APPLY REMOTE CONFIG
   ========================================================= */

function applyRemoteConfig(config) {

    if (!config || typeof config !== "object") {
        return;
    }

    if (config.difficulty) {

        settings.difficulty =
            config.difficulty;
    }

    if (config.rewardChance !== undefined) {

        settings.rewardChance =
            Number(config.rewardChance);
    }

    if (config.neutralChance !== undefined) {

        settings.neutralChance =
            Number(config.neutralChance);
    }

    if (config.punishmentChance !== undefined) {

        settings.punishmentChance =
            Number(config.punishmentChance);
    }

    if (config.rewardMin !== undefined) {
        settings.rewardMin =
            Number(config.rewardMin);
    }

    if (config.rewardMax !== undefined) {
        settings.rewardMax =
            Number(config.rewardMax);
    }

    if (config.punishmentMin !== undefined) {
        settings.punishmentMin =
            Number(config.punishmentMin);
    }

    if (config.punishmentMax !== undefined) {
        settings.punishmentMax =
            Number(config.punishmentMax);
    }

    updateSettingsUI();

    showDebug(
        "Remote configuration applied."
    );
}


/* =========================================================
   TIME CHANGE
   ========================================================= */

/*
 * IMPORTANT:
 *
 * This function is intentionally isolated.
 *
 * Once we confirm the exact Chastify runtime API/message
 * format, THIS is the only function we need to change
 * to make rewards/punishments alter the real lock time.
 */

function changeChastifyTime(minutes, reason) {

    minutes = Math.round(minutes);

    if (!minutes) {
        return;
    }

    gameState.totalTimeChange += minutes;

    const action =
        minutes > 0
            ? "add"
            : "remove";

    const amount =
        Math.abs(minutes);

    showDebug(
        `TIME ACTION: ${action} ${amount} minutes`
    );

    /*
     * Placeholder runtime message.
     *
     * We DO NOT assume yet that this is the final
     * Chastify API contract.
     *
     * We will replace this once we see the actual
     * runtime/session message structure from Chastify.
     */

    sendToChastify({

        type: "chastify:ext:time",

        action: action,

        minutes: amount,

        reason: reason || "Lost Island event"
    });
}


/* =========================================================
   RANDOM OUTCOME
   ========================================================= */

function determineOutcome() {

    let rewardChance =
        clamp(
            Number(settings.rewardChance),
            0,
            100
        );

    let neutralChance =
        clamp(
            Number(settings.neutralChance),
            0,
            100
        );

    let punishmentChance =
        clamp(
            Number(settings.punishmentChance),
            0,
            100
        );

    const total =
        rewardChance +
        neutralChance +
        punishmentChance;

    if (total <= 0) {
        return "neutral";
    }

    const roll =
        Math.random() * total;

    if (roll < rewardChance) {
        return "reward";
    }

    if (
        roll <
        rewardChance + neutralChance
    ) {
        return "neutral";
    }

    return "punishment";
}


/* =========================================================
   EVENT DATABASE
   ========================================================= */

const events = {

    water: [

        {
            text:
                "You follow a narrow trail between the trees. " +
                "After some searching you discover a small freshwater pool.",

            outcome: "reward",

            water: 2,

            time: -30
        },

        {
            text:
                "You search for a long time but find nothing useful.",

            outcome: "neutral",

            time: 0
        },

        {
            text:
                "You push deeper into the jungle looking for water. " +
                "A hidden sinkhole gives way beneath you.",

            outcome: "punishment",

            health: -10
        }
    ],


    explore: [

        {
            text:
                "You explore the coastline and discover a sheltered " +
                "area that could make a useful secondary camp.",

            outcome: "reward",

            materials: 1
        },

        {
            text:
                "The island gives you nothing but dense vegetation " +
                "and another exhausting walk.",

            outcome: "neutral"
        },

        {
            text:
                "You wander too far from camp and lose your bearings. " +
                "Finding your way back takes hours.",

            outcome: "punishment",

            health: -5
        }
    ],


    materials: [

        {
            text:
                "You find several pieces of dry wood and useful branches.",

            outcome: "reward",

            materials: 2
        },

        {
            text:
                "Most of what you collect is damp or rotten.",

            outcome: "neutral",

            materials: 1
        },

        {
            text:
                "A branch snaps unexpectedly and injures your hand.",

            outcome: "punishment",

            health: -8
        }
    ],


    wreck: [

        {
            text:
                "You carefully search the wreckage and recover useful supplies.",

            outcome: "reward",

            materials: 2,
            food: 1
        },

        {
            text:
                "The wreck is unstable. You find nothing worth taking.",

            outcome: "neutral"
        },

        {
            text:
                "Part of the wreck collapses while you are searching it. " +
                "You barely escape.",

            outcome: "punishment",

            health: -15
        }
    ],


    camp: [

        {
            text:
                "You improve the shelter and create a more secure sleeping area.",

            outcome: "reward",

            health: 5,
            materials: -1
        },

        {
            text:
                "You spend the time repairing the camp. " +
                "It is slightly better than before.",

            outcome: "neutral"
        },

        {
            text:
                "Your construction fails and part of the shelter collapses.",

            outcome: "punishment",

            materials: -1,
            health: -5
        }
    ]
};


/* =========================================================
   PERFORM ACTION
   ========================================================= */

function performAction(action) {

    if (!events[action]) {
        return;
    }

    gameState.totalActions++;

    const actionEvents =
        events[action];

    const baseEvent =
        actionEvents[
            randomNumber(
                0,
                actionEvents.length - 1
            )
        ];

    const rngOutcome =
        determineOutcome();

    let selectedEvent =
        baseEvent;

    /*
     * RNG can override the base result.
     *
     * This means the same action does not always
     * produce the same result.
     */

    if (rngOutcome !== baseEvent.outcome) {

        const matching =
            actionEvents.filter(
                event =>
                    event.outcome === rngOutcome
            );

        if (matching.length > 0) {

            selectedEvent =
                matching[
                    randomNumber(
                        0,
                        matching.length - 1
                    )
                ];
        }
    }

    applyEvent(
        action,
        selectedEvent
    );

    updateDisplay();
}


/* =========================================================
   APPLY EVENT
   ========================================================= */

function applyEvent(action, event) {

    const outcome =
        event.outcome || "neutral";


    /* ---------------------------------------------
       RESOURCE CHANGES
       --------------------------------------------- */

    if (event.health) {

        gameState.health =
            clamp(
                gameState.health + event.health,
                0,
                100
            );
    }

    if (event.water) {

        gameState.water =
            Math.max(
                0,
                gameState.water + event.water
            );
    }

    if (event.food) {

        gameState.food =
            Math.max(
                0,
                gameState.food + event.food
            );
    }

    if (event.materials) {

        gameState.materials =
            Math.max(
                0,
                gameState.materials + event.materials
            );
    }


    /* ---------------------------------------------
       TIME CONSEQUENCES
       --------------------------------------------- */

    let timeChange = 0;

    if (outcome === "reward") {

        timeChange =
            -randomNumber(
                settings.rewardMin,
                settings.rewardMax
            );
    }

    else if (outcome === "punishment") {

        timeChange =
            randomNumber(
                settings.punishmentMin,
                settings.punishmentMax
            );
    }


    /*
     * Event-specific time can override the random
     * value if explicitly supplied.
     */

    if (event.time !== undefined) {

        if (event.time < 0) {

            timeChange =
                -randomNumber(
                    settings.rewardMin,
                    settings.rewardMax
                );

        } else if (event.time > 0) {

            timeChange =
                randomNumber(
                    settings.punishmentMin,
                    settings.punishmentMax
                );

        } else {

            timeChange = 0;
        }
    }


    if (timeChange !== 0) {

        changeChastifyTime(
            timeChange,
            `${action} - ${outcome}`
        );
    }


    /* ---------------------------------------------
       DISPLAY RESULT
       --------------------------------------------- */

    let title = "";
    let icon = "";

    if (outcome === "reward") {

        title = "Good fortune";
        icon = "🍀";
    }

    else if (outcome === "punishment") {

        title = "Something went wrong";
        icon = "⚠️";
    }

    else {

        title = "Nothing remarkable";
        icon = "➖";
    }


    let timeText = "";

    if (timeChange < 0) {

        timeText =
            `<p><strong>🔓 Time reduction:</strong> ` +
            `${formatMinutes(Math.abs(timeChange))}</p>`;

    }

    else if (timeChange > 0) {

        timeText =
            `<p><strong>🔒 Lock time added:</strong> ` +
            `${formatMinutes(timeChange)}</p>`;

    }


    const result =
        document.getElementById("result");

    if (result) {

        result.className =
            `result ${outcome}`;

        result.classList.remove("hidden");

        result.innerHTML = `

            <h3>
                ${icon} ${title}
            </h3>

            <p>
                ${event.text}
            </p>

            ${timeText}

            <p>
                <strong>Actions used:</strong>
                ${gameState.totalActions}
            </p>

        `;
    }


    gameState.lastResult = {
        action: action,
        outcome: outcome,
        timeChange: timeChange
    };


    /*
     * Move to next day after each action.
     *
     * We can later change this so multiple actions
     * belong to one day.
     */

    gameState.day++;

}


/* =========================================================
   DISPLAY
   ========================================================= */

function updateDisplay() {

    const health =
        document.getElementById("health");

    const water =
        document.getElementById("water");

    const food =
        document.getElementById("food");

    const materials =
        document.getElementById("materials");

    const day =
        document.getElementById("day");


    if (health) {
        health.textContent =
            gameState.health;
    }

    if (water) {
        water.textContent =
            gameState.water;
    }

    if (food) {
        food.textContent =
            gameState.food;
    }

    if (materials) {
        materials.textContent =
            gameState.materials;
    }

    if (day) {
        day.textContent =
            gameState.day;
    }
}


/* =========================================================
   SETTINGS UI
   ========================================================= */

function updateSettingsUI() {

    const difficulty =
        document.getElementById("difficulty");

    const rewardChance =
        document.getElementById("rewardChance");

    const neutralChance =
        document.getElementById("neutralChance");

    const punishmentChance =
        document.getElementById("punishmentChance");

    const rewardMin =
        document.getElementById("rewardMin");

    const rewardMax =
        document.getElementById("rewardMax");

    const punishmentMin =
        document.getElementById("punishmentMin");

    const punishmentMax =
        document.getElementById("punishmentMax");


    if (difficulty) {
        difficulty.value =
            settings.difficulty;
    }

    if (rewardChance) {
        rewardChance.value =
            settings.rewardChance;
    }

    if (neutralChance) {
        neutralChance.value =
            settings.neutralChance;
    }

    if (punishmentChance) {
        punishmentChance.value =
            settings.punishmentChance;
    }

    if (rewardMin) {
        rewardMin.value =
            settings.rewardMin;
    }

    if (rewardMax) {
        rewardMax.value =
            settings.rewardMax;
    }

    if (punishmentMin) {
        punishmentMin.value =
            settings.punishmentMin;
    }

    if (punishmentMax) {
        punishmentMax.value =
            settings.punishmentMax;
    }
}


/* =========================================================
   SAVE SETTINGS
   ========================================================= */

function saveSettings() {

    const difficulty =
        document.getElementById("difficulty");

    const rewardChance =
        document.getElementById("rewardChance");

    const neutralChance =
        document.getElementById("neutralChance");

    const punishmentChance =
        document.getElementById("punishmentChance");

    const rewardMin =
        document.getElementById("rewardMin");

    const rewardMax =
        document.getElementById("rewardMax");

    const punishmentMin =
        document.getElementById("punishmentMin");

    const punishmentMax =
        document.getElementById("punishmentMax");


    settings.difficulty =
        difficulty.value;

    settings.rewardChance =
        Number(rewardChance.value);

    settings.neutralChance =
        Number(neutralChance.value);

    settings.punishmentChance =
        Number(punishmentChance.value);

    settings.rewardMin =
        Number(rewardMin.value);

    settings.rewardMax =
        Number(rewardMax.value);

    settings.punishmentMin =
        Number(punishmentMin.value);

    settings.punishmentMax =
        Number(punishmentMax.value);


    /*
     * Validate percentages.
     */

    const total =
        settings.rewardChance +
        settings.neutralChance +
        settings.punishmentChance;

    if (total !== 100) {

        alert(
            `RNG percentages must total 100%.\n\n` +
            `Current total: ${total}%`
        );

        return;
    }


    /*
     * Send new configuration to Chastify.
     */

    sendSetupConfig();


    /*
     * Close settings window.
     */

    const modal =
        document.getElementById("settingsModal");

    if (modal) {
        modal.classList.add("hidden");
    }
}


/* =========================================================
   SETTINGS EVENTS
   ========================================================= */

function initializeSettings() {

    const settingsBtn =
        document.getElementById("settingsBtn");

    const saveBtn =
        document.getElementById("saveSettings");

    const closeBtn =
        document.getElementById("closeSettings");

    const modal =
        document.getElementById("settingsModal");


    if (settingsBtn) {

        settingsBtn.addEventListener(
            "click",
            function() {

                updateSettingsUI();

                modal.classList.remove(
                    "hidden"
                );
            }
        );
    }


    if (saveBtn) {

        saveBtn.addEventListener(
            "click",
            saveSettings
        );
    }


    if (closeBtn) {

        closeBtn.addEventListener(
            "click",
            function() {

                modal.classList.add(
                    "hidden"
                );
            }
        );
    }
}


/* =========================================================
   ACTION BUTTONS
   ========================================================= */

function initializeActions() {

    const buttons =
        document.querySelectorAll(
            ".action"
        );

    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                function() {

                    const action =
                        this.dataset.action;

                    performAction(action);
                }
            );
        }
    );
}


/* =========================================================
   INITIALIZE GAME
   ========================================================= */

function initializeGame() {

    updateDisplay();

    initializeSettings();

    initializeActions();

    setConnectionStatus(false);

    showDebug(
        "Lost Island initialized."
    );

    showDebug(
        "Running inside iframe: " +
        (window.parent !== window)
    );


    /*
     * If we're inside Chastify, start the handshake.
     */

    if (window.parent !== window) {

        requestSetup();

        /*
         * Also ask for the current configuration.
         */

        setTimeout(
            requestConfig,
            500
        );

    } else {

        showDebug(
            "Opened directly. Chastify unavailable."
        );
    }
}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeGame
);
