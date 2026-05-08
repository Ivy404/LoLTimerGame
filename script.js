import champion_position from "./champions_position.js";

let startTime = Date.now();
let intervalId;
let isRunning = false;
let buttonState = 'start';
let targetSeconds = 5;
let championEntries = [];
let currentChampion = null;
let currentAbilityRank = 1;
let championPositionMap = {}; // Lookup map: { championId: [role1, role2, ...] }

// Settings
let showCooldown = true;
let maxCooldown = 10;
let numberInputThreshold = 15;
let abilityHaste = 0;
let gameMode = 'timer'; // 'timer' or 'input'
let userInputValue = null;

const filterManager = {
    gamePool: new Set(),
    activeRoles: new Set(),
    
    updateGamePool() {
        this.gamePool.clear();
        if (this.activeRoles.size === 0) {
            championEntries.forEach(champ => this.gamePool.add(champ.id));
        } else {
            championEntries.forEach(champ => {
                const positions = championPositionMap[champ.id] || [];
                const positionsLower = positions.map(p => p.toLowerCase());
                if (positionsLower.some(pos => this.activeRoles.has(pos))) {
                    this.gamePool.add(champ.id);
                }
            });
        }
    },
    
    getFilteredList() {
        return championEntries.filter(champ => this.gamePool.has(champ.id));
    },
    
    toggleRole(role) {
        if (this.activeRoles.has(role)) {
            this.activeRoles.delete(role);
        } else {
            this.activeRoles.add(role);
        }
        this.updateGamePool();
    },
    
    toggleChampion(championId) {
        if (this.gamePool.has(championId)) {
            this.gamePool.delete(championId);
        } else {
            this.gamePool.add(championId);
        }
    },
    
    resetAll() {
        this.activeRoles.clear();
        this.gamePool.clear();
        championEntries.forEach(champ => this.gamePool.add(champ.id));
    }
};

function randomTargetSeconds() {
    return Math.floor(Math.random() * 10) + 1;
}

function updateInstruction() {
    if (showCooldown) {
        document.getElementById('instruction').textContent = `Click stop on ${targetSeconds.toFixed(1)} seconds`;
    } else {
        document.getElementById('instruction').textContent = `Click when the ability cooldown ends`;
    }
}

function randomChampionEntry() {
    const filteredList = filterManager.getFilteredList();
    if (!filteredList.length) return null;
    return filteredList[Math.floor(Math.random() * filteredList.length)];
}

function spellLetter(index) {
    return ['Q', 'W', 'E', 'R'][index] || '';
}

function renderRankDots(currentRank, maxrank) {
    const dotsContainer = document.getElementById('ability-rank-dots');
    dotsContainer.innerHTML = '';

    for (let i = 0; i < maxrank; i++) {
        const dot = document.createElement('div');
        dot.className = 'rank-dot';
        if (i < currentRank) {
            dot.classList.add('filled');
        }
        dotsContainer.appendChild(dot);
    }
}

function setAbilityPlaceholder(champion, spell) {
    if (!champion || !spell) return;
    currentChampion = champion;
    const picture = document.getElementById('picture');
    const championPortrait = document.getElementById('champion-portrait');
    const abilityText = document.getElementById('champion-ability');
    picture.src = `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/spell/${encodeURIComponent(spell.image.full)}`;
    picture.alt = `${spell.name} (${champion.name})`;
    championPortrait.src = `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/champion/${encodeURIComponent(champion.id)}.png`;
    championPortrait.alt = `${champion.name}`;
    abilityText.textContent = `${spell.spellLetter} - ${spell.name}`;
    
    const randomRank = Math.floor(Math.random() * spell.maxrank) + 1;
    currentAbilityRank = randomRank;
    renderRankDots(randomRank, spell.maxrank);
    
    if (spell.cooldown && spell.cooldown.length > 0) {
        const cooldownIndex = randomRank - 1;
        let baseCooldown = spell.cooldown[cooldownIndex];
        
        // Apply ability haste modifier
        const modifiedCooldown = baseCooldown * 100 / (100 + abilityHaste);
        targetSeconds = Math.round(modifiedCooldown * 10) / 10;
        updateInstruction();
    }
}

function loadChampionAbility(champion) {
    if (!champion) return;
    console.log("Loading ability for champion:", champion);
    fetch(`https://ddragon.leagueoflegends.com/cdn/16.9.1/data/en_US/champion/${encodeURIComponent(champion.id)}.json`)
        .then(response => response.json())
        .then(data => {
            let spells = data.data[champion.id]?.spells;
            if (!spells || !spells.length) {
                console.error('No spells found for champion', champion.id);
                return;
            }
            spells.forEach(element => {
                element.spellLetter = spellLetter(spells.indexOf(element));
            });
            // Filter spells based on max cooldown
            spells = spells.filter(spell => {
                if (!spell.cooldown || !spell.cooldown.length) return false;
                const maxSpellCooldown = Math.max(...spell.cooldown);
                return maxSpellCooldown <= maxCooldown;
            });
            if (!spells.length) {
                // No valid spells for this champion, try another
                loadChampionAbility(randomChampionEntry());
                return;
            }

            const spellIndex = Math.floor(Math.random() * spells.length);
            const spell = spells[spellIndex];
            setAbilityPlaceholder(champion, spell);
        })
        .catch(error => console.error('Failed to load champion ability data:', error));
}

function setTimerVisibility() {
    const timer = document.getElementById('timer');
    const inputMode = document.getElementById('inputMode');
    
    if (gameMode === 'timer') {
        timer.style.display = isRunning ? 'none' : 'block';
        inputMode.style.display = 'none';
    } else {
        timer.style.display = 'none';
        inputMode.style.display = isRunning ? 'flex' : 'none';
        if (isRunning) {
            document.getElementById('cooldownInput').focus();
        }
    }
}

function updateTimer() {
    if (!isRunning) return;
    const elapsed = Date.now() - startTime;
    const seconds = Math.floor(elapsed / 1000);
    const milliseconds = (elapsed % 1000).toFixed(0).padStart(3, '0');
    document.getElementById('timer').textContent = `${seconds}.${milliseconds}`;
}

function setFeedback(diffMs) {
    const feedback = document.getElementById('feedback');
    if (diffMs === null) {
        feedback.textContent = '';
        feedback.className = 'feedback';
        return;
    }

    const absDiff = Math.abs(diffMs);
    const sign = diffMs > 0 ? '+' : diffMs < 0 ? '-' : '';
    const when = diffMs > 0 ? 'late' : diffMs < 0 ? 'early' : 'exactly on time';
    const formatted = `${sign}${(absDiff / 1000).toFixed(3)}s`;
    feedback.textContent = diffMs === 0 ? 'Perfect! You hit the target exactly.' : `You were ${formatted} ${when}.`;

    if (absDiff < 500) {
        feedback.className = 'feedback green';
    } else if (absDiff < 1000) {
        feedback.className = 'feedback yellow';
    } else {
        feedback.className = 'feedback red';
    }
}

function resetInstruction() {
    targetSeconds = randomTargetSeconds();
    updateInstruction();
}

function resetGame() {
    isRunning = false;
    clearInterval(intervalId);
    startTime = Date.now();
    document.getElementById('timer').textContent = '0.000';
    resetInstruction();
    loadChampionAbility(randomChampionEntry());
    setTimerVisibility();
    setFeedback(null);
    buttonState = 'start';
    document.getElementById('toggleButton').textContent = 'Start Timer';
}

resetInstruction();
setTimerVisibility();
setFeedback(null);

function renderChampionGrid(entries) {
    const grid = document.getElementById('champion-grid');
    grid.innerHTML = '';

    entries.forEach(entry => {
        const img = document.createElement('img');
        img.src = `https://ddragon.leagueoflegends.com/cdn/16.9.1/img/champion/${encodeURIComponent(entry.id)}.png`;
        img.alt = entry.name;
        img.loading = 'lazy';
        
        const isInPool = filterManager.gamePool.has(entry.id);
        
        if (!isInPool) {
            img.style.filter = 'grayscale(100%) opacity(0.5)';
        } else {
            img.style.filter = '';
        }
        
        img.style.cursor = 'pointer';
        
        img.addEventListener('click', function() {
            filterManager.toggleChampion(entry.id);
            updateChampionGridFilters();
        });
        
        grid.appendChild(img);
    });
}

function updateChampionGridFilters() {
    renderChampionGrid(championEntries);
}

function fetchChampionData() {
    // Build champion position lookup map from external data
    champion_position.champions.forEach(champ => {
        championPositionMap[champ.id] = champ.position || [];
    });
    // console.log('Champion position map built:', championPositionMap);
    
    fetch('https://ddragon.leagueoflegends.com/cdn/16.9.1/data/en_US/champion.json')
        .then(response => response.json())
        .then(data => {
            championEntries = Object.values(data.data).map(champion => ({ id: champion.id, name: champion.name }));
            // console.log('Champion entries loaded:', championEntries);
            // Initialize gamePool with all champions
            filterManager.updateGamePool();
            renderChampionGrid(championEntries);
            loadChampionAbility(randomChampionEntry());
        })
        .catch(error => console.error('Failed to load champion data:', error));
}

fetchChampionData();

document.querySelectorAll('.filter-checkbox input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
        const role = this.dataset.role;
        filterManager.toggleRole(role);
        updateChampionGridFilters();
    });
});

document.getElementById('resetFiltersBtn').addEventListener('click', function() {
    filterManager.resetAll();
    document.querySelectorAll('.filter-checkbox input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    updateChampionGridFilters();
});

document.getElementById('grayAllBtn').addEventListener('click', function() {
    filterManager.gamePool.clear();
    updateChampionGridFilters();
});

document.getElementById('toggleButton').addEventListener('click', function() {
    if (buttonState === 'start') {
        startTime = Date.now();
        isRunning = true;
        intervalId = setInterval(updateTimer, 10);
        setTimerVisibility();
        setFeedback(null);
        buttonState = 'stop';
        this.textContent = 'Stop Timer';
    } else if (buttonState === 'stop') {
        const actualElapsed = Date.now() - startTime;
        const diffMs = actualElapsed - targetSeconds * 1000;
        setFeedback(diffMs);
        isRunning = false;
        clearInterval(intervalId);
        setTimerVisibility();
        buttonState = 'reset';
        this.textContent = 'Reset Timer';
    } else {
        resetGame();
    }
});

// Settings event listeners
document.getElementById('showCooldown').addEventListener('change', function() {
    showCooldown = this.checked;
    updateInstruction();
});

document.getElementById('maxCooldown').addEventListener('change', function() {
    maxCooldown = parseInt(this.value) || 10;
    loadChampionAbility(currentChampion);
});

document.getElementById('numberInputThreshold').addEventListener('change', function() {
    numberInputThreshold = parseInt(this.value) || 15;
});

document.getElementById('abilityHaste').addEventListener('change', function() {
    abilityHaste = parseInt(this.value) || 0;
    loadChampionAbility(currentChampion);
});
