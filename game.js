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


const DEFAULT_CHASTIFY_ORIGIN =
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

    bridgeNonce: null,
    parentOrigin: null,

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

        debug.style.marginTop =
            "20px";

        debug.style.padding =
            "12px";

        debug.style.background =
            "#111";

        debug.style.border =
            "1px solid #444";

        debug.style.borderRadius =
            "8px";

        debug.style.fontSize =
            "12px";

        debug.style.lineHeight =
            "1.5";

        debug.style.whiteSpace =
            "pre-wrap";

        debug.style.color =
            "#aaa";

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
   SAFE DEBUG JSON
   ========================================================= */

function safeDebugObject(object) {

    try {

        return JSON.stringify(
            object,
            function(key, value) {

                if (
                    key === "mainToken" ||
                    key === "main_token" ||
                    key === "token" ||
                    key === "accessToken" ||
                    key === "developerKey" ||
                    key === "apiKey" ||
                    key === "authorization" ||
                    key === "nonce"
                ) {

                    return "[REDACTED]";
                }

                return value;

            },
            2
        );

    } catch (error) {

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

        dot.classList.remove(
            "offline"
        );

        dot.classList.add(
            "online"
        );

        text.textContent =
            "Chastify: Connected";

    } else {

        dot.classList.remove(
            "online"
        );

        dot.classList.add(
            "offline"
        );

        text.textContent =
            "Chastify: Offline";

    }
}


/* =========================================================
   PARSE CHASTIFY IFRAME HASH
   ========================================================= */

function parseChastifyHash() {

    const hash =
        window.location.hash;


    if (
        !hash ||
        hash.length < 2
    ) {

        showDebug(
            "ERROR: No iframe hash found."
        );

        return null;

    }


    showDebug(
        "Chastify iframe hash detected."
    );


    let raw =
        hash.substring(1);


    /*
     * First attempt:
     *
     * #{"sessionId":"...","mainToken":"..."}
     */

    try {

        const decoded =
            decodeURIComponent(raw);


        if (
            decoded.startsWith("{")
        ) {

            const parsed =
                JSON.parse(decoded);

            return parsed;

        }

    } catch (error) {

        /*
         * Continue with other formats.
         */

    }


    /*
     * Second attempt:
     *
     * #payload=<encoded JSON>
     */

    try {

        const params =
            new URLSearchParams(raw);


        const possiblePayloads = [

            params.get("payload"),
            params.get("data"),
            params.get("state"),
            params.get("context")

        ];


        for (
            const payload
            of possiblePayloads
        ) {

            if (!payload) {

                continue;

            }


            try {

                const decoded =
                    decodeURIComponent(
                        payload
                    );


                const parsed =
                    JSON.parse(
                        decoded
                    );


                if (
                    parsed &&
                    typeof parsed ===
                    "object"
                ) {

                    return parsed;

                }

            } catch (error) {

                /*
                 * Try next candidate.
                 */

            }

        }

    } catch (error) {

        /*
         * Continue.
         */

    }


    /*
     * Third attempt:
     *
     * Base64 encoded JSON.
     */

    try {

        const decoded =
            decodeURIComponent(raw);


        let base64 =
            decoded;


        if (
            base64.startsWith(
                "payload="
            )
        ) {

            base64 =
                base64.substring(
                    8
                );

        }


        const binary =
            atob(base64);


        const bytes =
            Uint8Array.from(
                binary,
                char =>
                    char.charCodeAt(0)
            );


        const text =
            new TextDecoder().decode(
                bytes
            );


        const parsed =
            JSON.parse(text);


        if (
            parsed &&
            typeof parsed ===
            "object"
        ) {

            return parsed;

        }

    } catch (error) {

        /*
         * No usable base64 payload.
         */

    }


    showDebug(
        "ERROR: Unable to parse Chastify iframe hash."
    );


    return null;

}


/* =========================================================
   EXTRACT HASH INFORMATION
   ========================================================= */

function extractHashInformation(payload) {

    if (
        !payload ||
        typeof payload !==
        "object"
    ) {

        return false;

    }


    showDebug(
        "Parsed iframe hash payload:\n" +
        safeDebugObject(payload)
    );


    /*
     * App ID
     */

    const appIdCandidates = [

        payload.appId,

        payload.app_id,

        payload.app?.id,

        payload.applicationId

    ];


    for (
        const value
        of appIdCandidates
    ) {

        if (
            typeof value ===
            "string" &&
            value.length > 0
        ) {

            gameState.appId =
                value;

            break;

        }

    }


    /*
     * Lock ID
     */

    const lockIdCandidates = [

        payload.lockId,

        payload.lock_id,

        payload.lock?.id

    ];


    for (
        const value
        of lockIdCandidates
    ) {

        if (
            typeof value ===
            "string" &&
            value.length > 0
        ) {

            gameState.lockId =
                value;

            break;

        }

    }


    /*
     * Session ID
     */

    const sessionIdCandidates = [

        payload.sessionId,

        payload.session_id,

        payload.session?.id,

        payload.session?.sessionId

    ];


    for (
        const value
        of sessionIdCandidates
    ) {

        if (
            typeof value ===
            "string" &&
            value.length > 0
        ) {

            gameState.sessionId =
                value;

            break;

        }

    }


    /*
     * MAIN TOKEN
     *
     * This is expected to be supplied by
     * Chastify in the iframe launch hash.
     */

    const mainTokenCandidates = [

        payload.mainToken,

        payload.main_token,

        payload.session?.mainToken,

        payload.session?.main_token,

        payload.auth?.mainToken,

        payload.auth?.main_token

    ];


    for (
        const value
        of mainTokenCandidates
    ) {

        if (
            typeof value ===
            "string" &&
            value.length > 0
        ) {

            gameState.mainToken =
                value;

            break;

        }

    }


    /*
     * BRIDGE INFORMATION
     */

    if (
        payload.bridge &&
        typeof payload.bridge ===
        "object"
    ) {

        if (
            typeof payload.bridge.nonce ===
            "string"
        ) {

            gameState.bridgeNonce =
                payload.bridge.nonce;

        }


        if (
            typeof payload.bridge.parentOrigin ===
            "string"
        ) {

            gameState.parentOrigin =
                payload.bridge.parentOrigin;

        }

    }


    /*
     * Some versions may expose these
     * fields directly.
     */

    if (
        !gameState.bridgeNonce &&
        typeof payload.nonce ===
        "string"
    ) {

        gameState.bridgeNonce =
            payload.nonce;

    }


    if (
        !gameState.parentOrigin &&
        typeof payload.parentOrigin ===
        "string"
    ) {

        gameState.parentOrigin =
            payload.parentOrigin;

    }


    /*
     * FALLBACK PARENT ORIGIN
     *
     * Only used if Chastify didn't include it.
     */

    if (
        !gameState.parentOrigin
    ) {

        gameState.parentOrigin =
            DEFAULT_CHASTIFY_ORIGIN;

    }


    showDebug(
        "=================================\n" +
        "CHASTIFY HASH AUTHENTICATION\n" +
        "=================================\n" +
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
        ) +
        "\n" +
        "bridgeNonce: " +
        (
            gameState.bridgeNonce
                ? "[AVAILABLE]"
                : "NOT FOUND"
        ) +
        "\n" +
        "parentOrigin: " +
        (
            gameState.parentOrigin ||
            "NOT FOUND"
        )
    );


    if (
        !gameState.sessionId
    ) {

        showDebug(
            "ERROR: sessionId missing from iframe hash."
        );

    }


    if (
        !gameState.mainToken
    ) {

        showDebug(
            "ERROR: mainToken missing from iframe hash."
        );

    }


    if (
        !gameState.bridgeNonce
    ) {

        showDebug(
            "ERROR: bridge nonce missing from iframe hash."
        );

    }


    return (
        !!gameState.sessionId &&
        !!gameState.mainToken &&
        !!gameState.bridgeNonce
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
                "Not running inside an iframe."
            );

            return false;

        }


        /*
         * Every bridge request must contain
         * the nonce from the iframe hash.
         */

        const authenticatedMessage = {

            ...message,

            nonce:
                gameState.bridgeNonce

        };


        const targetOrigin =
            gameState.parentOrigin ||
            DEFAULT_CHASTIFY_ORIGIN;


        window.parent.postMessage(
            authenticatedMessage,
            targetOrigin
        );


        showDebug(
            "SENT TO CHASTIFY:\n" +
            safeDebugObject(
                authenticatedMessage
            )
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
   REQUEST SESSION
   ========================================================= */

function requestSession() {

    showDebug(
        "Requesting Chastify session..."
    );


    const requestId =
        crypto.randomUUID ?
        crypto.randomUUID() :
        Date.now().toString();


    sendToChastify({

        type:
            "chastify:ext:req",

        v:
            1,

        id:
            requestId,

        action:
            "session.get",

        payload:
            {}

    });

}


/* =========================================================
   REQUEST CONFIGURATION
   ========================================================= */

function requestConfig() {

    showDebug(
        "Requesting current Chastify configuration..."
    );


    const requestId =
        crypto.randomUUID ?
        crypto.randomUUID() :
        Date.now().toString();


    sendToChastify({

        type:
            "chastify:ext:req",

        v:
            1,

        id:
            requestId,

        action:
            "setup.get_config",

        payload:
            {}

    });

}


/* =========================================================
   CHASTIFY MESSAGE LISTENER
   ========================================================= */

window.addEventListener(
    "message",
    function(event) {

        const expectedOrigin =
            gameState.parentOrigin ||
            DEFAULT_CHASTIFY_ORIGIN;


        if (
            event.origin !==
            expectedOrigin
        ) {

            return;

        }


        const data =
            event.data;


        if (!data) {

            return;

        }


        showDebug(
            "MESSAGE RECEIVED:\n" +
            "Origin: " +
            event.origin +
            "\nData:\n" +
            safeDebugObject(data)
        );


        if (
            typeof data ===
            "string"
        ) {

            try {

                handleChastifyMessage(
                    JSON.parse(data)
                );

            } catch (error) {

                showDebug(
                    "Received string but it was not JSON."
                );

            }

            return;

        }


        handleChastifyMessage(
            data
        );

    }
);


/* =========================================================
   HANDLE CHASTIFY MESSAGE
   ========================================================= */

function handleChastifyMessage(data) {

    if (
        !data ||
        typeof data !==
        "object"
    ) {

        return;

    }


    if (
        data.type ===
        "chastify:ext:resp"
    ) {

        if (
            data.ok
        ) {

            showDebug(
                "Chastify response received successfully."
            );


            if (
                data.data &&
                typeof data.data ===
                "object"
            ) {

                extractChastifyInformation(
                    data.data
                );

                showDebug(
                    "Chastify response data:\n" +
                    safeDebugObject(
                        data.data
                    )
                );

            }


            setConnectionStatus(
                true
            );

        } else {

            showDebug(
                "Chastify returned an error:\n" +
                safeDebugObject(
                    data
                )
            );

            setConnectionStatus(
                false
            );

        }


        return;

    }


    /*
     * Handle UI/theme messages.
     */

    if (
        data.type ===
        "chastify:ext:ui"
    ) {

        showDebug(
            "Chastify UI update received."
        );

        return;

    }

}


/* =========================================================
   EXTRACT SESSION INFORMATION FROM RESPONSE
   ========================================================= */

function extractChastifyInformation(data) {

    if (
        !data ||
        typeof data !==
        "object"
    ) {

        return;

    }


    if (
        data.appId
    ) {

        gameState.appId =
            data.appId;

    }


    if (
        data.lockId
    ) {

        gameState.lockId =
            data.lockId;

    }


    const sessionIds = [

        data.sessionId,

        data.session_id,

        data.session?.id,

        data.session?.sessionId,

        data.data?.sessionId,

        data.data?.session?.id

    ];


    for (
        const value
        of sessionIds
    ) {

        if (
            typeof value ===
            "string" &&
            value.length > 0
        ) {

            gameState.sessionId =
                value;

            break;

        }

    }


    const tokens = [

        data.mainToken,

        data.main_token,

        data.session?.mainToken,

        data.session?.main_token,

        data.data?.mainToken,

        data.data?.main_token

    ];


    for (
        const value
        of tokens
    ) {

        if (
            typeof value ===
            "string" &&
            value.length > 0
        ) {

            gameState.mainToken =
                value;

            break;

        }

    }


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


    if (
        !minutes
    ) {

        return false;

    }


    /*
     * NO GAME_TEST FALLBACK.
     */

    if (
        !gameState.sessionId
    ) {

        showDebug(
            "ERROR: No real Chastify sessionId available."
        );

        return false;

    }


    if (
        !gameState.mainToken
    ) {

        showDebug(
            "ERROR: No real Chastify mainToken available."
        );

        return false;

    }


    const seconds =
        minutes * 60;


    showDebug(
        "=================================\n" +
        "SENDING TIME CHANGE TO CLOUDFLARE\n" +
        "=================================\n" +
        "Session ID:\n" +
        gameState.sessionId +
        "\n" +
        "Minutes:\n" +
        minutes +
        "\n" +
        "Seconds:\n" +
        seconds +
        "\n" +
        "Reason:\n" +
        (reason || "Lost Island")
    );


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
            "CLOUDFLARE RESPONSE:\n" +
            "HTTP " +
            response.status +
            "\n" +
            safeDebugObject(
                responseData
            )
        );


        if (
            !response.ok
        ) {

            showDebug(
                "=================================\n" +
                "CLOUDFLARE TIME CHANGE FAILED\n" +
                "================================="
            );

            return false;

        }


        if (
            responseData &&
            responseData.ok
        ) {

            gameState.totalTimeChange +=
                minutes;


            showDebug(
                "=================================\n" +
                "CLOUDFLARE TIME CHANGE SUCCESSFUL\n" +
                "================================="
            );


            return true;

        }


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


    if (
        !minutes
    ) {

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
   RANDOM OUTCOME
   ========================================================= */

function determineOutcome() {

    let rewardChance =
        clamp(
            Number(
                settings.rewardChance
            ),
            0,
            100
        );


    let neutralChance =
        clamp(
            Number(
                settings.neutralChance
            ),
            0,
            100
        );


    let punishmentChance =
        clamp(
            Number(
                settings.punishmentChance
            ),
            0,
            100
        );


    const total =
        rewardChance +
        neutralChance +
        punishmentChance;


    if (
        total <= 0
    ) {

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
                2,

            time:
                -30

        },

        {

            text:
                "You search for a long time but find nothing useful.",

            outcome:
                "neutral",

            time:
                0

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

    if (
        !events[action]
    ) {

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


        if (
            matching.length > 0
        ) {

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


    /*
     * RESOURCE CHANGES
     */

    if (
        event.health
    ) {

        gameState.health =
            clamp(
                gameState.health +
                event.health,
                0,
                100
            );

    }


    if (
        event.water
    ) {

        gameState.water =
            Math.max(
                0,
                gameState.water +
                event.water
            );

    }


    if (
        event.food
    ) {

        gameState.food =
            Math.max(
                0,
                gameState.food +
                event.food
            );

    }


    if (
        event.materials
    ) {

        gameState.materials =
            Math.max(
                0,
                gameState.materials +
                event.materials
            );

    }


    /*
     * =====================================================
     * TIME CONSEQUENCES
     * =====================================================
     */

    let timeChange =
        0;


    if (
        outcome ===
        "reward"
    ) {

        timeChange =
            -randomNumber(
                settings.rewardMin,
                settings.rewardMax
            );

    }


    else if (
        outcome ===
        "punishment"
    ) {

        timeChange =
            randomNumber(
                settings.punishmentMin,
                settings.punishmentMax
            );

    }


    /*
     * Event-specific time.
     */

    if (
        event.time !== undefined
    ) {

        if (
            event.time < 0
        ) {

            timeChange =
                -randomNumber(
                    settings.rewardMin,
                    settings.rewardMax
                );

        }

        else if (
            event.time > 0
        ) {

            timeChange =
                randomNumber(
                    settings.punishmentMin,
                    settings.punishmentMax
                );

        }

        else {

            timeChange =
                0;

        }

    }


    /*
     * =====================================================
     * SEND REAL TIME CHANGE
     * =====================================================
     */

    let timeChangeConfirmed =
        true;


    if (
        timeChange !== 0
    ) {

        timeChangeConfirmed =
            await changeChastifyTime(
                timeChange,
                `${action} - ${outcome}`
            );

    }


    /*
     * =====================================================
     * DISPLAY RESULT
     * =====================================================
     */

    let title =
        "";

    let icon =
        "";


    if (
        outcome ===
        "reward"
    ) {

        title =
            "Good fortune";

        icon =
            "🍀";

    }


    else if (
        outcome ===
        "punishment"
    ) {

        title =
            "Something went wrong";

        icon =
            "⚠️";

    }


    else {

        title =
            "Nothing remarkable";

        icon =
            "➖";

    }


    let timeText =
        "";


    if (
        timeChange < 0
    ) {

        timeText =
            `<p><strong>🔓 Time reduction:</strong> ` +
            `${formatMinutes(
                Math.abs(timeChange)
            )}</p>`;

    }


    else if (
        timeChange > 0
    ) {

        timeText =
            `<p><strong>🔒 Lock time added:</strong> ` +
            `${formatMinutes(
                timeChange
            )}</p>`;

    }


    let confirmationText =
        "";


    if (
        timeChange !== 0
    ) {

        if (
            timeChangeConfirmed
        ) {

            confirmationText =
                `<p>✅ Cloudflare received the time change.</p>`;

        } else {

            confirmationText =
                `<p>⚠️ Time was calculated by the game, ` +
                `but Chastify did not confirm the change.</p>`;

        }

    }


    const result =
        document.getElementById(
            "result"
        );


    if (
        result
    ) {

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

            ${confirmationText}

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

        timeChangeConfirmed:
            timeChangeConfirmed

    };


    /*
     * Next day.
     */

    gameState.day++;


    updateDisplay();

}


/* =========================================================
   DISPLAY
   ========================================================= */

function updateDisplay() {

    const health =
        document.getElementById(
            "health"
        );


    const water =
        document.getElementById(
            "water"
        );


    const food =
        document.getElementById(
            "food"
        );


    const materials =
        document.getElementById(
            "materials"
        );


    const day =
        document.getElementById(
            "day"
        );


    if (
        health
    ) {

        health.textContent =
            gameState.health;

    }


    if (
        water
    ) {

        water.textContent =
            gameState.water;

    }


    if (
        food
    ) {

        food.textContent =
            gameState.food;

    }


    if (
        materials
    ) {

        materials.textContent =
            gameState.materials;

    }


    if (
        day
    ) {

        day.textContent =
            gameState.day;

    }

}


/* =========================================================
   SETTINGS UI
   ========================================================= */

function updateSettingsUI() {

    const difficulty =
        document.getElementById(
            "difficulty"
        );


    const rewardChance =
        document.getElementById(
            "rewardChance"
        );


    const neutralChance =
        document.getElementById(
            "neutralChance"
        );


    const punishmentChance =
        document.getElementById(
            "punishmentChance"
        );


    const rewardMin =
        document.getElementById(
            "rewardMin"
        );


    const rewardMax =
        document.getElementById(
            "rewardMax"
        );


    const punishmentMin =
        document.getElementById(
            "punishmentMin"
        );


    const punishmentMax =
        document.getElementById(
            "punishmentMax"
        );


    if (
        difficulty
    ) {

        difficulty.value =
            settings.difficulty;

    }


    if (
        rewardChance
    ) {

        rewardChance.value =
            settings.rewardChance;

    }


    if (
        neutralChance
    ) {

        neutralChance.value =
            settings.neutralChance;

    }


    if (
        punishmentChance
    ) {

        punishmentChance.value =
            settings.punishmentChance;

    }


    if (
        rewardMin
    ) {

        rewardMin.value =
            settings.rewardMin;

    }


    if (
        rewardMax
    ) {

        rewardMax.value =
            settings.rewardMax;

    }


    if (
        punishmentMin
    ) {

        punishmentMin.value =
            settings.punishmentMin;

    }


    if (
        punishmentMax
    ) {

        punishmentMax.value =
            settings.punishmentMax;

    }

}


/* =========================================================
   SAVE SETTINGS
   ========================================================= */

function saveSettings() {

    const difficulty =
        document.getElementById(
            "difficulty"
        );


    const rewardChance =
        document.getElementById(
            "rewardChance"
        );


    const neutralChance =
        document.getElementById(
            "neutralChance"
        );


    const punishmentChance =
        document.getElementById(
            "punishmentChance"
        );


    const rewardMin =
        document.getElementById(
            "rewardMin"
        );


    const rewardMax =
        document.getElementById(
            "rewardMax"
        );


    const punishmentMin =
        document.getElementById(
            "punishmentMin"
        );


    const punishmentMax =
        document.getElementById(
            "punishmentMax"
        );


    settings.difficulty =
        difficulty.value;


    settings.rewardChance =
        Number(
            rewardChance.value
        );


    settings.neutralChance =
        Number(
            neutralChance.value
        );


    settings.punishmentChance =
        Number(
            punishmentChance.value
        );


    settings.rewardMin =
        Number(
            rewardMin.value
        );


    settings.rewardMax =
        Number(
            rewardMax.value
        );


    settings.punishmentMin =
        Number(
            punishmentMin.value
        );


    settings.punishmentMax =
        Number(
            punishmentMax.value
        );


    const total =
        settings.rewardChance +
        settings.neutralChance +
        settings.punishmentChance;


    if (
        total !== 100
    ) {

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


    if (
        modal
    ) {

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
            crypto.randomUUID ?
            crypto.randomUUID() :
            Date.now().toString(),

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
        settingsBtn
    ) {

        settingsBtn.addEventListener(
            "click",
            function() {

                updateSettingsUI();

                if (
                    modal
                ) {

                    modal.classList.remove(
                        "hidden"
                    );

                }

            }
        );

    }


    if (
        saveBtn
    ) {

        saveBtn.addEventListener(
            "click",
            saveSettings
        );

    }


    if (
        closeBtn
    ) {

        closeBtn.addEventListener(
            "click",
            function() {

                if (
                    modal
                ) {

                    modal.classList.add(
                        "hidden"
                    );

                }

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
   INITIALIZE CHASTIFY
   ========================================================= */

function initializeChastify() {

    showDebug(
        "=================================\n" +
        "INITIALIZING CHASTIFY\n" +
        "================================="
    );


    if (
        window.parent === window
    ) {

        showDebug(
            "ERROR: Lost Island is not running inside an iframe."
        );

        setConnectionStatus(
            false
        );

        return;

    }


    /*
     * FIRST:
     *
     * Read the iframe hash.
     */

    const payload =
        parseChastifyHash();


    if (
        !payload
    ) {

        showDebug(
            "ERROR: No valid Chastify iframe payload."
        );

        setConnectionStatus(
            false
        );

        return;

    }


    /*
     * SECOND:
     *
     * Extract session + authentication.
     */

    const authenticated =
        extractHashInformation(
            payload
        );


    if (
        !authenticated
    ) {

        showDebug(
            "ERROR: Chastify iframe authentication information is incomplete."
        );

        setConnectionStatus(
            false
        );

        return;

    }


    /*
     * THIRD:
     *
     * Now that nonce + parentOrigin are known,
     * request the real session.
     */

    requestSession();


    /*
     * Configuration is separate from
     * session authentication.
     */

    setTimeout(
        requestConfig,
        500
    );

}


/* =========================================================
   INITIALIZE GAME
   ========================================================= */

function initializeGame() {

    updateDisplay();

    initializeSettings();

    initializeActions();

    setConnectionStatus(
        false
    );


    showDebug(
        "=================================\n" +
        "LOST ISLAND INITIALIZED\n" +
        "================================="
    );


    showDebug(
        "Running inside iframe: " +
        (window.parent !== window)
    );


    showDebug(
        "Cloudflare Worker:\n" +
        WORKER_URL
    );


    initializeChastify();

}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeGame
);
