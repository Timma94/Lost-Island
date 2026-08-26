/* =========================================================
   LOST ISLAND
   Chastify + Cloudflare Worker Integration
   ========================================================= */

"use strict";


/* =========================================================
   CONFIGURATION
   ========================================================= */

const WORKER_URL =
    "https://lost-island-api.timvancleef.workers.dev";

const CHASTIFY_ORIGIN =
    "https://chastify.net";


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

    appId: null,
    lockId: null,

    sessionId: null,
    mainToken: null,

    lastResult: null
};


/* =========================================================
   SETTINGS
   ========================================================= */

const settings = {

    difficulty: "normal",

    rewardChance: 35,
    neutralChance: 40,
    punishmentChance: 25,

    rewardMin: 60,
    rewardMax: 180,

    punishmentMin: 120,
    punishmentMax: 360
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
        Math.random() *
        (max - min + 1)
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

    const hours =
        Math.floor(minutes / 60);

    const remainingMinutes =
        minutes % 60;

    if (hours < 24) {

        if (remainingMinutes === 0) {

            return `${hours} hour${hours === 1 ? "" : "s"}`;

        }

        return `${hours}h ${remainingMinutes}m`;

    }

    const days =
        Math.floor(hours / 24);

    const remainingHours =
        hours % 24;

    if (remainingHours === 0) {

        return `${days} day${days === 1 ? "" : "s"}`;

    }

    return `${days}d ${remainingHours}h`;
}


/* =========================================================
   DEBUG PANEL
   ========================================================= */

function showDebug(message) {

    let debug =
        document.getElementById("debug");

    if (!debug) {

        debug =
            document.createElement("div");

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

        const main =
            document.querySelector("main");

        if (main) {
            main.appendChild(debug);
        }
    }

    debug.textContent +=
        `\n${message}`;
}


/* =========================================================
   SAFE DEBUG OUTPUT
   ========================================================= */

function safeDebugObject(object) {

    try {

        return JSON.stringify(
            object,
            function(key, value) {

                if (
                    key === "mainToken" ||
                    key === "token" ||
                    key === "accessToken" ||
                    key === "developerKey" ||
                    key === "apiKey" ||
                    key === "authorization"
                ) {

                    return "[REDACTED]";
                }

                return value;

            },
            2
        );

    } catch {

        return String(object);

    }
}


/* =========================================================
   CONNECTION STATUS
   ========================================================= */

function setConnectionStatus(connected) {

    gameState.chastifyConnected =
        connected;

    const dot =
        document.getElementById(
            "connectionDot"
        );

    const text =
        document.getElementById(
            "connectionText"
        );

    if (!dot || !text) {
        return;
    }

    if (connected) {

        dot.classList.remove("offline");
        dot.classList.add("online");

        text.textContent =
            "Chastify: Connected";

    } else {

        dot.classList.remove("online");
        dot.classList.add("offline");

        text.textContent =
            "Chastify: Offline";
    }
}


/* =========================================================
   REQUEST ID
   ========================================================= */

function createRequestId() {

    try {

        if (
            window.crypto &&
            typeof window.crypto.randomUUID === "function"
        ) {

            return window.crypto.randomUUID();

        }

    } catch {}

    return (
        Date.now().toString() +
        "-" +
        Math.random().toString(36).substring(2)
    );
}


/* =========================================================
   SEND MESSAGE TO CHASTIFY
   ========================================================= */

function sendToChastify(message) {

    try {

        if (
            !window.parent ||
            window.parent === window
        ) {

            showDebug(
                "ERROR: Game is not running inside an iframe."
            );

            return false;
        }

        window.parent.postMessage(
            message,
            CHASTIFY_ORIGIN
        );

        showDebug(
            "SENT TO CHASTIFY:\n" +
            safeDebugObject(message)
        );

        return true;

    } catch (error) {

        showDebug(
            "ERROR sending message to Chastify:\n" +
            error.message
        );

        return false;
    }
}


/* =========================================================
   INITIAL CHASTIFY CONNECTION
   ========================================================= */

function connectToChastify() {

    showDebug(
        "Connecting to Chastify..."
    );

    sendToChastify({

        type:
            "chastify:ext:req",

        v:
            1,

        id:
            createRequestId(),

        action:
            "setup.init",

        payload:
            {}

    });
}


/* =========================================================
   REQUEST CONFIG
   ========================================================= */

function requestConfig() {

    showDebug(
        "Requesting current Chastify configuration..."
    );

    sendToChastify({

        type:
            "chastify:ext:req",

        v:
            1,

        id:
            createRequestId(),

        action:
            "setup.get_config",

        payload:
            {}

    });
}


/* =========================================================
   MESSAGE LISTENER
   ========================================================= */

window.addEventListener(
    "message",
    function(event) {

        if (
            event.origin !==
            CHASTIFY_ORIGIN
        ) {

            return;
        }

        const data =
            event.data;

        showDebug(
            "MESSAGE RECEIVED:\n" +
            "Origin: " +
            event.origin +
            "\nData:\n" +
            safeDebugObject(data)
        );

        if (!data) {
            return;
        }

        if (
            typeof data === "string"
        ) {

            try {

                handleChastifyMessage(
                    JSON.parse(data)
                );

            } catch {

                showDebug(
                    "Received string but it was not JSON."
                );
            }

            return;
        }

        handleChastifyMessage(data);

    }
);


/* =========================================================
   HANDLE CHASTIFY MESSAGE
   ========================================================= */

function handleChastifyMessage(data) {

    if (
        !data ||
        typeof data !== "object"
    ) {

        return;
    }


    /* -----------------------------------------------------
       STANDARD RESPONSE
       ----------------------------------------------------- */

    if (
        data.type ===
        "chastify:ext:resp"
    ) {

        showDebug(
            "Chastify response received."
        );

        if (
            data.ok &&
            data.data
        ) {

            extractChastifyInformation(
                data.data
            );

            setConnectionStatus(true);

            showDebug(
                "Chastify data:\n" +
                safeDebugObject(data.data)
            );

        } else {

            showDebug(
                "Chastify returned an unsuccessful response:\n" +
                safeDebugObject(data)
            );
        }

        return;
    }


    /* -----------------------------------------------------
       OTHER POSSIBLE EVENT TYPES
       ----------------------------------------------------- */

    const messageType =
        data.type ||
        data.event ||
        data.action ||
        data.messageType;


    if (!messageType) {
        return;
    }


    if (
        messageType ===
        "chastify:session:created"
    ) {

        setConnectionStatus(true);

        extractChastifyInformation(data);

        return;
    }


    if (
        messageType ===
        "chastify:session:updated"
    ) {

        setConnectionStatus(true);

        extractChastifyInformation(data);

        return;
    }


    if (
        messageType ===
        "chastify:ready" ||
        messageType ===
        "ready" ||
        messageType ===
        "connected"
    ) {

        setConnectionStatus(true);

        return;
    }
}


/* =========================================================
   EXTRACT CHASTIFY INFORMATION
   ========================================================= */

function extractChastifyInformation(data) {

    if (
        !data ||
        typeof data !== "object"
    ) {

        return;
    }


    /* -----------------------------------------------------
       APP ID
       ----------------------------------------------------- */

    if (data.appId) {

        gameState.appId =
            data.appId;
    }


    /* -----------------------------------------------------
       LOCK ID
       ----------------------------------------------------- */

    if (data.lockId) {

        gameState.lockId =
            data.lockId;
    }


    /* -----------------------------------------------------
       SESSION ID
       ----------------------------------------------------- */

    const possibleSessionIds = [

        data.sessionId,
        data.session_id,

        data.session?.id,
        data.session?.sessionId,

        data.data?.sessionId,
        data.data?.session_id,

        data.data?.session?.id,
        data.data?.session?.sessionId

    ];


    for (
        const value
        of possibleSessionIds
    ) {

        if (
            typeof value === "string" &&
            value.length > 0
        ) {

            gameState.sessionId =
                value;

            break;
        }
    }


    /* -----------------------------------------------------
       MAIN TOKEN
       ----------------------------------------------------- */

    const possibleTokens = [

        data.mainToken,
        data.main_token,

        data.session?.mainToken,
        data.session?.main_token,

        data.token,
        data.accessToken,

        data.data?.mainToken,
        data.data?.main_token,

        data.data?.session?.mainToken,
        data.data?.session?.main_token,

        data.data?.token,
        data.data?.accessToken

    ];


    for (
        const value
        of possibleTokens
    ) {

        if (
            typeof value === "string" &&
            value.length > 0
        ) {

            gameState.mainToken =
                value;

            break;
        }
    }


    /* -----------------------------------------------------
       DEBUG STATUS
       ----------------------------------------------------- */

    showDebug(
        "Chastify connection data:\n" +
        "appId: " +
        (
            gameState.appId ||
            "NOT FOUND"
        ) +
        "\n" +
        "lockId: " +
        (
            gameState.lockId ||
            "NOT FOUND"
        ) +
        "\n" +
        "sessionId: " +
        (
            gameState.sessionId ||
            "NOT FOUND"
        ) +
        "\n" +
        "mainToken: " +
        (
            gameState.mainToken
                ? "[AVAILABLE]"
                : "NOT FOUND"
        )
    );
}


/* =========================================================
   WORKER REQUEST
   ========================================================= */

async function sendTimeChangeToWorker(
    minutes,
    reason
) {

    minutes =
        Math.round(minutes);


    if (!minutes) {

        showDebug(
            "No time change requested."
        );

        return false;
    }


    /* -----------------------------------------------------
       CURRENT STATUS
       ----------------------------------------------------- */

    showDebug(
        "Preparing Worker request..."
    );

    showDebug(
        "Session ID available: " +
        Boolean(gameState.sessionId)
    );

    showDebug(
        "Main token available: " +
        Boolean(gameState.mainToken)
    );


    /* -----------------------------------------------------
       CREDENTIAL CHECK
       ----------------------------------------------------- */

    if (!gameState.sessionId) {

        showDebug(
            "STOPPED: Chastify did not provide a sessionId."
        );

        return false;
    }


    if (!gameState.mainToken) {

        showDebug(
            "STOPPED: Chastify did not provide a mainToken."
        );

        return false;
    }


    const seconds =
        minutes * 60;


    showDebug(
        "SENDING TIME CHANGE TO WORKER:\n" +
        "minutes: " +
        minutes +
        "\n" +
        "seconds: " +
        seconds +
        "\n" +
        "reason: " +
        (
            reason ||
            "Lost Island"
        )
    );


    /* -----------------------------------------------------
       WORKER CALL
       ----------------------------------------------------- */

    try {

        const response =
            await fetch(
                WORKER_URL,
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            sessionId:
                                gameState.sessionId,

                            mainToken:
                                gameState.mainToken,

                            seconds:
                                seconds,

                            reason:
                                reason ||
                                "Lost Island"

                        })

                }
            );


        const responseText =
            await response.text();


        let responseData;

        try {

            responseData =
                JSON.parse(
                    responseText
                );

        } catch {

            responseData =
                responseText;
        }


        showDebug(
            "WORKER RESPONSE:\n" +
            "HTTP " +
            response.status +
            "\n" +
            safeDebugObject(
                responseData
            )
        );


        if (!response.ok) {

            showDebug(
                "WORKER REQUEST FAILED."
            );

            return false;
        }


        if (
            responseData &&
            responseData.ok === true
        ) {

            gameState.totalTimeChange +=
                minutes;

            showDebug(
                "WORKER ACCEPTED TIME CHANGE."
            );

            return true;
        }


        showDebug(
            "WORKER RESPONSE DID NOT CONFIRM SUCCESS."
        );

        return false;

    } catch (error) {

        showDebug(
            "WORKER REQUEST ERROR:\n" +
            error.message
        );

        return false;
    }
}


/* =========================================================
   CHANGE CHASTIFY TIME
   ========================================================= */

async function changeChastifyTime(
    minutes,
    reason
) {

    minutes =
        Math.round(minutes);


    if (!minutes) {
        return false;
    }


    const action =
        minutes > 0
            ? "ADD"
            : "REMOVE";


    const amount =
        Math.abs(minutes);


    showDebug(
        `TIME ACTION: ${action} ${amount} minutes`
    );


    return await sendTimeChangeToWorker(
        minutes,
        reason
    );
}


/* =========================================================
   OUTCOME
   ========================================================= */

function determineOutcome() {

    const rewardChance =
        clamp(
            Number(settings.rewardChance),
            0,
            100
        );

    const neutralChance =
        clamp(
            Number(settings.neutralChance),
            0,
            100
        );

    const punishmentChance =
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
        Math.random() *
        total;


    if (
        roll <
        rewardChance
    ) {

        return "reward";
    }


    if (
        roll <
        rewardChance +
        neutralChance
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

            outcome:
                "reward",

            water:
                2
        },

        {
            text:
                "You search for a long time but find nothing useful.",

            outcome:
                "neutral"
        },

        {
            text:
                "You push deeper into the jungle looking for water. " +
                "A hidden sinkhole gives way beneath you.",

            outcome:
                "punishment",

            health:
                -10
        }

    ],


    explore: [

        {
            text:
                "You explore the coastline and discover a sheltered " +
                "area that could make a useful secondary camp.",

            outcome:
                "reward",

            materials:
                1
        },

        {
            text:
                "The island gives you nothing but dense vegetation " +
                "and another exhausting walk.",

            outcome:
                "neutral"
        },

        {
            text:
                "You wander too far from camp and lose your bearings. " +
                "Finding your way back takes hours.",

            outcome:
                "punishment",

            health:
                -5
        }

    ],


    materials: [

        {
            text:
                "You find several pieces of dry wood and useful branches.",

            outcome:
                "reward",

            materials:
                2
        },

        {
            text:
                "Most of what you collect is damp or rotten.",

            outcome:
                "neutral",

            materials:
                1
        },

        {
            text:
                "A branch snaps unexpectedly and injures your hand.",

            outcome:
                "punishment",

            health:
                -8
        }

    ],


    wreck: [

        {
            text:
                "You carefully search the wreckage and recover useful supplies.",

            outcome:
                "reward",

            materials:
                2,

            food:
                1
        },

        {
            text:
                "The wreck is unstable. You find nothing worth taking.",

            outcome:
                "neutral"
        },

        {
            text:
                "Part of the wreck collapses while you are searching it. " +
                "You barely escape.",

            outcome:
                "punishment",

            health:
                -15
        }

    ],


    camp: [

        {
            text:
                "You improve the shelter and create a more secure sleeping area.",

            outcome:
                "reward",

            health:
                5,

            materials:
                -1
        },

        {
            text:
                "You spend the time repairing the camp. " +
                "It is slightly better than before.",

            outcome:
                "neutral"
        },

        {
            text:
                "Your construction fails and part of the shelter collapses.",

            outcome:
                "punishment",

            materials:
                -1,

            health:
                -5
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


    if (
        rngOutcome !==
        baseEvent.outcome
    ) {

        const matching =
            actionEvents.filter(
                event =>
                    event.outcome ===
                    rngOutcome
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
}


/* =========================================================
   APPLY EVENT
   ========================================================= */

async function applyEvent(
    action,
    event
) {

    const outcome =
        event.outcome ||
        "neutral";


    /* -----------------------------------------------------
       RESOURCES
       ----------------------------------------------------- */

    if (event.health) {

        gameState.health =
            clamp(
                gameState.health +
                event.health,
                0,
                100
            );
    }


    if (event.water) {

        gameState.water =
            Math.max(
                0,
                gameState.water +
                event.water
            );
    }


    if (event.food) {

        gameState.food =
            Math.max(
                0,
                gameState.food +
                event.food
            );
    }


    if (event.materials) {

        gameState.materials =
            Math.max(
                0,
                gameState.materials +
                event.materials
            );
    }


    /* -----------------------------------------------------
       TIME
       ----------------------------------------------------- */

    let timeChange = 0;


    if (
        outcome ===
        "reward"
    ) {

        timeChange =
            -randomNumber(
                settings.rewardMin,
                settings.rewardMax
            );

    } else if (
        outcome ===
        "punishment"
    ) {

        timeChange =
            randomNumber(
                settings.punishmentMin,
                settings.punishmentMax
            );
    }


    /* -----------------------------------------------------
       SEND TO CHASTIFY
       ----------------------------------------------------- */

    let chastifySuccess =
        true;


    if (timeChange !== 0) {

        chastifySuccess =
            await changeChastifyTime(
                timeChange,
                `${action} - ${outcome}`
            );
    }


    /* -----------------------------------------------------
       RESULT
       ----------------------------------------------------- */

    let title = "";
    let icon = "";


    if (
        outcome ===
        "reward"
    ) {

        title =
            "Good fortune";

        icon =
            "🍀";

    } else if (
        outcome ===
        "punishment"
    ) {

        title =
            "Something went wrong";

        icon =
            "⚠️";

    } else {

        title =
            "Nothing remarkable";

        icon =
            "➖";
    }


    let timeText = "";


    if (
        timeChange < 0
    ) {

        timeText =
            `<p><strong>🔓 Time reduction:</strong> ` +
            `${formatMinutes(
                Math.abs(timeChange)
            )}</p>`;

    } else if (
        timeChange > 0
    ) {

        timeText =
            `<p><strong>🔒 Lock time added:</strong> ` +
            `${formatMinutes(
                timeChange
            )}</p>`;

    }


    let syncText = "";


    if (
        timeChange !== 0 &&
        !chastifySuccess
    ) {

        syncText =
            `<p style="color:#ff6b6b;">` +
            `⚠️ Time was calculated by the game, ` +
            `but Chastify did not confirm the change.` +
            `</p>`;
    }


    const result =
        document.getElementById(
            "result"
        );


    if (result) {

        result.className =
            `result ${outcome}`;

        result.classList.remove(
            "hidden"
        );

        result.innerHTML = `

            <h3>
                ${icon} ${title}
            </h3>

            <p>
                ${event.text}
            </p>

            ${timeText}

            ${syncText}

            <p>
                <strong>Actions used:</strong>
                ${gameState.totalActions}
            </p>

        `;
    }


    gameState.lastResult = {

        action:
            action,

        outcome:
            outcome,

        timeChange:
            timeChange,

        chastifySuccess:
            chastifySuccess

    };


    gameState.day++;


    updateDisplay();
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

    const ids = [

        "difficulty",
        "rewardChance",
        "neutralChance",
        "punishmentChance",
        "rewardMin",
        "rewardMax",
        "punishmentMin",
        "punishmentMax"

    ];


    ids.forEach(
        id => {

            const element =
                document.getElementById(id);

            if (!element) {
                return;
            }

            const settingName =
                id;

            if (
                settings[
                    settingName
                ] !== undefined
            ) {

                element.value =
                    settings[
                        settingName
                    ];
            }
        }
    );
}


/* =========================================================
   SAVE SETTINGS
   ========================================================= */

function saveSettings() {

    const ids = [

        "difficulty",
        "rewardChance",
        "neutralChance",
        "punishmentChance",
        "rewardMin",
        "rewardMax",
        "punishmentMin",
        "punishmentMax"

    ];


    ids.forEach(
        id => {

            const element =
                document.getElementById(id);

            if (!element) {
                return;
            }

            if (id === "difficulty") {

                settings[id] =
                    element.value;

            } else {

                settings[id] =
                    Number(
                        element.value
                    );
            }
        }
    );


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


    sendSetupConfig();


    const modal =
        document.getElementById(
            "settingsModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );
    }
}


/* =========================================================
   SEND SETUP CONFIG
   ========================================================= */

function sendSetupConfig() {

    sendToChastify({

        type:
            "chastify:ext:req",

        v:
            1,

        id:
            createRequestId(),

        action:
            "setup.config",

        payload: {

            difficulty:
                settings.difficulty,

            rewardChance:
                settings.rewardChance,

            neutralChance:
                settings.neutralChance,

            punishmentChance:
                settings.punishmentChance,

            rewardMin:
                settings.rewardMin,

            rewardMax:
                settings.rewardMax,

            punishmentMin:
                settings.punishmentMin,

            punishmentMax:
                settings.punishmentMax
        }

    });
}


/* =========================================================
   SETTINGS EVENTS
   ========================================================= */

function initializeSettings() {

    const settingsBtn =
        document.getElementById(
            "settingsBtn"
        );

    const saveBtn =
        document.getElementById(
            "saveSettings"
        );

    const closeBtn =
        document.getElementById(
            "closeSettings"
        );

    const modal =
        document.getElementById(
            "settingsModal"
        );


    if (
        settingsBtn &&
        modal
    ) {

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


    if (
        closeBtn &&
        modal
    ) {

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

                    performAction(
                        action
                    );
                }
            );
        }
    );
}


/* =========================================================
   INITIALIZE
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


    showDebug(
        "Cloudflare Worker:\n" +
        WORKER_URL
    );


    if (
        window.parent !== window
    ) {

        connectToChastify();


        setTimeout(
            requestConfig,
            1000
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
