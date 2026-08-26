// ============================================================
// LOST ISLAND V4
// ============================================================

// Leave this empty for now.
// We will put your secure backend URL here later.
//
// DO NOT put your Chastify API token in this file.
const API_BASE_URL = "";


// ============================================================
// GAME STATE
// ============================================================

const game = {

    day: 1,

    health: 100,
    water: 2,
    food: 2,
    materials: 1,

    discoveredLocations: [
        "camp",
        "westBeach",
        "jungleEdge",
        "wreck"
    ],

    locationStates: {},

    settings: {

        difficulty: "normal",

        rewardChance: 35,
        neutralChance: 40,
        punishmentChance: 25,

        rewardMin: 30,
        rewardMax: 60,

        punishmentMin: 60,
        punishmentMax: 300
    }
};


// ============================================================
// DOM ELEMENTS
// ============================================================

const healthEl = document.getElementById("health");
const waterEl = document.getElementById("water");
const foodEl = document.getElementById("food");
const materialsEl = document.getElementById("materials");
const dayEl = document.getElementById("day");

const eventEl = document.getElementById("event");
const resultEl = document.getElementById("result");


// ============================================================
// SETTINGS
// ============================================================

const settingsBtn =
    document.getElementById("settingsBtn");

const settingsModal =
    document.getElementById("settingsModal");

const saveSettings =
    document.getElementById("saveSettings");

const closeSettings =
    document.getElementById("closeSettings");


settingsBtn.onclick = () => {

    settingsModal.classList.remove("hidden");

};


closeSettings.onclick = () => {

    settingsModal.classList.add("hidden");

};


saveSettings.onclick = () => {

    game.settings.difficulty =
        document.getElementById("difficulty").value;

    game.settings.rewardChance =
        Number(
            document.getElementById("rewardChance").value
        );

    game.settings.neutralChance =
        Number(
            document.getElementById("neutralChance").value
        );

    game.settings.punishmentChance =
        Number(
            document.getElementById("punishmentChance").value
        );

    game.settings.rewardMin =
        Number(
            document.getElementById("rewardMin").value
        );

    game.settings.rewardMax =
        Number(
            document.getElementById("rewardMax").value
        );

    game.settings.punishmentMin =
        Number(
            document.getElementById("punishmentMin").value
        );

    game.settings.punishmentMax =
        Number(
            document.getElementById("punishmentMax").value
        );


    const total =
        game.settings.rewardChance +
        game.settings.neutralChance +
        game.settings.punishmentChance;


    if (total !== 100) {

        alert(
            "Reward + Neutral + Punishment must equal 100%."
        );

        return;
    }


    localStorage.setItem(
        "lostIslandSettings",
        JSON.stringify(game.settings)
    );


    settingsModal.classList.add("hidden");


    showMessage(
        "⚙️ Settings saved.",
        "neutral"
    );

};


// ============================================================
// LOAD SETTINGS
// ============================================================

function loadSettings() {

    const saved =
        localStorage.getItem(
            "lostIslandSettings"
        );


    if (!saved) {

        return;

    }


    try {

        game.settings =
            JSON.parse(saved);


        document.getElementById("difficulty").value =
            game.settings.difficulty;

        document.getElementById("rewardChance").value =
            game.settings.rewardChance;

        document.getElementById("neutralChance").value =
            game.settings.neutralChance;

        document.getElementById("punishmentChance").value =
            game.settings.punishmentChance;

        document.getElementById("rewardMin").value =
            game.settings.rewardMin;

        document.getElementById("rewardMax").value =
            game.settings.rewardMax;

        document.getElementById("punishmentMin").value =
            game.settings.punishmentMin;

        document.getElementById("punishmentMax").value =
            game.settings.punishmentMax;

    }

    catch (error) {

        console.error(
            "Could not load settings:",
            error
        );

    }

}


// ============================================================
// ACTION BUTTONS
// ============================================================

document
    .querySelectorAll(".action")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const action =
                    button.dataset.action;

                performAction(action);

            }
        );

    });


// ============================================================
// ACTION ENGINE
// ============================================================

function performAction(action) {

    disableActions();


    eventEl.classList.add(
        "hidden"
    );


    const outcomes =
        getActionOutcomes(action);


    const result =
        rollOutcome();


    const outcome =
        outcomes[result];


    applyOutcome(outcome);


    advanceDay();


    updateUI();


    setTimeout(
        enableActions,
        400
    );

}


// ============================================================
// ACTION OUTCOMES
// ============================================================

function getActionOutcomes(action) {

    switch (action) {


        // ----------------------------------------------------
        // WATER
        // ----------------------------------------------------

        case "water":

            return {

                reward: {

                    type: "reward",

                    title:
                        "💧 Water Found",

                    text:
                        "You discover a small freshwater source hidden among the rocks.",

                    changes: {

                        water: 2

                    },

                    time: -60
                },


                neutral: {

                    type: "neutral",

                    title:
                        "💧 No Luck",

                    text:
                        "You spend hours searching but find no usable water.",

                    changes: {},

                    time: 0
                },


                punishment: {

                    type: "punishment",

                    title:
                        "⚠️ Dangerous Terrain",

                    text:
                        "You slip while searching and injure yourself.",

                    changes: {

                        health: -10

                    },

                    time: 180
                }

            };


        // ----------------------------------------------------
        // EXPLORE
        // ----------------------------------------------------

        case "explore":

            return {

                reward: {

                    type: "reward",

                    title:
                        "🌴 New Discovery",

                    text:
                        "You find a narrow trail leading deeper into the island.",

                    changes: {},

                    discover:
                        "deepJungle",

                    time: -30
                },


                neutral: {

                    type: "neutral",

                    title:
                        "🌴 Nothing New",

                    text:
                        "You explore for hours but find nothing particularly useful.",

                    changes: {},

                    time: 0
                },


                punishment: {

                    type: "punishment",

                    title:
                        "🐍 Something Moves",

                    text:
                        "You disturb something in the undergrowth and retreat with a painful injury.",

                    changes: {

                        health: -15

                    },

                    time: 240
                }

            };


        // ----------------------------------------------------
        // MATERIALS
        // ----------------------------------------------------

        case "materials":

            return {

                reward: {

                    type: "reward",

                    title:
                        "🪵 Useful Materials",

                    text:
                        "You find plenty of dry wood and useful pieces of debris.",

                    changes: {

                        materials: 2

                    },

                    time: -30
                },


                neutral: {

                    type: "neutral",

                    title:
                        "🪵 Slim Pickings",

                    text:
                        "You find a few pieces of wood, but nothing particularly useful.",

                    changes: {

                        materials: 1

                    },

                    time: 0
                },


                punishment: {

                    type: "punishment",

                    title:
                        "🪵 Injury",

                    text:
                        "A piece of debris shifts unexpectedly and injures your hand.",

                    changes: {

                        health: -8

                    },

                    time: 120
                }

            };


        // ----------------------------------------------------
        // WRECK
        // ----------------------------------------------------

        case "wreck":

            return {

                reward: {

                    type: "reward",

                    title:
                        "⚓ Valuable Discovery",

                    text:
                        "You discover an intact container inside the wreck.",

                    changes: {

                        materials: 2

                    },

                    time: -60
                },


                neutral: {

                    type: "neutral",

                    title:
                        "⚓ Nothing Useful",

                    text:
                        "The wreck is more damaged than you thought. You find nothing useful.",

                    changes: {},

                    time: 0
                },


                punishment: {

                    type: "punishment",

                    title:
                        "⚠️ The Wreck Shifts",

                    text:
                        "Part of the wreck collapses while you are searching.",

                    changes: {

                        health: -20

                    },

                    time: 300
                }

            };


        // ----------------------------------------------------
        // CAMP
        // ----------------------------------------------------

        case "camp":

            return {

                reward: {

                    type: "reward",

                    title:
                        "🏕️ Camp Improved",

                    text:
                        "You reinforce your shelter and make the camp more secure.",

                    changes: {

                        health: 5

                    },

                    time: -30
                },


                neutral: {

                    type: "neutral",

                    title:
                        "🏕️ A Quiet Day",

                    text:
                        "You spend the day maintaining your camp.",

                    changes: {},

                    time: 0
                },


                punishment: {

                    type: "punishment",

                    title:
                        "🌧️ The Storm",

                    text:
                        "A sudden storm damages part of your shelter.",

                    changes: {

                        materials: -1

                    },

                    time: 120
                }

            };

    }


    return null;

}


// ============================================================
// RNG
// ============================================================

function rollOutcome() {

    const random =
        Math.random() * 100;


    const reward =
        game.settings.rewardChance;


    const neutral =
        reward +
        game.settings.neutralChance;


    if (random < reward) {

        return "reward";

    }


    if (random < neutral) {

        return "neutral";

    }


    return "punishment";

}


// ============================================================
// APPLY OUTCOME
// ============================================================

function applyOutcome(outcome) {

    if (!outcome) {

        return;

    }


    // Apply resource changes

    if (outcome.changes) {

        Object.keys(
            outcome.changes
        )
        .forEach(key => {

            game[key] +=
                outcome.changes[key];

        });

    }


    // Discover new location

    if (outcome.discover) {

        discoverLocation(
            outcome.discover
        );

    }


    // Show result

    showMessage(

        `
        <h2>${outcome.title}</h2>

        <p>
            ${outcome.text}
        </p>

        ${
            outcome.time !== 0

            ?

            `
            <strong>
                🔒 ${formatTimeChange(outcome.time)}
            </strong>
            `

            :

            ""
        }
        `,

        outcome.type

    );


    // Send time change to Chastify

    if (outcome.time !== 0) {

        changeChastifyTime(

            outcome.time,

            outcome.title

        );

    }

}


// ============================================================
// CHASTIFY CONNECTION
// ============================================================

async function changeChastifyTime(
    seconds,
    reason
) {

    /*
        V4 DEMO MODE

        Until we connect the backend,
        the game simply records the
        requested time change in the
        browser console.

        Example:

        -60 = remove 1 hour
        +180 = add 3 minutes

        IMPORTANT:
        The Chastify API token must NEVER
        be placed in this file.
    */


    if (!API_BASE_URL) {

        console.log(
            "Chastify time change:",
            seconds,
            "seconds",
            reason
        );

        return;

    }


    try {

        const response =
            await fetch(

                `${API_BASE_URL}/api/time`,

                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            deltaSeconds:
                                seconds,

                            reason:
                                reason

                        })

                }

            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        console.log(
            "Chastify response:",
            data
        );


        setConnectionStatus(
            true
        );

    }


    catch (error) {

        console.error(
            "Chastify connection failed:",
            error
        );


        setConnectionStatus(
            false
        );

    }

}


// ============================================================
// LOCATION SYSTEM
// ============================================================

function discoverLocation(
    location
) {

    if (
        game.discoveredLocations
            .includes(location)
    ) {

        return;

    }


    game.discoveredLocations.push(
        location
    );


    const names = {

        deepJungle:
            "🌴 Deep Jungle",

        spring:
            "💧 Freshwater Spring",

        cave:
            "🕳️ Cave",

        hiddenCove:
            "🏝️ Hidden Cove",

        rockyCoast:
            "🪨 Rocky Coast",

        mountain:
            "⛰️ Mountain Ridge",

        signalStation:
            "📡 Signal Station",

        crater:
            "🌋 Volcanic Crater"

    };


    showMessage(

        `
        <h2>
            🗺️ New Location Discovered
        </h2>

        <p>
            You discovered:
            <strong>
                ${names[location] || location}
            </strong>
        </p>
        `,

        "reward"

    );

}


// ============================================================
// DAY
// ============================================================

function advanceDay() {

    game.day++;

}


// ============================================================
// SHOW MESSAGE
// ============================================================

function showMessage(
    html,
    type
) {

    resultEl.innerHTML =
        html;


    resultEl.className =
        `result ${type}`;


    resultEl.classList.remove(
        "hidden"
    );

}


// ============================================================
// TIME FORMAT
// ============================================================

function formatTimeChange(
    seconds
) {

    const absolute =
        Math.abs(seconds);


    const minutes =
        Math.round(
            absolute / 60
        );


    const hours =
        Math.floor(
            minutes / 60
        );


    const remaining =
        minutes % 60;


    const sign =
        seconds < 0
            ? "−"
            : "+";


    if (hours > 0) {

        return (
            `${sign}${hours}h ${remaining}m`
        );

    }


    return (
        `${sign}${remaining} min`
    );

}


// ============================================================
// UI UPDATE
// ============================================================

function updateUI() {

    healthEl.textContent =
        Math.max(
            0,
            game.health
        );


    waterEl.textContent =
        Math.max(
            0,
            game.water
        );


    foodEl.textContent =
        Math.max(
            0,
            game.food
        );


    materialsEl.textContent =
        Math.max(
            0,
            game.materials
        );


    dayEl.textContent =
        game.day;

}


// ============================================================
// DISABLE / ENABLE ACTIONS
// ============================================================

function disableActions() {

    document
        .querySelectorAll(".action")
        .forEach(button => {

            button.disabled = true;

        });

}


function enableActions() {

    document
        .querySelectorAll(".action")
        .forEach(button => {

            button.disabled = false;

        });

}


// ============================================================
// CHASTIFY STATUS
// ============================================================

function setConnectionStatus(
    online
) {

    const dot =
        document.getElementById(
            "connectionDot"
        );


    const text =
        document.getElementById(
            "connectionText"
        );


    if (online) {

        dot.className =
            "dot online";


        text.textContent =
            "Chastify: Connected";

    }

    else {

        dot.className =
            "dot offline";


        text.textContent =
            "Chastify: Offline";

    }

}


// ============================================================
// START GAME
// ============================================================

loadSettings();

updateUI();

setConnectionStatus(
    false
);
