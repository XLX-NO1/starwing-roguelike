(function () {
  "use strict";

  const DATA = window.GameData;
  const CONTENT = window.GameContent;
  const C = DATA.constants;
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const ui = {
    menuScreen: document.getElementById("menuScreen"),
    pauseScreen: document.getElementById("pauseScreen"),
    upgradeScreen: document.getElementById("upgradeScreen"),
    resultScreen: document.getElementById("resultScreen"),
    hud: document.getElementById("hud"),
    startButton: document.getElementById("startButton"),
    difficultyButtons: Array.from(document.querySelectorAll("[data-difficulty]")),
    activeSkillSummary: document.getElementById("activeSkillSummary"),
    activeSkillSlots: document.getElementById("activeSkillSlots"),
    activeSkillOptions: document.getElementById("activeSkillOptions"),
    activeSkillHud: document.getElementById("activeSkillHud"),
    resumeButton: document.getElementById("resumeButton"),
    retryButton: document.getElementById("retryButton"),
    menuButton: document.getElementById("menuButton"),
    pauseButton: document.getElementById("pauseButton"),
    restartFromPauseButton: document.getElementById("restartFromPauseButton"),
    menuFromPauseButton: document.getElementById("menuFromPauseButton"),
    upgradeTitle: document.getElementById("upgradeTitle"),
    upgradePrompt: document.getElementById("upgradePrompt"),
    upgradeCards: document.getElementById("upgradeCards"),
    hpText: document.getElementById("hpText"),
    hpBar: document.getElementById("hpBar"),
    shieldText: document.getElementById("shieldText"),
    shieldBar: document.getElementById("shieldBar"),
    timerText: document.getElementById("timerText"),
    stageText: document.getElementById("stageText"),
    stageName: document.getElementById("stageName"),
    stageTrait: document.getElementById("stageTrait"),
    stageObjective: document.getElementById("stageObjective"),
    levelText: document.getElementById("levelText"),
    xpText: document.getElementById("xpText"),
    xpBar: document.getElementById("xpBar"),
    weaponList: document.getElementById("weaponList"),
    bossPanel: document.getElementById("bossPanel"),
    bossName: document.getElementById("bossName"),
    bossBar: document.getElementById("bossBar"),
    resultKicker: document.getElementById("resultKicker"),
    resultTitle: document.getElementById("resultTitle"),
    resultTime: document.getElementById("resultTime"),
    resultLevel: document.getElementById("resultLevel"),
    resultKills: document.getElementById("resultKills"),
    resultScore: document.getElementById("resultScore"),
  };

  const view = { w: 0, h: 0, dpr: 1 };
  const world = { w: 0, h: 0 };
  const camera = { x: 0, y: 0, zoom: 0.78, targetZoom: 0.78 };
  const keys = new Set();
  const pointer = { active: false, hasTarget: false, x: 0, y: 0 };
  const stars = [];
  const projectiles = [];
  const enemyProjectiles = [];
  const enemies = [];
  const pickups = [];
  const particles = [];
  const floatTexts = [];
  const arcLines = [];
  const beamLines = [];
  const vortices = [];
  const hazards = [];
  const explosionQueue = [];

  let mode = "menu";
  let lastFrame = 0;
  let nextEntityId = 1;
  let player = null;
  let state = null;
  let weaponSignature = "";
  let activeSkillHudSignature = "";
  let selectedDifficulty = "normal";
  let selectedActiveSkillIds = [...CONTENT.defaultActiveSkills];
  const difficulties = CONTENT.difficulties;

  const STAGE_CLEAR_DELAY = C.stageClearDelay || 1.8;
  const WAVE_ENEMY_MULT = 3;
  const BOSS_POWER_MULT = 3;
  const STAGE_BOSS_HP_MULT = 50;
  const BOSS_DAMAGE_TAKEN_MULT = 0.2;
  const STAGE_ENEMY_HP_GROWTH = 2;
  const PICKUP_PULL_MULT = 2;
  const MAX_EXPLOSIONS_PER_FRAME = 8;
  const GRAZE_RADIUS = 34;
  const GRAZE_REWARD_STEP = 12;
  const ACTIVE_SKILL_KEYS = CONTENT.activeSkillKeys;
  const ACTIVE_SKILL_LABELS = CONTENT.activeSkillLabels;

  const activeSkillDefs = CONTENT.createActiveSkillDefs({
    activateAfterburner,
    activateBarrier,
    activateMissileRain,
    activateTimeFreeze,
    activateSingularity,
    activateNanorepair,
    activateEmp,
    activateOrbitalJudgement,
  });
  const activeSkillById = Object.fromEntries(activeSkillDefs.map((skill) => [skill.id, skill]));
  const stages = CONTENT.stages;
  const rarityLabel = CONTENT.rarityLabel;
  const tacticalChipDefs = CONTENT.tacticalChipDefs;
  const tacticalChipById = Object.fromEntries(tacticalChipDefs.map((chip) => [chip.id, chip]));
  const upgrades = CONTENT.createUpgrades({
    getPlayer: () => player,
    levelStep,
    levelAdd,
    softCount,
    overflowBonus,
    applyReduction,
    syncDrones,
  });


  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function distSq(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  function normalize(dx, dy) {
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len, len };
  }

  function configureWorld() {
    camera.targetZoom = view.w < 760 ? 0.7 : 0.74;
    camera.zoom = camera.targetZoom;
    world.w = Math.max(2400, Math.floor((view.w / camera.zoom) * 1.95));
    world.h = Math.max(1700, Math.floor((view.h / camera.zoom) * 2.05));
  }

  function screenToWorld(x, y) {
    return {
      x: camera.x + (x - view.w / 2) / camera.zoom,
      y: camera.y + (y - view.h / 2) / camera.zoom,
    };
  }

  function clampCamera() {
    const halfW = view.w / (2 * camera.zoom);
    const halfH = view.h / (2 * camera.zoom);
    camera.x = world.w <= halfW * 2 ? world.w / 2 : clamp(camera.x, halfW, world.w - halfW);
    camera.y = world.h <= halfH * 2 ? world.h / 2 : clamp(camera.y, halfH, world.h - halfH);
  }

  function updateCamera(dt) {
    if (!player) return;
    camera.zoom += (camera.targetZoom - camera.zoom) * Math.min(1, dt * 5);
    camera.x += (player.x - camera.x) * Math.min(1, dt * 6);
    camera.y += (player.y - camera.y) * Math.min(1, dt * 6);
    clampCamera();
  }

  function visibleWorldBounds(extra = 0) {
    const halfW = view.w / (2 * camera.zoom);
    const halfH = view.h / (2 * camera.zoom);
    return {
      left: camera.x - halfW - extra,
      right: camera.x + halfW + extra,
      top: camera.y - halfH - extra,
      bottom: camera.y + halfH + extra,
    };
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const min = Math.floor(total / 60).toString().padStart(2, "0");
    const sec = (total % 60).toString().padStart(2, "0");
    return `${min}:${sec}`;
  }

  function levelStep(level, value, pivot = 10, minScale = 0.22) {
    const scale = level <= pivot ? 1 : Math.max(minScale, Math.sqrt(pivot / Math.max(1, level)));
    return 1 + value * scale;
  }

  function levelAdd(level, value, pivot = 10, minScale = 0.22) {
    const scale = level <= pivot ? 1 : Math.max(minScale, Math.sqrt(pivot / Math.max(1, level)));
    return value * scale;
  }

  function softCount(base, level, maxVisible, rootScale = 1) {
    return Math.min(maxVisible, base + Math.ceil(Math.sqrt(Math.max(0, level)) * rootScale));
  }

  function overflowBonus(level, pivot, perLevel = 0.015) {
    return Math.max(0, level - pivot) * perLevel;
  }

  function endlessScale(level, rootScale = 1, overflowPivot = 24, overflowPerLevel = 0.01) {
    return Math.sqrt(Math.max(0, level)) * rootScale + overflowBonus(level, overflowPivot, overflowPerLevel);
  }

  function applyReduction(current, reduction, floor = 0.18) {
    return Math.max(floor, current * (1 - reduction));
  }

  function weightedPick(items, weightGetter) {
    let total = 0;
    for (const item of items) total += Math.max(0, weightGetter(item));
    let roll = Math.random() * total;
    for (const item of items) {
      roll -= Math.max(0, weightGetter(item));
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  }

  function currentStage() {
    return stages[state?.stageIndex || 0] || stages[0];
  }

  function currentDifficulty() {
    return difficulties[selectedDifficulty] || difficulties.normal;
  }

  function setDifficulty(difficultyId) {
    if (!difficulties[difficultyId]) return;
    selectedDifficulty = difficultyId;
    for (const button of ui.difficultyButtons) {
      const active = button.dataset.difficulty === selectedDifficulty;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function renderActiveSkillMenu() {
    if (!ui.activeSkillSlots || !ui.activeSkillOptions) return;
    ui.activeSkillSlots.textContent = "";
    for (let i = 0; i < ACTIVE_SKILL_LABELS.length; i += 1) {
      const skill = activeSkillById[selectedActiveSkillIds[i]];
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "active-slot";
      slot.dataset.slotIndex = i.toString();
      slot.innerHTML = `
        <span class="active-slot-key">${ACTIVE_SKILL_LABELS[i]}</span>
        <span class="active-slot-name">${skill ? skill.name : "未装配"}</span>
      `;
      slot.addEventListener("click", () => {
        selectedActiveSkillIds.splice(i, 1);
        renderActiveSkillMenu();
      });
      ui.activeSkillSlots.appendChild(slot);
    }

    ui.activeSkillOptions.textContent = "";
    for (const skill of activeSkillDefs) {
      const selected = selectedActiveSkillIds.includes(skill.id);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `active-skill-card${selected ? " is-selected" : ""}`;
      button.style.setProperty("--skill-color", skill.color);
      button.dataset.skillId = skill.id;
      button.innerHTML = `
        <strong>${skill.name}</strong>
        <span>${skill.desc} · ${skill.cooldown}s</span>
      `;
      button.addEventListener("click", () => toggleActiveSkill(skill.id));
      ui.activeSkillOptions.appendChild(button);
    }

    if (ui.activeSkillSummary) {
      ui.activeSkillSummary.textContent =
        selectedActiveSkillIds.length === 3 ? "Q / E / R 已装配" : `已装配 ${selectedActiveSkillIds.length} / 3`;
    }
    if (ui.startButton) {
      const ready = selectedActiveSkillIds.length === 3;
      ui.startButton.disabled = !ready;
      ui.startButton.textContent = ready ? "开始出击" : "装配 3 个技能";
    }
  }

  function toggleActiveSkill(skillId) {
    if (!activeSkillById[skillId]) return;
    const existing = selectedActiveSkillIds.indexOf(skillId);
    if (existing >= 0) {
      selectedActiveSkillIds.splice(existing, 1);
    } else if (selectedActiveSkillIds.length < 3) {
      selectedActiveSkillIds.push(skillId);
    } else {
      selectedActiveSkillIds[2] = skillId;
    }
    renderActiveSkillMenu();
  }

  function isFinalStage() {
    return state.stageIndex >= stages.length - 1;
  }

  function isBossEnemy(enemy) {
    return enemy?.bossKind === "stage" || enemy?.bossKind === "final" || enemy?.behavior === "boss";
  }

  function aliveNonBossCount() {
    let count = 0;
    for (const enemy of enemies) {
      if (!enemy.dead && !isBossEnemy(enemy)) count += 1;
    }
    return count;
  }

  function waveTargetFor(waveIndex) {
    const stage = currentStage();
    return Math.max(1, Math.round((stage.waveSize + waveIndex * stage.waveGrowth) * WAVE_ENEMY_MULT));
  }

  function stageReadyForBoss() {
    const stage = currentStage();
    return state.waveIndex >= stage.waves && !state.waveActive && state.waveBreakTimer <= 0 && aliveNonBossCount() === 0;
  }

  function stageObjectiveText() {
    if (!state) return "波次 1 / 12 | 本波 0 / 7";
    const stage = currentStage();
    if (state.stagePhase === "clear") return "关卡完成";
    if (state.stagePhase === "boss") {
      return isFinalStage() ? "摧毁最终 Boss" : `击败小Boss：${stage.miniBossName}`;
    }
    if (state.bountyActive) {
      return `悬赏目标出现 | 擦弹 ${state.grazeStreak}`;
    }
    if (state.bountyPending && state.waveActive) {
      return `悬赏信号 ${Math.ceil(state.bountyTimer)}s | 本波 ${Math.min(state.waveKills, state.waveTarget)} / ${state.waveTarget}`;
    }
    if (!state.waveActive) {
      if (state.waveIndex >= stage.waves) return `波次 ${stage.waves} / ${stage.waves} | Boss 准备`;
      return `波次 ${state.waveIndex} / ${stage.waves} | 下一波准备`;
    }
    return `波次 ${state.waveIndex + 1} / ${stage.waves} | 本波 ${Math.min(state.waveKills, state.waveTarget)} / ${state.waveTarget}`;
  }

  const upgradeAccent = CONTENT.upgradeAccent;


  function resize() {
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(view.w * view.dpr);
    canvas.height = Math.floor(view.h * view.dpr);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    configureWorld();
    createStars();
    if (player) {
      player.x = clamp(player.x, 28, world.w - 28);
      player.y = clamp(player.y, 28, world.h - 28);
      camera.x = player.x;
      camera.y = player.y;
      clampCamera();
    } else {
      camera.x = world.w / 2;
      camera.y = world.h / 2;
      clampCamera();
    }
  }

  function createStars() {
    stars.length = 0;
    const count = Math.floor(clamp((view.w * view.h) / 7600, 90, 260));
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: Math.random() * view.w,
        y: Math.random() * view.h,
        size: rand(0.7, 2.3),
        speed: rand(18, 90),
        alpha: rand(0.22, 0.88),
      });
    }
  }

  function setMode(nextMode) {
    mode = nextMode;
    ui.menuScreen.classList.toggle("is-visible", mode === "menu");
    ui.pauseScreen.classList.toggle("is-visible", mode === "paused");
    ui.upgradeScreen.classList.toggle("is-visible", mode === "upgrade");
    ui.resultScreen.classList.toggle("is-visible", mode === "result");
    ui.hud.classList.toggle("is-visible", ["playing", "paused", "upgrade"].includes(mode));
  }

  function startGame() {
    if (selectedActiveSkillIds.length !== 3) {
      renderActiveSkillMenu();
      return;
    }
    const difficulty = currentDifficulty();
    projectiles.length = 0;
    enemyProjectiles.length = 0;
    enemies.length = 0;
    pickups.length = 0;
    particles.length = 0;
    floatTexts.length = 0;
    arcLines.length = 0;
    beamLines.length = 0;
    vortices.length = 0;
    hazards.length = 0;
    explosionQueue.length = 0;
    weaponSignature = "";
    activeSkillHudSignature = "";
    nextEntityId = 1;
    state = {
      time: 0,
      spawnTimer: 0.6,
      eliteTimer: 42,
      boss: null,
      bossSpawned: false,
      victoryTimer: 0,
      screenShake: 0,
      kills: 0,
      score: 0,
      stageIndex: 0,
      stageTime: 0,
      stageKills: 0,
      waveIndex: 0,
      waveActive: false,
      waveKills: 0,
      waveTarget: 0,
      waveSpawnRemaining: 0,
      waveSpawnTimer: 0,
      waveBreakTimer: 0,
      bountyPending: false,
      bountyActive: false,
      bountyTimer: 0,
      bountyTargetId: null,
      stagePhase: "fight",
      stageClearTimer: 0,
      stageAnnounce: 2.8,
      hazardTimer: 5,
      cacheTimer: 8,
      stormPulse: 0,
      graze: 0,
      grazeStreak: 0,
      grazeTimer: 0,
      difficulty: difficulty.id,
      difficultyName: difficulty.name,
      skillChoicesPerLevel: difficulty.skillChoicesPerLevel,
      pendingUpgradePicks: 0,
      upgradeLevels: {},
    };
    player = {
      x: world.w * 0.5,
      y: world.h * 0.64,
      radius: C.playerRadius,
      hp: 100,
      maxHp: 100,
      shield: 20,
      maxShield: 20,
      speed: 360,
      pickupRange: 176,
      damageMult: 1,
      damageTakenMult: 1,
      fireRate: 1,
      projectileSpeedMult: 1,
      projectileSizeMult: 1,
      pierce: 0,
      regen: 0,
      shieldRegenMult: 1,
      critChance: 0.05,
      critDamage: 1.8,
      cannonShots: 1,
      cannonDamageMult: 1,
      cannonFireRate: 1,
      cannonTimer: 0,
      ammoSpreadLevel: 0,
      ammoLaserLevel: 0,
      ammoWaveLevel: 0,
      ammoHomingLevel: 0,
      ammoPlasmaLevel: 0,
      ammoDrillLevel: 0,
      ammoWaveTimer: 0,
      ammoHomingTimer: 0,
      ammoPlasmaTimer: 0,
      ammoDrillTimer: 0,
      missileLevel: 0,
      missileVolley: 0,
      missileDamageMult: 1,
      missileBlastBonus: 0,
      missileFireRate: 1,
      missileTimer: 0,
      droneLevel: 0,
      droneCount: 0,
      droneFireRate: 1,
      droneDamageMult: 1,
      droneRangeBonus: 0,
      drones: [],
      arcLevel: 0,
      arcDamageMult: 1,
      arcRangeBonus: 0,
      arcBonusJumps: 0,
      orbitalLaserLevel: 0,
      orbitalLaserTimer: 0,
      plasmaAuraLevel: 0,
      plasmaAuraTimer: 0,
      blackHoleLevel: 0,
      frostNovaLevel: 0,
      killExplosionLevel: 0,
      enemySlowMult: 1,
      xpGainMult: 1,
      tacticalChipCount: 0,
      tacticalChipCounts: {},
      boostTimer: 0,
      barrierTimer: 0,
      timeSlowTimer: 0,
      activeSkills: selectedActiveSkillIds.map((id, index) => ({
        id,
        key: ACTIVE_SKILL_LABELS[index],
        code: ACTIVE_SKILL_KEYS[index],
        cooldown: 0,
      })),
      xp: 0,
      xpToLevel: 30,
      level: 1,
      invuln: 0,
      shieldDelay: 0,
      dashCooldown: 0,
      dashTime: 0,
      dashCooldownMult: 1,
      dashDurationMult: 1,
      dashPowerMult: 1,
      dashX: 0,
      dashY: -1,
      lastMoveX: 0,
      lastMoveY: -1,
      tilt: 0,
      alive: true,
    };
    camera.x = player.x;
    camera.y = player.y;
    clampCamera();
    setMode("playing");
    updateHud();
  }

  function togglePause() {
    if (mode === "playing") {
      setMode("paused");
    } else if (mode === "paused") {
      setMode("playing");
    }
  }

  function endGame(victory) {
    if (mode === "result") return;
    ui.resultKicker.textContent = victory ? "TARGET DESTROYED" : "SORTIE FAILED";
    ui.resultTitle.textContent = victory ? "突围成功" : "机体坠毁";
    ui.resultTime.textContent = formatTime(state.time);
    ui.resultLevel.textContent = player.level.toString();
    ui.resultKills.textContent = state.kills.toString();
    ui.resultScore.textContent = state.score.toString();
    setMode("result");
  }

  function update(dt) {
    if (mode !== "playing") return;

    state.time += dt;
    updateStage(dt);
    updateCombatFlow(dt);
    updateEnvironment(dt);
    updateSpawn(dt);
    updatePlayer(dt);
    updateCamera(dt);
    updateWeapons(dt);
    updateSpecialSystems(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updatePickups(dt);
    updateEffects(dt);
    handleCollisions();
    updateExplosionQueue();
    cleanup();

    if (state.victoryTimer > 0) {
      state.victoryTimer -= dt;
      if (state.victoryTimer <= 0) endGame(true);
    }

    if (player.hp <= 0 && player.alive) {
      player.alive = false;
      burst(player.x, player.y, "#ff6b6b", 42, 6);
      endGame(false);
    }

    updateHud();
  }

  function updatePlayer(dt) {
    player.invuln = Math.max(0, player.invuln - dt);
    player.shieldDelay = Math.max(0, player.shieldDelay - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.boostTimer = Math.max(0, player.boostTimer - dt);
    player.barrierTimer = Math.max(0, player.barrierTimer - dt);
    player.timeSlowTimer = Math.max(0, player.timeSlowTimer - dt);
    for (const skill of player.activeSkills) {
      skill.cooldown = Math.max(0, skill.cooldown - dt);
    }
    if (player.maxShield > 0 && player.shieldDelay <= 0) {
      player.shield = Math.min(
        player.maxShield,
        player.shield + dt * (7 + player.maxShield * 0.035) * player.shieldRegenMult,
      );
    }
    if (player.regen > 0 && player.hp > 0) {
      player.hp = Math.min(player.maxHp, player.hp + player.regen * dt);
    }

    let dx = 0;
    let dy = 0;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
    if (keys.has("KeyW") || keys.has("ArrowUp")) dy -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) dy += 1;

    const keyboardMoved = dx !== 0 || dy !== 0;
    if (keyboardMoved) pointer.hasTarget = false;

    if (dx === 0 && dy === 0 && pointer.hasTarget) {
      const toward = normalize(pointer.x - player.x, pointer.y - player.y);
      if (toward.len > 8) {
        dx = toward.x;
        dy = toward.y;
      } else if (!pointer.active) {
        pointer.hasTarget = false;
      }
    }

    const move = normalize(dx, dy);
    let activeMove = move;
    let speed = player.speed;
    const dashing = player.dashTime > 0;
    const boosting = player.boostTimer > 0;

    if (dx !== 0 || dy !== 0) {
      player.lastMoveX = move.x;
      player.lastMoveY = move.y;
    }

    if (boosting) {
      speed *= 1.85;
      if (Math.random() < 0.9) {
        puff(player.x - player.lastMoveX * 18, player.y - player.lastMoveY * 18, "rgba(94, 226, 255, 0.72)", 1);
      }
    }

    if (dashing) {
      player.dashTime = Math.max(0, player.dashTime - dt);
      activeMove = { x: player.dashX, y: player.dashY };
      speed *= 2.75 * player.dashPowerMult;
      player.invuln = Math.max(player.invuln, 0.12);
      puff(player.x - activeMove.x * 12, player.y - activeMove.y * 12, "rgba(94, 226, 255, 0.58)", 2);
    }

    if (dx !== 0 || dy !== 0) {
      player.x += activeMove.x * speed * dt;
      player.y += activeMove.y * speed * dt;
    } else if (dashing) {
      player.x += activeMove.x * speed * dt;
      player.y += activeMove.y * speed * dt;
    }
    player.x = clamp(player.x, 28, world.w - 28);
    player.y = clamp(player.y, 28, world.h - 28);
    player.tilt += (activeMove.x * 0.22 - player.tilt) * Math.min(1, dt * 9);
  }

  function triggerDash() {
    if (!player || mode !== "playing" || player.dashCooldown > 0 || !player.alive) return;
    let dx = 0;
    let dy = 0;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
    if (keys.has("KeyW") || keys.has("ArrowUp")) dy -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) dy += 1;

    if (dx === 0 && dy === 0 && pointer.hasTarget) {
      const toward = normalize(pointer.x - player.x, pointer.y - player.y);
      if (toward.len > 8) {
        dx = toward.x;
        dy = toward.y;
      }
    }

    const dir = dx !== 0 || dy !== 0 ? normalize(dx, dy) : normalize(player.lastMoveX, player.lastMoveY);
    player.dashX = dir.x;
    player.dashY = dir.y;
    player.dashTime = 0.18 * player.dashDurationMult;
    player.dashCooldown = 1.55 * player.dashCooldownMult;
    player.invuln = Math.max(player.invuln, 0.24);
    state.screenShake = Math.max(state.screenShake, 0.12);
    burst(player.x, player.y, "#5ee2ff", 10, 2.2);
    if (player.frostNovaLevel > 0) emitFrostNova();
  }

  function emitFrostNova() {
    const scale = endlessScale(player.frostNovaLevel, 1, 26, 0.012);
    const radius = 132 + Math.min(210, scale * 34);
    const damage = (20 + scale * 13) * player.damageMult;
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      if (distSq(enemy.x, enemy.y, player.x, player.y) <= (radius + enemy.radius) ** 2) {
        enemy.slowTimer = Math.max(enemy.slowTimer, 1.6 + Math.min(2.2, scale * 0.32));
        damageEnemy(enemy, damage, false);
      }
    }
    vortices.push({
      x: player.x,
      y: player.y,
      radius,
      level: player.frostNovaLevel,
      color: "#8bdcff",
      life: 0.62,
      maxLife: 0.62,
      tick: 999,
    });
    burst(player.x, player.y, "#8bdcff", 32, 3.8);
  }

  function activateActiveSkillByCode(code) {
    const index = ACTIVE_SKILL_KEYS.indexOf(code);
    if (index >= 0) activateActiveSkill(index);
  }

  function activateActiveSkill(index) {
    if (!player || mode !== "playing" || !player.alive) return;
    const slot = player.activeSkills[index];
    const skill = slot ? activeSkillById[slot.id] : null;
    if (!skill) return;
    if (slot.cooldown > 0) {
      showActiveSkillText(`${Math.ceil(slot.cooldown)}s`, "#aeb4c2");
      return;
    }
    if (skill.activate(skill, slot) === false) return;
    slot.cooldown = skill.cooldown;
    showActiveSkillText(skill.name, skill.color);
    updateHud();
  }

  function showActiveSkillText(value, color) {
    floatTexts.push({
      x: player.x,
      y: player.y - 48,
      value,
      color,
      life: 0.78,
      maxLife: 0.78,
      size: 18,
    });
  }

  function findActiveSkillTarget(range = 1200) {
    if (pointer.hasTarget) {
      const pointed = findNearestEnemy(pointer.x, pointer.y, 420);
      if (pointed) return pointed;
    }
    return findNearestEnemy(player.x, player.y, range);
  }

  function clearEnemyProjectilesNear(x, y, radius, color) {
    let cleared = 0;
    for (const bullet of enemyProjectiles) {
      if (bullet.life <= 0) continue;
      if (distSq(x, y, bullet.x, bullet.y) <= radius * radius) {
        bullet.life = -1;
        cleared += 1;
        if (cleared < 28) puff(bullet.x, bullet.y, color, 1);
      }
    }
    return cleared;
  }

  function activateAfterburner(skill) {
    player.boostTimer = Math.max(player.boostTimer, 4);
    player.invuln = Math.max(player.invuln, 0.45);
    player.dashCooldown = Math.min(player.dashCooldown, 0.2);
    state.screenShake = Math.max(state.screenShake, 0.18);
    burst(player.x, player.y, skill.color, 26, 4.6);
  }

  function activateBarrier(skill) {
    player.barrierTimer = Math.max(player.barrierTimer, 3.8);
    player.shield = Math.min(player.maxShield, player.shield + player.maxShield * 0.9 + 26);
    player.shieldDelay = 0;
    player.invuln = Math.max(player.invuln, 0.22);
    burst(player.x, player.y, skill.color, 34, 3.4);
  }

  function activateMissileRain(skill) {
    const shots = 16 + Math.min(12, player.level);
    for (let i = 0; i < shots; i += 1) {
      const target = findActiveSkillTarget(1500);
      const angle = rand(0, Math.PI * 2);
      const originRadius = rand(18, 54);
      const x = player.x + Math.cos(angle) * originRadius;
      const y = player.y + Math.sin(angle) * originRadius;
      const aim = target ? normalize(target.x - x, target.y - y) : normalize(player.lastMoveX, player.lastMoveY);
      const spread = rand(-0.36, 0.36);
      const ca = Math.cos(spread);
      const sa = Math.sin(spread);
      const dir = {
        x: aim.x * ca - aim.y * sa,
        y: aim.x * sa + aim.y * ca,
      };
      spawnProjectile({
        x,
        y,
        vx: dir.x * 520,
        vy: dir.y * 520,
        radius: 8 * player.projectileSizeMult,
        damage: rollDamage((70 + player.level * 2.5) * player.damageMult),
        pierce: 0,
        life: 3.4,
        color: skill.color,
        type: "missile",
        blastRadius: 88 + player.missileBlastBonus,
        target,
        turnRate: 6.2,
      });
    }
    burst(player.x, player.y, skill.color, 30, 4.6);
  }

  function activateTimeFreeze(skill) {
    player.timeSlowTimer = Math.max(player.timeSlowTimer, 5);
    for (const enemy of enemies) {
      if (!enemy.dead) enemy.slowTimer = Math.max(enemy.slowTimer, 2.8);
    }
    state.screenShake = Math.max(state.screenShake, 0.22);
    burst(player.x, player.y, skill.color, 46, 3.2);
  }

  function activateSingularity(skill) {
    const target = findActiveSkillTarget(1400);
    const x = target ? target.x : clamp(pointer.hasTarget ? pointer.x : player.x + player.lastMoveX * 260, 80, world.w - 80);
    const y = target ? target.y : clamp(pointer.hasTarget ? pointer.y : player.y + player.lastMoveY * 260, 80, world.h - 80);
    spawnVortex(x, y, 5, skill.color);
    explode(x, y, 150, 92 * player.damageMult);
    state.screenShake = Math.max(state.screenShake, 0.34);
  }

  function activateNanorepair(skill) {
    player.hp = Math.min(player.maxHp, player.hp + Math.max(44, player.maxHp * 0.45));
    player.shield = Math.min(player.maxShield, player.shield + Math.max(24, player.maxShield * 0.7));
    player.invuln = Math.max(player.invuln, 0.8);
    player.shieldDelay = 0;
    clearEnemyProjectilesNear(player.x, player.y, 560, skill.color);
    burst(player.x, player.y, skill.color, 42, 3.6);
  }

  function activateEmp(skill) {
    const radius = 560;
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const d = Math.sqrt(distSq(player.x, player.y, enemy.x, enemy.y));
      if (d > radius + enemy.radius) continue;
      enemy.slowTimer = Math.max(enemy.slowTimer, 3.4);
      enemy.vx *= 0.12;
      enemy.vy *= 0.12;
      damageEnemy(enemy, (115 + player.level * 2) * player.damageMult * (1 - clamp(d / radius, 0, 0.72)), false);
    }
    clearEnemyProjectilesNear(player.x, player.y, radius, skill.color);
    vortices.push({
      x: player.x,
      y: player.y,
      radius,
      level: 3,
      color: skill.color,
      life: 0.58,
      maxLife: 0.58,
      tick: 999,
    });
    state.screenShake = Math.max(state.screenShake, 0.38);
  }

  function activateOrbitalJudgement(skill) {
    let hits = 0;
    for (let i = 0; i < 8; i += 1) {
      const target = findNearestEnemy(player.x + rand(-360, 360), player.y + rand(-260, 260), 1700);
      if (!target) continue;
      hits += 1;
      const startX = target.x + rand(-150, 150);
      const startY = target.y - rand(720, 940);
      beamLines.push({
        x1: startX,
        y1: startY,
        x2: target.x,
        y2: target.y,
        color: skill.color,
        life: 0.3,
        maxLife: 0.3,
        width: 16,
      });
      for (const enemy of enemies) {
        if (enemy.dead) continue;
        const lineDist = pointLineDistance(enemy.x, enemy.y, startX, startY, target.x, target.y);
        if (lineDist < 58 + enemy.radius) {
          damageEnemy(enemy, (145 + player.level * 4) * player.damageMult * (enemy === target ? 1 : 0.48), false);
        }
      }
      burst(target.x, target.y, skill.color, 18, 4.4);
    }
    if (hits === 0) return false;
    state.screenShake = Math.max(state.screenShake, 0.42);
  }

  function updateWeapons(dt) {
    updateCannon(dt);
    updateMissiles(dt);
    updateDrones(dt);
  }

  function updateCannon(dt) {
    player.cannonTimer -= dt;
    player.ammoWaveTimer = Math.max(0, player.ammoWaveTimer - dt);
    player.ammoHomingTimer = Math.max(0, player.ammoHomingTimer - dt);
    player.ammoPlasmaTimer = Math.max(0, player.ammoPlasmaTimer - dt);
    player.ammoDrillTimer = Math.max(0, player.ammoDrillTimer - dt);
    const config = DATA.weapons.cannon;
    const interval = config.baseInterval / (player.fireRate * player.cannonFireRate);
    if (player.cannonTimer > 0) return;
    player.cannonTimer = interval;

    const target = findNearestEnemy(player.x, player.y, 980);
    const aim = target ? normalize(target.x - player.x, target.y - player.y) : { x: 0, y: -1 };
    const perp = { x: -aim.y, y: aim.x };
    const shots = player.cannonShots;
    const spread = Math.min(0.36, 0.08 * (shots - 1));

    for (let i = 0; i < shots; i += 1) {
      const offset = (i - (shots - 1) / 2) * 10;
      const angleOffset = shots > 1 ? rand(-spread, spread) : 0;
      const ca = Math.cos(angleOffset);
      const sa = Math.sin(angleOffset);
      const dir = {
        x: aim.x * ca - aim.y * sa,
        y: aim.x * sa + aim.y * ca,
      };
      spawnProjectile({
        x: player.x + perp.x * offset + aim.x * 22,
        y: player.y + perp.y * offset + aim.y * 22,
        vx: dir.x * config.projectileSpeed * player.projectileSpeedMult,
        vy: dir.y * config.projectileSpeed * player.projectileSpeedMult,
        radius: 4 * player.projectileSizeMult,
        damage: rollDamage(config.baseDamage * player.damageMult * player.cannonDamageMult),
        pierce: player.pierce,
        life: 1.45,
        color: config.color,
        type: "cannon",
      });
    }
    if (player.ammoSpreadLevel > 0) fireMainSpreadAmmo(config, aim, perp);
    if (player.ammoLaserLevel > 0) fireMainLaserAmmo(config, aim, perp);
    if (player.ammoWaveLevel > 0 && player.ammoWaveTimer <= 0) {
      fireMainWaveAmmo(config, aim);
      player.ammoWaveTimer = Math.max(0.18, 0.62 / Math.sqrt(player.fireRate * player.cannonFireRate));
    }
    if (player.ammoHomingLevel > 0 && player.ammoHomingTimer <= 0) {
      fireMainHomingAmmo(config);
      player.ammoHomingTimer = Math.max(0.08, 0.34 / Math.sqrt(player.fireRate * player.cannonFireRate));
    }
    if (player.ammoPlasmaLevel > 0 && player.ammoPlasmaTimer <= 0) {
      fireMainPlasmaAmmo(config);
      player.ammoPlasmaTimer = Math.max(0.08, 0.24 / Math.sqrt(player.fireRate * player.cannonFireRate));
    }
    if (player.ammoDrillLevel > 0 && player.ammoDrillTimer <= 0) {
      fireMainDrillAmmo(config, aim);
      player.ammoDrillTimer = Math.max(0.28, 1.05 / Math.sqrt(player.fireRate * player.cannonFireRate));
    }
    puff(player.x + aim.x * 22, player.y + aim.y * 22, config.color, 3);
  }

  function fireMainSpreadAmmo(config, aim, perp) {
    const level = player.ammoSpreadLevel;
    const pairs = Math.min(7, 1 + Math.floor(Math.sqrt(level)));
    const damageScale = 1 + endlessScale(level, 0.13, 28, 0.004);
    const damage = config.baseDamage * 0.62 * player.damageMult * player.cannonDamageMult * damageScale;
    for (let i = -pairs; i <= pairs; i += 1) {
      if (i === 0) continue;
      const angle = i * 0.105;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const dir = {
        x: aim.x * ca - aim.y * sa,
        y: aim.x * sa + aim.y * ca,
      };
      spawnProjectile({
        x: player.x + perp.x * i * 5 + aim.x * 18,
        y: player.y + perp.y * i * 5 + aim.y * 18,
        vx: dir.x * config.projectileSpeed * 0.88 * player.projectileSpeedMult,
        vy: dir.y * config.projectileSpeed * 0.88 * player.projectileSpeedMult,
        radius: 3.4 * player.projectileSizeMult,
        damage: rollDamage(damage),
        pierce: Math.max(0, player.pierce - 1),
        life: 1.25,
        color: "#ff6b6b",
        type: "cannon",
      });
    }
  }

  function fireMainLaserAmmo(config, aim, perp) {
    const level = player.ammoLaserLevel;
    const beams = Math.min(4, 1 + Math.floor(Math.sqrt(level) / 2));
    const damageScale = 1 + endlessScale(level, 0.18, 28, 0.006);
    const reach = 860 + Math.min(620, endlessScale(level, 72, 36, 2));
    const damage = config.baseDamage * 1.35 * player.damageMult * player.cannonDamageMult * damageScale;
    for (let i = 0; i < beams; i += 1) {
      const offset = (i - (beams - 1) / 2) * 12;
      const startX = player.x + perp.x * offset + aim.x * 20;
      const startY = player.y + perp.y * offset + aim.y * 20;
      const endX = startX + aim.x * reach;
      const endY = startY + aim.y * reach;
      spawnProjectile({
        x: startX + aim.x * 8,
        y: startY + aim.y * 8,
        vx: aim.x * config.projectileSpeed * 1.36 * player.projectileSpeedMult,
        vy: aim.y * config.projectileSpeed * 1.36 * player.projectileSpeedMult,
        radius: 3.2 * player.projectileSizeMult,
        damage: rollDamage(damage),
        pierce: player.pierce + 4 + Math.floor(endlessScale(level, 1, 36, 0.01)),
        life: 1.62,
        color: "#5ee2ff",
        type: "cannon",
      });
      for (const enemy of enemies) {
        if (enemy.dead) continue;
        const lineDist = pointLineDistance(enemy.x, enemy.y, startX, startY, endX, endY);
        if (lineDist < enemy.radius + 14 + Math.min(14, Math.sqrt(level) * 1.4)) {
          damageEnemy(enemy, damage * 0.34, false);
        }
      }
      beamLines.push({
        x1: startX,
        y1: startY,
        x2: endX,
        y2: endY,
        color: "#5ee2ff",
        life: 0.12,
        maxLife: 0.12,
        width: 5 + Math.min(5, Math.sqrt(level)),
      });
    }
  }

  function fireMainWaveAmmo(config, aim) {
    const level = player.ammoWaveLevel;
    const waves = Math.min(3, 1 + Math.floor(Math.sqrt(level) / 3));
    const damageScale = 1 + endlessScale(level, 0.22, 28, 0.006);
    const damage = config.baseDamage * 2.2 * player.damageMult * player.cannonDamageMult * damageScale;
    const spread = waves === 1 ? [0] : [-0.16, 0, 0.16];
    for (let i = 0; i < waves; i += 1) {
      const angle = spread[i] || 0;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const dir = {
        x: aim.x * ca - aim.y * sa,
        y: aim.x * sa + aim.y * ca,
      };
      spawnProjectile({
        x: player.x + dir.x * 26,
        y: player.y + dir.y * 26,
        vx: dir.x * config.projectileSpeed * 0.62 * player.projectileSpeedMult,
        vy: dir.y * config.projectileSpeed * 0.62 * player.projectileSpeedMult,
        radius: (10 + Math.min(18, Math.sqrt(level) * 2.2)) * player.projectileSizeMult,
        damage: rollDamage(damage),
        pierce: player.pierce + 2 + Math.floor(Math.sqrt(level)),
        life: 1.7,
        color: "#78f09a",
        type: "cannon",
        blastRadius: 42 + Math.min(120, endlessScale(level, 12, 30, 0.8)),
      });
    }
  }

  function fireMainHomingAmmo(config) {
    const level = player.ammoHomingLevel;
    const count = Math.min(8, 2 + Math.floor(Math.sqrt(level) * 1.25));
    const damageScale = 1 + endlessScale(level, 0.15, 28, 0.005);
    const damage = config.baseDamage * 0.72 * player.damageMult * player.cannonDamageMult * damageScale;
    for (let i = 0; i < count; i += 1) {
      const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.22;
      const target = findNearestEnemy(player.x + Math.cos(angle) * 120, player.y + Math.sin(angle) * 120, 1180);
      const dir = normalize(Math.cos(angle) * 0.65 + player.lastMoveX * 0.35, Math.sin(angle) * 0.65 + player.lastMoveY * 0.35);
      spawnProjectile({
        x: player.x + dir.x * 20,
        y: player.y + dir.y * 20,
        vx: dir.x * config.projectileSpeed * 0.78 * player.projectileSpeedMult,
        vy: dir.y * config.projectileSpeed * 0.78 * player.projectileSpeedMult,
        radius: 3.2 * player.projectileSizeMult,
        damage: rollDamage(damage),
        pierce: Math.max(0, Math.floor(player.pierce / 2)),
        life: 2.2,
        color: "#ffcf5a",
        type: "cannon",
        target,
        turnRate: 7.4 + Math.min(3.8, endlessScale(level, 0.32, 30, 0.008)),
      });
    }
  }

  function fireMainPlasmaAmmo(config) {
    const level = player.ammoPlasmaLevel;
    const maxJumps = Math.min(7, 2 + Math.floor(Math.sqrt(level)));
    const range = 760 + Math.min(520, endlessScale(level, 68, 32, 1.8));
    const color = "#b98cff";
    const hit = new Set();
    let origin = { x: player.x, y: player.y };
    let target = findNearestEnemy(player.x, player.y, range);
    const baseDamage =
      config.baseDamage * 0.82 * player.damageMult * player.cannonDamageMult * (1 + endlessScale(level, 0.18, 28, 0.006));

    for (let i = 0; i < maxJumps && target; i += 1) {
      hit.add(target.id);
      const damage = rollDamage(baseDamage * (1 - i * 0.1));
      beamLines.push({
        x1: origin.x,
        y1: origin.y,
        x2: target.x,
        y2: target.y,
        color,
        life: 0.16,
        maxLife: 0.16,
        width: 5 + Math.max(0, 4 - i),
      });
      damageEnemy(target, damage.amount, damage.crit && i === 0);
      if (i === 0) target.slowTimer = Math.max(target.slowTimer, 0.45 + Math.min(1.2, endlessScale(level, 0.08, 30, 0.002)));

      origin = target;
      let next = null;
      let best = (240 + Math.min(260, endlessScale(level, 34, 32, 1.1))) ** 2;
      for (const enemy of enemies) {
        if (enemy.dead || hit.has(enemy.id)) continue;
        const d = distSq(origin.x, origin.y, enemy.x, enemy.y);
        if (d < best) {
          best = d;
          next = enemy;
        }
      }
      target = next;
    }
  }

  function fireMainDrillAmmo(config, aim) {
    const level = player.ammoDrillLevel;
    const color = "#f6f7fb";
    const startX = player.x + aim.x * 28;
    const startY = player.y + aim.y * 28;
    const length = 1180 + Math.min(820, endlessScale(level, 86, 36, 2.2));
    const endX = startX + aim.x * length;
    const endY = startY + aim.y * length;
    const width = 14 + Math.min(22, endlessScale(level, 2.4, 36, 0.03));
    const damage =
      config.baseDamage * 4.2 * player.damageMult * player.cannonDamageMult * (1 + endlessScale(level, 0.26, 28, 0.008));
    let hitCount = 0;

    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const lineDist = pointLineDistance(enemy.x, enemy.y, startX, startY, endX, endY);
      if (lineDist < enemy.radius + width) {
        hitCount += 1;
        damageEnemy(enemy, damage * (enemy === state.boss ? 1.15 : 1), false);
      }
    }
    beamLines.push({
      x1: startX,
      y1: startY,
      x2: endX,
      y2: endY,
      color,
      life: 0.24,
      maxLife: 0.24,
      width,
    });
    if (hitCount > 0) state.screenShake = Math.max(state.screenShake, 0.18);
    burst(startX + aim.x * 80, startY + aim.y * 80, color, 12, 3.4);
  }

  function updateMissiles(dt) {
    if (player.missileLevel <= 0) return;
    player.missileTimer -= dt;
    const config = DATA.weapons.missile;
    const interval = config.baseInterval / (Math.sqrt(player.fireRate) * player.missileFireRate);
    if (player.missileTimer > 0) return;
    player.missileTimer = interval;

    const target = findNearestEnemy(player.x, player.y, 1080);
    const aim = target ? normalize(target.x - player.x, target.y - player.y) : { x: 0, y: -1 };
    const volley = Math.min(12, player.missileVolley);
    const arc = Math.min(0.95, 0.16 * (volley - 1));
    const missileFocus = 1 + endlessScale(player.missileLevel, 0.045, 28, 0.002);
    for (let i = 0; i < volley; i += 1) {
      const t = volley === 1 ? 0 : i / (volley - 1) - 0.5;
      const angle = t * arc + rand(-0.05, 0.05);
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const dir = {
        x: aim.x * ca - aim.y * sa,
        y: aim.x * sa + aim.y * ca,
      };
      spawnProjectile({
        x: player.x + dir.x * 18,
        y: player.y + dir.y * 18,
        vx: dir.x * config.projectileSpeed,
        vy: dir.y * config.projectileSpeed,
        radius: 7 * player.projectileSizeMult,
        damage: rollDamage(config.baseDamage * player.damageMult * player.missileDamageMult * missileFocus),
        pierce: 0,
        life: 2.4,
        color: config.color,
        type: "missile",
        blastRadius: Math.min(360, config.blastRadius + player.missileBlastBonus),
        target,
        turnRate: 4.8,
      });
    }
  }

  function updateDrones(dt) {
    if (player.droneCount <= 0) return;
    syncDrones();
    const config = DATA.weapons.drone;
    const radius = 54 + Math.min(42, player.droneCount * 4);
    const droneFocus = 1 + endlessScale(player.droneLevel, 0.16, 30, 0.004);
    for (let i = 0; i < player.drones.length; i += 1) {
      const drone = player.drones[i];
      drone.angle += dt * (1.75 + player.droneCount * 0.05);
      drone.x = player.x + Math.cos(drone.angle) * radius;
      drone.y = player.y + Math.sin(drone.angle) * radius;
      drone.cooldown -= dt;
      if (drone.cooldown <= 0) {
        drone.cooldown = config.baseInterval / (player.fireRate * player.droneFireRate);
        const target = findNearestEnemy(drone.x, drone.y, 720 + Math.min(560, player.droneRangeBonus));
        if (!target) continue;
        const aim = normalize(target.x - drone.x, target.y - drone.y);
        spawnProjectile({
          x: drone.x + aim.x * 8,
          y: drone.y + aim.y * 8,
          vx: aim.x * config.projectileSpeed,
          vy: aim.y * config.projectileSpeed,
          radius: 3.6 * player.projectileSizeMult,
          damage: rollDamage(
            config.baseDamage *
              player.damageMult *
              player.droneDamageMult *
              droneFocus,
          ),
          pierce: player.pierce,
          life: 1.2,
          color: config.color,
          type: "drone",
        });
      }
    }
  }

  function updateSpecialSystems(dt) {
    updateOrbitalLaser(dt);
    updatePlasmaAura(dt);
    updateVortices(dt);
  }

  function updateOrbitalLaser(dt) {
    if (player.orbitalLaserLevel <= 0) return;
    player.orbitalLaserTimer -= dt;
    if (player.orbitalLaserTimer > 0) return;

    const level = player.orbitalLaserLevel;
    const target = findNearestEnemy(player.x, player.y, 1280);
    const cadenceBoost = Math.min(1.7, endlessScale(level, 0.34, 30, 0.01));
    player.orbitalLaserTimer = Math.max(0.58, 2.6 - cadenceBoost) / Math.sqrt(player.fireRate);
    if (!target) return;

    const damage = rollDamage((62 + endlessScale(level, 48, 32, 1.4)) * player.damageMult);
    const startX = target.x + rand(-80, 80);
    const startY = target.y - 760;
    beamLines.push({
      x1: startX,
      y1: startY,
      x2: target.x,
      y2: target.y,
      color: "#ffcf5a",
      life: 0.24,
      maxLife: 0.24,
      width: 10 + Math.min(18, endlessScale(level, 2.4, 34, 0.04)),
    });
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const lineDist = pointLineDistance(enemy.x, enemy.y, startX, startY, target.x, target.y);
      if (lineDist < 42 + Math.min(112, endlessScale(level, 9, 32, 0.35))) {
        damageEnemy(enemy, damage.amount * (enemy === target ? 1 : 0.55), damage.crit && enemy === target);
      }
    }
    burst(target.x, target.y, "#ffcf5a", 28, 5);
  }

  function pointLineDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy || 1;
    const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
    const x = x1 + dx * t;
    const y = y1 + dy * t;
    return Math.hypot(px - x, py - y);
  }

  function updatePlasmaAura(dt) {
    if (player.plasmaAuraLevel <= 0) return;
    player.plasmaAuraTimer -= dt;
    if (player.plasmaAuraTimer > 0) return;
    player.plasmaAuraTimer = 0.22;

    const auraScale = endlessScale(player.plasmaAuraLevel, 1, 28, 0.012);
    const radius = 92 + Math.min(230, auraScale * 25);
    const damage = (7 + auraScale * 5.4) * player.damageMult;
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      if (distSq(enemy.x, enemy.y, player.x, player.y) <= (radius + enemy.radius) ** 2) {
        damageEnemy(enemy, damage, false);
      }
    }
  }

  function spawnVortex(x, y, level, color = "#b98cff") {
    const scale = endlessScale(level, 1, 30, 0.012);
    const life = 3.1 + Math.min(3.4, scale * 0.34);
    vortices.push({
      x,
      y,
      radius: 118 + Math.min(210, scale * 30),
      level,
      color,
      life,
      maxLife: life,
      tick: 0,
    });
  }

  function updateVortices(dt) {
    for (let i = vortices.length - 1; i >= 0; i -= 1) {
      const vortex = vortices[i];
      vortex.life -= dt;
      vortex.tick -= dt;
      for (const enemy of enemies) {
        if (enemy.dead) continue;
        const toCenter = normalize(vortex.x - enemy.x, vortex.y - enemy.y);
        if (toCenter.len > vortex.radius + enemy.radius) continue;
        const pull =
          (1 - toCenter.len / (vortex.radius + enemy.radius)) *
          (260 + Math.min(320, endlessScale(vortex.level, 58, 30, 1.2)));
        enemy.x += toCenter.x * pull * dt;
        enemy.y += toCenter.y * pull * dt;
        enemy.slowTimer = Math.max(enemy.slowTimer, 0.25);
        if (vortex.tick <= 0) {
          damageEnemy(enemy, (9 + Math.min(70, endlessScale(vortex.level, 8.5, 30, 0.2))) * player.damageMult, false);
        }
      }
      if (vortex.tick <= 0) vortex.tick = 0.22;
      if (vortex.life <= 0) vortices.splice(i, 1);
    }
  }

  function syncDrones() {
    while (player.drones.length < player.droneCount) {
      const index = player.drones.length;
      player.drones.push({
        angle: (Math.PI * 2 * index) / Math.max(1, player.droneCount),
        x: player.x,
        y: player.y,
        cooldown: rand(0.05, 0.42),
      });
    }
    if (player.drones.length > player.droneCount) {
      player.drones.length = player.droneCount;
    }
  }

  function rollDamage(baseDamage) {
    const crit = Math.random() < player.critChance;
    return {
      amount: baseDamage * (crit ? player.critDamage : 1) * rand(0.92, 1.08),
      crit,
    };
  }

  function spawnProjectile(config) {
    if (projectiles.length >= C.maxPlayerProjectiles) projectiles.shift();
    projectiles.push({
      id: nextEntityId += 1,
      hit: new Set(),
      ...config,
    });
  }

  function findNearestEnemy(x, y, maxDistance) {
    let best = null;
    let bestDist = maxDistance * maxDistance;
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const d = distSq(x, y, enemy.x, enemy.y);
      if (d < bestDist) {
        bestDist = d;
        best = enemy;
      }
    }
    return best;
  }

  function updateStage(dt) {
    state.stageTime += dt;
    if (state.stagePhase === "clear") {
      state.stageClearTimer -= dt;
      if (state.stageClearTimer <= 0) advanceStage();
    }
    state.stageAnnounce = Math.max(0, state.stageAnnounce - dt);
  }

  function updateCombatFlow(dt) {
    state.grazeTimer = Math.max(0, state.grazeTimer - dt);
    if (state.grazeTimer <= 0) state.grazeStreak = 0;
  }

  function startNextWave() {
    const stage = currentStage();
    if (state.waveIndex >= stage.waves) return;
    state.waveActive = true;
    state.waveKills = 0;
    state.waveTarget = waveTargetFor(state.waveIndex);
    state.waveSpawnRemaining = state.waveTarget;
    state.waveSpawnTimer = 0;
    state.bountyPending = state.waveIndex >= 1 && state.waveIndex % 3 === 1;
    state.bountyActive = false;
    state.bountyTimer = state.bountyPending ? rand(5.2, 8.4) : 0;
    state.bountyTargetId = null;
    state.screenShake = Math.max(state.screenShake, 0.08);
    floatTexts.push({
      x: player.x,
      y: player.y - 42,
      value: `第 ${state.waveIndex + 1} 波`,
      color: stage.accent,
      life: 0.9,
      maxLife: 0.9,
      size: 20,
    });
  }

  function completeWave() {
    const stage = currentStage();
    state.waveActive = false;
    state.waveIndex += 1;
    state.waveKills = 0;
    state.waveTarget = 0;
    state.waveSpawnRemaining = 0;
    state.waveSpawnTimer = 0;
    state.bountyPending = false;
    state.bountyActive = false;
    state.bountyTimer = 0;
    state.bountyTargetId = null;
    state.waveBreakTimer = state.waveIndex >= stage.waves ? 2.2 : 1.15;
    state.score += 18 + state.stageIndex * 4 + state.waveIndex * 2;
    player.hp = Math.min(player.maxHp, player.hp + 4 + Math.floor(state.stageIndex / 2));
    if (state.waveIndex % 3 === 0) {
      player.shield = Math.min(player.maxShield, player.shield + 8 + state.stageIndex);
    }
    floatTexts.push({
      x: player.x,
      y: player.y - 36,
      value: state.waveIndex >= stage.waves ? "波次完成" : "清波",
      color: stage.accent,
      life: 0.72,
      maxLife: 0.72,
      size: 17,
    });
  }

  function spawnStageBoss() {
    const stage = currentStage();
    const final = isFinalStage();
    state.bossSpawned = true;
    state.stagePhase = "boss";
    state.bountyPending = false;
    state.bountyActive = false;
    state.bountyTimer = 0;
    state.bountyTargetId = null;
    state.screenShake = Math.max(state.screenShake, final ? 0.7 : 0.44);
    collectLoosePickups();
    for (const enemy of enemies) enemy.dead = true;
    enemyProjectiles.length = 0;
    hazards.length = 0;
    player.hp = Math.min(player.maxHp, player.hp + 14 + state.stageIndex * 2);
    player.shield = Math.min(player.maxShield, player.shield + 18 + state.stageIndex * 2);
    burst(player.x, player.y, stage.accent, final ? 54 : 36, final ? 4.5 : 3.4);
    spawnEnemy(final ? "boss" : stage.miniBossType, {
      boss: final,
      stageBoss: !final,
      name: final ? DATA.enemies.boss.name : stage.miniBossName,
    });
  }

  function completeStage(enemy) {
    const stage = currentStage();
    state.stagePhase = "clear";
    state.stageClearTimer = STAGE_CLEAR_DELAY;
    state.boss = null;
    state.score += 180 + state.stageIndex * 70;
    player.hp = Math.min(player.maxHp, player.hp + 16 + state.stageIndex * 2);
    player.shield = Math.min(player.maxShield, player.shield + 14 + state.stageIndex * 2);
    state.screenShake = Math.max(state.screenShake, 0.45);
    for (const foe of enemies) {
      if (foe !== enemy) foe.dead = true;
    }
    enemyProjectiles.length = 0;
    hazards.length = 0;
    vortices.length = 0;
    burst(enemy.x, enemy.y, stage.accent, 64, 5.2);
    floatTexts.push({
      x: player.x,
      y: player.y - 38,
      value: "关卡完成",
      color: stage.accent,
      life: 1,
      maxLife: 1,
      size: 22,
    });
  }

  function advanceStage() {
    if (isFinalStage()) return;
    state.stageIndex += 1;
    state.stageTime = 0;
    state.stageKills = 0;
    state.waveIndex = 0;
    state.waveActive = false;
    state.waveKills = 0;
    state.waveTarget = 0;
    state.waveSpawnRemaining = 0;
    state.waveSpawnTimer = 0;
    state.waveBreakTimer = 0;
    state.bountyPending = false;
    state.bountyActive = false;
    state.bountyTimer = 0;
    state.bountyTargetId = null;
    state.stagePhase = "fight";
    state.stageClearTimer = 0;
    state.boss = null;
    state.bossSpawned = false;
    state.spawnTimer = 0.7;
    state.eliteTimer = Math.max(12, 34 - state.stageIndex * 2);
    state.hazardTimer = 2.5;
    state.cacheTimer = 1.1;
    state.stageAnnounce = 3.2;
    player.x = world.w * 0.5;
    player.y = world.h * 0.64;
    pointer.hasTarget = false;
    camera.x = player.x;
    camera.y = player.y;
    clampCamera();
    projectiles.length = 0;
    enemyProjectiles.length = 0;
    enemies.length = 0;
    hazards.length = 0;
    vortices.length = 0;
    burst(player.x, player.y, currentStage().accent, 38, 3.2);
  }

  function updateEnvironment(dt) {
    const stage = currentStage();
    state.cacheTimer -= dt;
    state.hazardTimer -= dt;
    state.stormPulse = Math.max(0, state.stormPulse - dt);

    if (state.stagePhase === "clear" || (state.stagePhase === "fight" && !state.waveActive)) {
      updateHazards(dt);
      return;
    }

    if (state.cacheTimer <= 0) {
      spawnSupplyCache();
      state.cacheTimer = 9999;
    }

    if (state.hazardTimer <= 0) {
      if (stage.hazard === "meteor") {
        spawnMeteor();
        state.hazardTimer = rand(3.2, 5.4);
      } else if (stage.hazard === "storm") {
        triggerStormPulse();
        state.hazardTimer = rand(6.5, 9.2);
      } else if (stage.hazard === "rift") {
        triggerRiftWave();
        state.hazardTimer = rand(5.8, 8.4);
      } else {
        state.hazardTimer = rand(8, 12);
      }
    }

    updateHazards(dt);
  }

  function spawnSupplyCache() {
    const bounds = visibleWorldBounds(-120);
    pickups.push({
      kind: "cache",
      x: clamp(rand(bounds.left, bounds.right), 80, world.w - 80),
      y: clamp(rand(bounds.top, bounds.bottom), 80, world.h - 80),
      vx: 0,
      vy: 0,
      value: 22 + state.stageIndex * 8,
      spin: 0,
      radius: 13,
      color: currentStage().accent,
    });
  }

  function spawnMeteor() {
    const bounds = visibleWorldBounds(220);
    const fromLeft = Math.random() < 0.5;
    const angle = fromLeft ? rand(-0.42, 0.42) : Math.PI + rand(-0.42, 0.42);
    const speed = rand(290, 420);
    hazards.push({
      kind: "meteor",
      x: fromLeft ? bounds.left : bounds.right,
      y: rand(bounds.top, bounds.bottom),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed + rand(-80, 80),
      radius: rand(18, 32),
      damage: 24 + state.stageIndex * 3,
      life: 6,
      hit: new Set(),
      color: currentStage().accent,
    });
  }

  function triggerStormPulse() {
    state.stormPulse = 0.9;
    state.screenShake = Math.max(state.screenShake, 0.26);
    const damage = 22 + state.stageIndex * 5;
    for (const enemy of enemies) {
      if (!enemy.dead && distSq(enemy.x, enemy.y, player.x, player.y) < 520 * 520) {
        damageEnemy(enemy, damage * player.damageMult, false);
      }
    }
    if (player.invuln <= 0) damagePlayer(8 + state.stageIndex);
    burst(player.x, player.y, currentStage().accent, 42, 4);
  }

  function triggerRiftWave() {
    const count = 2 + Math.floor(state.stageIndex / 3);
    for (let i = 0; i < count; i += 1) {
      spawnEnemy(i % 2 === 0 ? "chaser" : "strafe", { mini: true });
    }
    burst(player.x + rand(-220, 220), player.y + rand(-180, 180), currentStage().accent, 22, 2.8);
  }

  function updateHazards(dt) {
    const bounds = visibleWorldBounds(360);
    for (let i = hazards.length - 1; i >= 0; i -= 1) {
      const hazard = hazards[i];
      hazard.life -= dt;

      if (hazard.kind === "shockwave") {
        const previousRadius = hazard.radius;
        hazard.radius = Math.min(hazard.maxRadius, hazard.radius + hazard.speed * dt);
        const distance = Math.hypot(player.x - hazard.x, player.y - hazard.y);
        const hitBand = hazard.band + player.radius;
        if (!hazard.hitPlayer && distance <= hazard.radius + hitBand && distance >= previousRadius - hitBand) {
          hazard.hitPlayer = true;
          damagePlayer(hazard.damage);
          const push = normalize(player.x - hazard.x, player.y - hazard.y);
          player.x = clamp(player.x + push.x * 28, 28, world.w - 28);
          player.y = clamp(player.y + push.y * 28, 28, world.h - 28);
        }
        if (Math.random() < 0.4) {
          const angle = rand(0, Math.PI * 2);
          puff(
            hazard.x + Math.cos(angle) * hazard.radius,
            hazard.y + Math.sin(angle) * hazard.radius,
            hazard.color,
            1,
          );
        }
        if (hazard.life <= 0 || hazard.radius >= hazard.maxRadius) hazards.splice(i, 1);
        continue;
      }

      if (hazard.kind === "bossGravity") {
        hazard.tick -= dt;
        const toCenter = normalize(hazard.x - player.x, hazard.y - player.y);
        if (toCenter.len < hazard.radius + player.radius) {
          const pull = (1 - toCenter.len / (hazard.radius + player.radius)) * 320;
          player.x = clamp(player.x + toCenter.x * pull * dt, 28, world.w - 28);
          player.y = clamp(player.y + toCenter.y * pull * dt, 28, world.h - 28);
          if (hazard.tick <= 0) {
            damagePlayer(hazard.damage);
            hazard.tick = 0.42;
          }
        }
        if (Math.random() < 0.7) {
          const angle = rand(0, Math.PI * 2);
          puff(
            hazard.x + Math.cos(angle) * rand(18, hazard.radius),
            hazard.y + Math.sin(angle) * rand(18, hazard.radius),
            hazard.color,
            1,
          );
        }
        if (hazard.life <= 0) hazards.splice(i, 1);
        continue;
      }

      hazard.x += hazard.vx * dt;
      hazard.y += hazard.vy * dt;
      puff(hazard.x - hazard.vx * 0.018, hazard.y - hazard.vy * 0.018, hazard.color, 1);

      if (distSq(hazard.x, hazard.y, player.x, player.y) < (hazard.radius + player.radius) ** 2) {
        damagePlayer(hazard.damage);
      }

      for (const enemy of enemies) {
        if (enemy.dead || hazard.hit.has(enemy.id)) continue;
        if (distSq(hazard.x, hazard.y, enemy.x, enemy.y) < (hazard.radius + enemy.radius) ** 2) {
          hazard.hit.add(enemy.id);
          damageEnemy(enemy, hazard.damage * 2.4, false);
        }
      }

      if (
        hazard.life <= 0 ||
        hazard.x < bounds.left ||
        hazard.x > bounds.right ||
        hazard.y < bounds.top ||
        hazard.y > bounds.bottom
      ) {
        hazards.splice(i, 1);
      }
    }
  }

  function updateSpawn(dt) {
    if (state.stagePhase === "clear") return;
    if (state.boss) return;

    const stage = currentStage();
    if (state.waveBreakTimer > 0) {
      state.waveBreakTimer = Math.max(0, state.waveBreakTimer - dt);
      return;
    }

    if (!state.bossSpawned && stageReadyForBoss()) {
      spawnStageBoss();
      return;
    }

    if (!state.waveActive) {
      startNextWave();
    }

    updateBounty(dt);

    state.waveSpawnTimer -= dt;
    if (state.waveSpawnRemaining > 0 && state.waveSpawnTimer <= 0 && enemies.length < C.maxEnemies) {
      const count = Math.max(
        1,
        Math.min(
          state.waveSpawnRemaining,
          Math.floor(rand(5, 9 + state.stageIndex * 0.65 + state.waveIndex * 0.14) * stage.spawnMult),
        ),
      );
      for (let i = 0; i < count; i += 1) {
        const elite =
          state.waveIndex >= 2 &&
          state.waveSpawnRemaining <= Math.ceil(state.waveTarget * 0.4) &&
          Math.random() < 0.08 + state.stageIndex * 0.012;
        spawnEnemy(pickEnemyType(), { elite });
      }
      state.waveSpawnRemaining -= count;
      state.waveSpawnTimer = clamp((0.56 - state.stageIndex * 0.018 - state.waveIndex * 0.006) / stage.spawnMult, 0.12, 0.56);
    }

    if (state.waveActive && state.waveSpawnRemaining <= 0 && aliveNonBossCount() === 0) {
      completeWave();
    }
  }

  function pickEnemyType() {
    const t = state.stageTime + state.stageIndex * 18 + state.waveIndex * 7;
    const stage = currentStage();
    const s = state.stageIndex;
    const bias = stage.bias || {};
    const options = [{ type: "chaser", weight: 1.2 * (bias.chaser || 1) }];
    if (t > 18 || s >= 1) options.push({ type: "strafe", weight: (0.48 + t / 500) * (bias.strafe || 1) });
    if (t > 38 || s >= 2) options.push({ type: "shooter", weight: (0.42 + t / 650) * (bias.shooter || 1) });
    if (t > 68 || s >= 3) options.push({ type: "splitter", weight: (0.34 + t / 820) * (bias.splitter || 1) });
    if (t > 96 || s >= 4) options.push({ type: "armored", weight: (0.24 + t / 1100) * (bias.armored || 1) });
    return weightedPick(options, (item) => item.weight).type;
  }

  function updateBounty(dt) {
    if (!state.bountyPending || state.bountyActive || state.stagePhase !== "fight") return;
    if (!state.waveActive || state.waveSpawnRemaining <= Math.ceil(state.waveTarget * 0.2)) return;
    state.bountyTimer = Math.max(0, state.bountyTimer - dt);
    if (state.bountyTimer <= 0) spawnBountyTarget();
  }

  function spawnBountyTarget() {
    const options = [
      { type: "shooter", weight: 1 },
      { type: "strafe", weight: 0.85 },
      { type: "armored", weight: 0.7 + state.stageIndex * 0.05 },
      { type: "splitter", weight: state.stageIndex >= 3 ? 0.55 : 0 },
    ];
    const type = weightedPick(options, (item) => item.weight).type;
    const enemy = spawnEnemy(type, { bounty: true, elite: true });
    state.bountyPending = false;
    state.bountyActive = true;
    state.bountyTargetId = enemy.id;
    state.screenShake = Math.max(state.screenShake, 0.22);
    floatTexts.push({
      x: player.x,
      y: player.y - 50,
      value: "悬赏目标",
      color: "#ffcf5a",
      life: 1.1,
      maxLife: 1.1,
      size: 21,
    });
  }

  function spawnEnemy(type, options = {}) {
    const cfg = DATA.enemies[type];
    const finalBoss = options.boss || type === "boss";
    const stageBoss = Boolean(options.stageBoss);
    const bossEntity = finalBoss || stageBoss;
    const pos = options.x != null ? { x: options.x, y: options.y } : spawnPosition(bossEntity);
    const stage = currentStage();
    const timeHp = bossEntity ? 1 : (1 + state.time / 195) * stage.hpMult;
    const timeSpeed = bossEntity ? 1 : (1 + state.time / 980) * stage.speedMult;
    const bossPower = bossEntity ? BOSS_POWER_MULT : 1;
    const stageEnemyHpMult = bossEntity ? 1 : STAGE_ENEMY_HP_GROWTH ** state.stageIndex;
    const elite = Boolean(options.elite);
    const mini = Boolean(options.mini);
    const bounty = Boolean(options.bounty);
    const hp = (stageBoss
      ? (360 + state.stageIndex * 180) * stage.hpMult * bossPower * STAGE_BOSS_HP_MULT
      : cfg.hp * timeHp * stageEnemyHpMult * (elite ? 4.2 : 1) * (mini ? 0.42 : 1)) * (bounty ? 5.2 + state.stageIndex * 0.35 : 1);
    const radius = stageBoss
      ? Math.max(34 + state.stageIndex * 2.2, cfg.radius * 2.05)
      : cfg.radius * (elite ? 1.18 : 1) * (mini ? 0.72 : 1) * (bounty ? 1.28 : 1);

    const enemy = {
      id: nextEntityId += 1,
      type,
      behavior: cfg.behavior,
      name: options.name || cfg.name,
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      hp,
      maxHp: hp,
      speed: cfg.speed * timeSpeed * (elite ? 1.12 : 1) * (mini ? 1.22 : 1) * (stageBoss ? 0.72 : 1),
      radius,
      damage: stageBoss
        ? cfg.damage * (0.9 + state.stageIndex * 0.13) * bossPower
        : cfg.damage * (finalBoss ? bossPower : 1) * (elite ? 1.55 : 1) * (mini ? 0.7 : 1) * (bounty ? 1.22 : 1),
      xp: stageBoss ? 90 + state.stageIndex * 34 : cfg.xp * (elite ? 3.2 : 1) * (mini ? 0.36 : 1) * (bounty ? 3.5 : 1),
      score: stageBoss ? 280 + state.stageIndex * 90 : Math.floor(cfg.score * (elite ? 2.8 : 1) * (mini ? 0.35 : 1) * (bounty ? 5 : 1)),
      color: bounty ? "#ffcf5a" : stageBoss ? stage.accent : elite ? "#ffcf5a" : cfg.color,
      elite,
      mini,
      bounty,
      stageBoss,
      bossKind: finalBoss ? "final" : stageBoss ? "stage" : null,
      bossPower,
      damageTakenMult: bossEntity ? BOSS_DAMAGE_TAKEN_MULT : 1,
      dead: false,
      age: 0,
      flash: 0,
      slowTimer: 0,
      shootTimer: rand(0.4, 1.8),
      radialTimer: 1.6,
      aimTimer: 0.8,
      summonTimer: 5.5,
      laserTimer: bossEntity ? rand(1.8, 3.1) : 999,
      shockwaveTimer: bossEntity ? rand(3.4, 5.2) : 999,
      blinkTimer: bossEntity ? rand(5.6, 8.2) : 999,
      wobble: rand(0, Math.PI * 2),
      strafeSide: Math.random() < 0.5 ? -1 : 1,
    };

    enemies.push(enemy);
    if (bossEntity) state.boss = enemy;
    return enemy;
  }

  function spawnPosition(isBoss) {
    const bounds = visibleWorldBounds(140);
    if (isBoss) {
      return {
        x: clamp(player.x, 120, world.w - 120),
        y: clamp(bounds.top - 80, 90, world.h - 160),
      };
    }
    const margin = 90;
    const side = Math.floor(Math.random() * 4);
    if (side === 0) {
      return {
        x: clamp(rand(bounds.left, bounds.right), margin, world.w - margin),
        y: clamp(bounds.top, margin, world.h - margin),
      };
    }
    if (side === 1) {
      return {
        x: clamp(bounds.right, margin, world.w - margin),
        y: clamp(rand(bounds.top, bounds.bottom), margin, world.h - margin),
      };
    }
    if (side === 2) {
      return {
        x: clamp(rand(bounds.left, bounds.right), margin, world.w - margin),
        y: clamp(bounds.bottom, margin, world.h - margin),
      };
    }
    return {
      x: clamp(bounds.left, margin, world.w - margin),
      y: clamp(rand(bounds.top, bounds.bottom), margin, world.h - margin),
    };
  }

  function updateEnemies(dt) {
    for (const enemy of enemies) {
      enemy.age += dt;
      enemy.flash = Math.max(0, enemy.flash - dt);
      enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
      if (enemy.behavior === "boss") {
        updateBoss(enemy, dt);
        continue;
      }

      const toPlayer = normalize(player.x - enemy.x, player.y - enemy.y);
      let ax = toPlayer.x;
      let ay = toPlayer.y;

      if (enemy.behavior === "strafe") {
        ax = toPlayer.x * 0.8 + -toPlayer.y * enemy.strafeSide * 0.78;
        ay = toPlayer.y * 0.8 + toPlayer.x * enemy.strafeSide * 0.78;
      } else if (enemy.behavior === "shooter") {
        enemy.shootTimer -= dt;
        if (toPlayer.len < 235) {
          ax = -toPlayer.x;
          ay = -toPlayer.y;
        } else if (toPlayer.len > 350) {
          ax = toPlayer.x;
          ay = toPlayer.y;
        } else {
          ax = -toPlayer.y * enemy.strafeSide;
          ay = toPlayer.x * enemy.strafeSide;
        }
        if (enemy.shootTimer <= 0) {
          fireAimedEnemyBullet(enemy, 250 + state.time * 0.08, 4.5);
          enemy.shootTimer = rand(1.35, 2.15);
        }
      }

      const dir = normalize(ax, ay);
      const slowScale = player.enemySlowMult * (player.timeSlowTimer > 0 ? 0.38 : 1) * (enemy.slowTimer > 0 ? 0.45 : 1);
      enemy.vx += (dir.x * enemy.speed * slowScale - enemy.vx) * Math.min(1, dt * 4);
      enemy.vy += (dir.y * enemy.speed * slowScale - enemy.vy) * Math.min(1, dt * 4);
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      if (enemy.stageBoss) updateStageBoss(enemy, dt);
    }
  }

  function updateStageBoss(enemy, dt) {
    const phase = enemy.hp / enemy.maxHp < 0.45 ? 2 : 1;
    const rank = state.stageIndex;
    enemy.radialTimer -= dt;
    enemy.aimTimer -= dt;
    enemy.summonTimer -= dt;

    if (enemy.radialTimer <= 0) {
      fireRadial(enemy, phase === 2 ? 8 + rank : 6 + rank, 120 + rank * 12);
      enemy.radialTimer = phase === 2 ? 2.05 : 2.85;
    }
    if (enemy.aimTimer <= 0) {
      const shots = phase === 2 ? 2 : 1;
      for (let i = 0; i < shots; i += 1) {
        const offset = (i - (shots - 1) / 2) * 0.18;
        fireAimedEnemyBullet(enemy, 210 + rank * 12, 4.8, offset);
      }
      enemy.aimTimer = phase === 2 ? 1.15 : 1.65;
    }
    if (rank > 0 && enemy.summonTimer <= 0 && enemies.length < C.maxEnemies - 4) {
      const adds = phase === 2 ? 3 : 2;
      for (let i = 0; i < adds; i += 1) {
        spawnEnemy(i % 2 === 0 ? "chaser" : "strafe", {
          x: enemy.x + rand(-90, 90),
          y: enemy.y + rand(35, 110),
          mini: true,
        });
      }
      enemy.summonTimer = phase === 2 ? 5.4 : 7.2;
    }
    updateBossSpecials(enemy, dt, phase, false);
  }

  function updateBoss(enemy, dt) {
    const targetX = clamp(player.x + Math.sin(enemy.age * 0.65) * 360, 130, world.w - 130);
    const targetY = clamp(player.y - 330 + Math.sin(enemy.age * 1.1) * 32, 120, world.h - 180);
    const toTarget = normalize(targetX - enemy.x, targetY - enemy.y);
    enemy.vx += (toTarget.x * enemy.speed - enemy.vx) * Math.min(1, dt * 2.2);
    enemy.vy += (toTarget.y * enemy.speed - enemy.vy) * Math.min(1, dt * 2.2);
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;

    const phase = enemy.hp / enemy.maxHp < 0.48 ? 2 : 1;
    enemy.radialTimer -= dt;
    enemy.aimTimer -= dt;
    enemy.summonTimer -= dt;

    if (enemy.radialTimer <= 0) {
      fireRadial(enemy, phase === 2 ? 22 : 15, phase === 2 ? 220 : 180);
      enemy.radialTimer = phase === 2 ? 1.45 : 2.1;
    }
    if (enemy.aimTimer <= 0) {
      const shots = phase === 2 ? 3 : 1;
      for (let i = 0; i < shots; i += 1) {
        const offset = (i - (shots - 1) / 2) * 0.16;
        fireAimedEnemyBullet(enemy, phase === 2 ? 330 : 285, 5.5, offset);
      }
      enemy.aimTimer = phase === 2 ? 0.52 : 0.78;
    }
    if (enemy.summonTimer <= 0) {
      for (let i = 0; i < (phase === 2 ? 5 : 3); i += 1) {
        spawnEnemy(i % 2 === 0 ? "chaser" : "strafe", {
          x: enemy.x + rand(-80, 80),
          y: enemy.y + rand(30, 85),
          mini: true,
        });
      }
      enemy.summonTimer = phase === 2 ? 6.8 : 8.4;
    }
    updateBossSpecials(enemy, dt, phase, true);
  }

  function updateBossSpecials(enemy, dt, phase, finalBoss) {
    if (!finalBoss) {
      updateStageBossPattern(enemy, dt, phase);
      return;
    }
    const rank = state.stageIndex;
    const cadence = Math.sqrt(enemy.bossPower || BOSS_POWER_MULT);
    enemy.laserTimer -= dt;
    enemy.shockwaveTimer -= dt;
    enemy.blinkTimer -= dt;

    if (enemy.laserTimer <= 0) {
      const beams = finalBoss ? (phase === 2 ? 4 : 3) : phase === 2 ? 3 : 2;
      for (let i = 0; i < beams; i += 1) {
        fireBossLaser(enemy, i, beams, finalBoss);
      }
      enemy.laserTimer = (finalBoss ? (phase === 2 ? 2.3 : 3.05) : phase === 2 ? 3.15 : 4.2) / cadence;
    }

    if (enemy.shockwaveTimer <= 0) {
      spawnBossShockwave(enemy, phase, finalBoss);
      enemy.shockwaveTimer = (finalBoss ? (phase === 2 ? 3.6 : 4.8) : phase === 2 ? 4.6 : 6.2) / cadence;
    }

    if ((finalBoss || rank >= 2) && enemy.blinkTimer <= 0) {
      bossPhaseShift(enemy, phase, finalBoss);
      enemy.blinkTimer = (finalBoss ? (phase === 2 ? 5.6 : 7.2) : phase === 2 ? 7.4 : 9.2) / cadence;
    }
  }

  function updateStageBossPattern(enemy, dt, phase) {
    const pattern = state.stageIndex % 9;
    const cadence = Math.sqrt(enemy.bossPower || BOSS_POWER_MULT);
    enemy.laserTimer -= dt;
    enemy.shockwaveTimer -= dt;
    enemy.blinkTimer -= dt;

    if (pattern === 0) {
      if (enemy.laserTimer <= 0) {
        for (let i = 0; i < (phase === 2 ? 3 : 2); i += 1) fireBossLaser(enemy, i, phase === 2 ? 3 : 2, false);
        enemy.laserTimer = (phase === 2 ? 3.1 : 4.2) / cadence;
      }
      if (enemy.shockwaveTimer <= 0) {
        spawnBossShockwave(enemy, phase, false);
        enemy.shockwaveTimer = (phase === 2 ? 4.6 : 6.2) / cadence;
      }
      return;
    }

    if (pattern === 1) {
      if (enemy.laserTimer <= 0) {
        fireBossPlasmaRain(enemy, phase === 2 ? 24 : 16);
        enemy.laserTimer = (phase === 2 ? 2.6 : 3.5) / cadence;
      }
      if (enemy.shockwaveTimer <= 0) {
        fireRadial(enemy, phase === 2 ? 18 : 12, 145 + state.stageIndex * 10);
        enemy.shockwaveTimer = (phase === 2 ? 3.7 : 5.1) / cadence;
      }
      return;
    }

    if (pattern === 2) {
      if (enemy.laserTimer <= 0) {
        fireBossCrystalCage(enemy, phase);
        enemy.laserTimer = (phase === 2 ? 3.7 : 5) / cadence;
      }
      if (enemy.shockwaveTimer <= 0) {
        fireBossSpiral(enemy, phase === 2 ? 28 : 20, 135 + state.stageIndex * 8, currentStage().accent);
        enemy.shockwaveTimer = (phase === 2 ? 4.3 : 5.6) / cadence;
      }
      return;
    }

    if (pattern === 3) {
      if (enemy.laserTimer <= 0) {
        fireBossCrossLasers(enemy, phase);
        enemy.laserTimer = (phase === 2 ? 3.4 : 4.8) / cadence;
      }
      if (enemy.shockwaveTimer <= 0) {
        fireBossPlasmaRain(enemy, phase === 2 ? 14 : 9);
        enemy.shockwaveTimer = (phase === 2 ? 4.2 : 5.4) / cadence;
      }
      return;
    }

    if (pattern === 4) {
      if (enemy.shockwaveTimer <= 0) {
        fireBossFrostRings(enemy, phase);
        enemy.shockwaveTimer = (phase === 2 ? 3.4 : 4.6) / cadence;
      }
      if (enemy.laserTimer <= 0) {
        fireBossCrystalCage(enemy, phase);
        enemy.laserTimer = (phase === 2 ? 5.2 : 6.4) / cadence;
      }
      return;
    }

    if (pattern === 5) {
      if (enemy.blinkTimer <= 0) {
        bossChargeSlam(enemy, phase);
        enemy.blinkTimer = (phase === 2 ? 4.8 : 6.4) / cadence;
      }
      if (enemy.laserTimer <= 0) {
        fireRadial(enemy, phase === 2 ? 20 : 14, 160 + state.stageIndex * 10);
        enemy.laserTimer = (phase === 2 ? 3.2 : 4.5) / cadence;
      }
      return;
    }

    if (pattern === 6) {
      if (enemy.shockwaveTimer <= 0) {
        spawnBossGravityWell(enemy, phase);
        enemy.shockwaveTimer = (phase === 2 ? 4.6 : 6.2) / cadence;
      }
      if (enemy.laserTimer <= 0) {
        fireBossSpiral(enemy, phase === 2 ? 34 : 24, 150 + state.stageIndex * 9, currentStage().accent);
        enemy.laserTimer = (phase === 2 ? 3.2 : 4.3) / cadence;
      }
      return;
    }

    if (pattern === 7) {
      if (enemy.laserTimer <= 0) {
        fireBossLaserGrid(enemy, phase);
        enemy.laserTimer = (phase === 2 ? 4.1 : 5.6) / cadence;
      }
      if (enemy.blinkTimer <= 0) {
        bossPhaseShift(enemy, phase, false);
        enemy.blinkTimer = (phase === 2 ? 6.4 : 8.4) / cadence;
      }
      return;
    }

    if (enemy.blinkTimer <= 0) {
      bossAceDash(enemy, phase);
      enemy.blinkTimer = (phase === 2 ? 3.8 : 5.2) / cadence;
    }
    if (enemy.laserTimer <= 0) {
      fireBossAceFan(enemy, phase);
      enemy.laserTimer = (phase === 2 ? 2.5 : 3.4) / cadence;
    }
  }

  function fireBossLaser(enemy, index, total, finalBoss) {
    const stage = currentStage();
    const aim = normalize(player.x - enemy.x, player.y - enemy.y);
    const offset = total <= 1 ? 0 : (index - (total - 1) / 2) * (finalBoss ? 0.18 : 0.22);
    const ca = Math.cos(offset);
    const sa = Math.sin(offset);
    const dir = {
      x: aim.x * ca - aim.y * sa,
      y: aim.x * sa + aim.y * ca,
    };
    const startX = enemy.x + dir.x * enemy.radius * 0.6;
    const startY = enemy.y + dir.y * enemy.radius * 0.6;
    const length = finalBoss ? 1500 : 1180 + state.stageIndex * 36;
    const endX = startX + dir.x * length;
    const endY = startY + dir.y * length;
    const color = finalBoss ? "#ff4f9a" : stage.accent;
    const width = finalBoss ? 18 : 13 + state.stageIndex * 0.55;

    beamLines.push({
      x1: startX,
      y1: startY,
      x2: endX,
      y2: endY,
      color,
      life: 0.34,
      maxLife: 0.34,
      width,
    });

    for (let i = 0; i < 8; i += 1) {
      const t = rand(0.08, 0.96);
      puff(startX + (endX - startX) * t, startY + (endY - startY) * t, color, 1);
    }

    const hitWidth = player.radius + width * 1.65;
    if (pointLineDistance(player.x, player.y, startX, startY, endX, endY) < hitWidth) {
      damagePlayer(enemy.damage * (finalBoss ? 0.76 : 0.58));
    }
    state.screenShake = Math.max(state.screenShake, finalBoss ? 0.26 : 0.18);
  }

  function spawnBossShockwave(enemy, phase, finalBoss) {
    const color = finalBoss ? "#ffcf5a" : currentStage().accent;
    const maxRadius = finalBoss ? (phase === 2 ? 620 : 540) : 410 + state.stageIndex * 22 + (phase === 2 ? 90 : 0);
    const speed = finalBoss ? (phase === 2 ? 560 : 500) : 420 + state.stageIndex * 16 + (phase === 2 ? 70 : 0);
    const life = maxRadius / speed + 0.18;
    hazards.push({
      kind: "shockwave",
      x: enemy.x,
      y: enemy.y,
      radius: enemy.radius * 0.72,
      maxRadius,
      speed,
      band: finalBoss ? 30 : 24,
      damage: enemy.damage * (finalBoss ? 0.68 : 0.52),
      life,
      maxLife: life,
      hitPlayer: false,
      color,
    });
    burst(enemy.x, enemy.y, color, finalBoss ? 54 : 38, finalBoss ? 5.4 : 4.2);
    state.screenShake = Math.max(state.screenShake, finalBoss ? 0.42 : 0.3);
  }

  function bossPhaseShift(enemy, phase, finalBoss) {
    const stage = currentStage();
    const oldX = enemy.x;
    const oldY = enemy.y;
    const bounds = visibleWorldBounds(-80);
    const targetX = clamp(player.x + rand(-430, 430), Math.max(120, bounds.left), Math.min(world.w - 120, bounds.right));
    const targetY = clamp(player.y - rand(230, 430), Math.max(120, bounds.top), Math.min(world.h - 150, bounds.bottom));
    const color = finalBoss ? "#b98cff" : stage.accent;

    beamLines.push({
      x1: oldX,
      y1: oldY,
      x2: targetX,
      y2: targetY,
      color,
      life: 0.42,
      maxLife: 0.42,
      width: finalBoss ? 15 : 11,
    });
    burst(oldX, oldY, color, finalBoss ? 34 : 24, 3.6);

    enemy.x = targetX;
    enemy.y = targetY;
    enemy.vx = 0;
    enemy.vy = 0;

    burst(enemy.x, enemy.y, color, finalBoss ? 48 : 34, finalBoss ? 4.8 : 4);
    fireRadial(enemy, finalBoss ? (phase === 2 ? 28 : 21) : 12 + state.stageIndex + (phase === 2 ? 5 : 0), finalBoss ? 250 : 176 + state.stageIndex * 10);
    state.screenShake = Math.max(state.screenShake, finalBoss ? 0.36 : 0.24);
  }

  function spawnEnemyProjectile(config) {
    if (enemyProjectiles.length >= C.maxEnemyProjectiles) return;
    enemyProjectiles.push({
      x: config.x,
      y: config.y,
      vx: config.vx,
      vy: config.vy,
      radius: config.radius,
      damage: config.damage,
      life: config.life ?? 4.2,
      color: config.color || currentStage().accent,
    });
  }

  function fireBossPlasmaRain(enemy, count) {
    const bounds = visibleWorldBounds(180);
    const color = currentStage().accent;
    for (let i = 0; i < count; i += 1) {
      const targetX = clamp(player.x + rand(-360, 360), 80, world.w - 80);
      const targetY = clamp(player.y + rand(-220, 260), 80, world.h - 80);
      const startX = clamp(targetX + rand(-180, 180), bounds.left, bounds.right);
      const startY = bounds.top - rand(40, 160);
      const dir = normalize(targetX - startX, targetY - startY);
      spawnEnemyProjectile({
        x: startX,
        y: startY,
        vx: dir.x * rand(260, 360),
        vy: dir.y * rand(260, 360),
        radius: rand(4.8, 7.2),
        damage: enemy.damage * 0.48,
        life: 5,
        color,
      });
      if (i % 4 === 0) {
        beamLines.push({
          x1: startX,
          y1: startY,
          x2: targetX,
          y2: targetY,
          color,
          life: 0.18,
          maxLife: 0.18,
          width: 4,
        });
      }
    }
    state.screenShake = Math.max(state.screenShake, 0.18);
  }

  function fireBossCrystalCage(enemy, phase) {
    const color = currentStage().accent;
    const count = phase === 2 ? 22 : 16;
    const radius = phase === 2 ? 430 : 360;
    for (let i = 0; i < count; i += 1) {
      const angle = enemy.age * 0.18 + (Math.PI * 2 * i) / count;
      const x = clamp(player.x + Math.cos(angle) * radius, 60, world.w - 60);
      const y = clamp(player.y + Math.sin(angle) * radius, 60, world.h - 60);
      const dir = normalize(player.x - x, player.y - y);
      spawnEnemyProjectile({
        x,
        y,
        vx: dir.x * (phase === 2 ? 190 : 155),
        vy: dir.y * (phase === 2 ? 190 : 155),
        radius: 6.2,
        damage: enemy.damage * 0.44,
        life: 5.4,
        color,
      });
    }
    burst(player.x, player.y, color, 16, 2);
  }

  function fireBossSpiral(enemy, count, speed, color) {
    for (let i = 0; i < count; i += 1) {
      const angle = enemy.age * 1.7 + (Math.PI * 2 * i) / count;
      spawnEnemyProjectile({
        x: enemy.x + Math.cos(angle) * enemy.radius * 0.82,
        y: enemy.y + Math.sin(angle) * enemy.radius * 0.82,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 5,
        damage: enemy.damage * 0.5,
        life: 5,
        color,
      });
    }
  }

  function fireBossCrossLasers(enemy, phase) {
    const color = currentStage().accent;
    const width = phase === 2 ? 17 : 13;
    const lines = [
      { x1: player.x - 760, y1: player.y, x2: player.x + 760, y2: player.y },
      { x1: player.x, y1: player.y - 620, x2: player.x, y2: player.y + 620 },
    ];
    if (phase === 2) {
      lines.push(
        { x1: player.x - 620, y1: player.y - 620, x2: player.x + 620, y2: player.y + 620 },
        { x1: player.x - 620, y1: player.y + 620, x2: player.x + 620, y2: player.y - 620 },
      );
    }
    for (const line of lines) {
      beamLines.push({ ...line, color, life: 0.34, maxLife: 0.34, width });
      if (pointLineDistance(player.x, player.y, line.x1, line.y1, line.x2, line.y2) < player.radius + width * 1.5) {
        damagePlayer(enemy.damage * 0.58);
      }
    }
    state.screenShake = Math.max(state.screenShake, 0.28);
  }

  function fireBossFrostRings(enemy, phase) {
    const color = "#8bdcff";
    const rings = phase === 2 ? 3 : 2;
    for (let r = 0; r < rings; r += 1) {
      const count = 16 + r * 6 + (phase === 2 ? 4 : 0);
      const speed = 105 + r * 42 + state.stageIndex * 4;
      for (let i = 0; i < count; i += 1) {
        const angle = enemy.age * 0.22 + (Math.PI * 2 * i) / count + r * 0.18;
        spawnEnemyProjectile({
          x: enemy.x + Math.cos(angle) * (enemy.radius + r * 16),
          y: enemy.y + Math.sin(angle) * (enemy.radius + r * 16),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 5.4 + r * 0.4,
          damage: enemy.damage * 0.38,
          life: 5.8,
          color,
        });
      }
    }
    spawnBossShockwave(enemy, phase, false);
  }

  function bossChargeSlam(enemy, phase) {
    const color = currentStage().accent;
    const startX = enemy.x;
    const startY = enemy.y;
    const dir = normalize(player.x - enemy.x, player.y - enemy.y);
    enemy.x = clamp(player.x - dir.x * 95, 90, world.w - 90);
    enemy.y = clamp(player.y - dir.y * 95, 90, world.h - 90);
    enemy.vx = 0;
    enemy.vy = 0;
    beamLines.push({
      x1: startX,
      y1: startY,
      x2: enemy.x,
      y2: enemy.y,
      color,
      life: 0.4,
      maxLife: 0.4,
      width: phase === 2 ? 18 : 14,
    });
    if (pointLineDistance(player.x, player.y, startX, startY, enemy.x, enemy.y) < player.radius + enemy.radius * 0.7) {
      damagePlayer(enemy.damage * 0.76);
    }
    spawnBossShockwave(enemy, phase, false);
    burst(enemy.x, enemy.y, color, 42, 4.8);
  }

  function spawnBossGravityWell(enemy, phase) {
    const color = currentStage().accent;
    const x = clamp(player.x + rand(-180, 180), 90, world.w - 90);
    const y = clamp(player.y + rand(-140, 140), 90, world.h - 90);
    hazards.push({
      kind: "bossGravity",
      x,
      y,
      radius: phase === 2 ? 270 : 220,
      damage: enemy.damage * 0.3,
      life: phase === 2 ? 4.4 : 3.6,
      maxLife: phase === 2 ? 4.4 : 3.6,
      tick: 0,
      color,
    });
    burst(x, y, color, 32, 3.6);
  }

  function fireBossLaserGrid(enemy, phase) {
    const color = currentStage().accent;
    const count = phase === 2 ? 5 : 3;
    const gap = 130;
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * gap;
      const vertical = i % 2 === 0;
      const line = vertical
        ? { x1: player.x + offset, y1: player.y - 760, x2: player.x + offset, y2: player.y + 760 }
        : { x1: player.x - 840, y1: player.y + offset, x2: player.x + 840, y2: player.y + offset };
      beamLines.push({ ...line, color, life: 0.32, maxLife: 0.32, width: 12 });
      if (pointLineDistance(player.x, player.y, line.x1, line.y1, line.x2, line.y2) < player.radius + 18) {
        damagePlayer(enemy.damage * 0.52);
      }
    }
    state.screenShake = Math.max(state.screenShake, 0.3);
  }

  function bossAceDash(enemy, phase) {
    const color = currentStage().accent;
    const bounds = visibleWorldBounds(-120);
    const oldX = enemy.x;
    const oldY = enemy.y;
    enemy.x = clamp(player.x + (Math.random() < 0.5 ? -1 : 1) * rand(360, 560), Math.max(100, bounds.left), Math.min(world.w - 100, bounds.right));
    enemy.y = clamp(player.y + rand(-260, 180), Math.max(100, bounds.top), Math.min(world.h - 100, bounds.bottom));
    enemy.vx = 0;
    enemy.vy = 0;
    beamLines.push({ x1: oldX, y1: oldY, x2: enemy.x, y2: enemy.y, color, life: 0.26, maxLife: 0.26, width: 10 });
    fireBossAceFan(enemy, phase);
    burst(enemy.x, enemy.y, color, 28, 4.4);
  }

  function fireBossAceFan(enemy, phase) {
    const color = currentStage().accent;
    const aim = normalize(player.x - enemy.x, player.y - enemy.y);
    const shots = phase === 2 ? 9 : 6;
    for (let i = 0; i < shots; i += 1) {
      const offset = (i - (shots - 1) / 2) * 0.16;
      const ca = Math.cos(offset);
      const sa = Math.sin(offset);
      const dir = {
        x: aim.x * ca - aim.y * sa,
        y: aim.x * sa + aim.y * ca,
      };
      spawnEnemyProjectile({
        x: enemy.x + dir.x * enemy.radius,
        y: enemy.y + dir.y * enemy.radius,
        vx: dir.x * (phase === 2 ? 350 : 300),
        vy: dir.y * (phase === 2 ? 350 : 300),
        radius: 4.8,
        damage: enemy.damage * 0.48,
        life: 4.2,
        color,
      });
    }
  }

  function fireAimedEnemyBullet(enemy, speed, radius, angleOffset = 0) {
    if (enemyProjectiles.length >= C.maxEnemyProjectiles) return;
    const aim = normalize(player.x - enemy.x, player.y - enemy.y);
    const ca = Math.cos(angleOffset);
    const sa = Math.sin(angleOffset);
    const dir = {
      x: aim.x * ca - aim.y * sa,
      y: aim.x * sa + aim.y * ca,
    };
    enemyProjectiles.push({
      x: enemy.x + dir.x * enemy.radius,
      y: enemy.y + dir.y * enemy.radius,
      vx: dir.x * speed,
      vy: dir.y * speed,
      radius,
      damage: enemy.damage,
      life: 4,
      color: enemy.behavior === "boss" ? "#ffcf5a" : "#ff6b6b",
    });
  }

  function fireRadial(enemy, count, speed) {
    if (enemyProjectiles.length >= C.maxEnemyProjectiles - count) return;
    const start = enemy.age * 0.55;
    for (let i = 0; i < count; i += 1) {
      const angle = start + (Math.PI * 2 * i) / count;
      enemyProjectiles.push({
        x: enemy.x + Math.cos(angle) * enemy.radius * 0.7,
        y: enemy.y + Math.sin(angle) * enemy.radius * 0.7,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 4.8,
        damage: enemy.damage * 0.72,
        life: 4.8,
        color: "#ffcf5a",
      });
    }
  }

  function updateProjectiles(dt) {
    for (const projectile of projectiles) {
      projectile.life -= dt;
      if (projectile.target && !projectile.target.dead) {
        const desired = normalize(projectile.target.x - projectile.x, projectile.target.y - projectile.y);
        const current = normalize(projectile.vx, projectile.vy);
        const turn = Math.min(1, dt * projectile.turnRate);
        const speed = Math.hypot(projectile.vx, projectile.vy);
        const nx = current.x + (desired.x - current.x) * turn;
        const ny = current.y + (desired.y - current.y) * turn;
        const next = normalize(nx, ny);
        projectile.vx = next.x * speed;
        projectile.vy = next.y * speed;
      }
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      if (projectile.type === "missile") {
        puff(projectile.x - projectile.vx * 0.018, projectile.y - projectile.vy * 0.018, "rgba(255, 207, 90, 0.55)", 1);
      }
    }

    const enemyBulletSpeedScale = player.timeSlowTimer > 0 ? 0.38 : 1;
    for (const bullet of enemyProjectiles) {
      bullet.life -= dt;
      bullet.x += bullet.vx * dt * enemyBulletSpeedScale;
      bullet.y += bullet.vy * dt * enemyBulletSpeedScale;
    }
  }

  function updatePickups(dt) {
    for (const pickup of pickups) {
      const toPlayer = normalize(player.x - pickup.x, player.y - pickup.y);
      const inRange = toPlayer.len < player.pickupRange;
      if (inRange) {
        const pull = 720 * PICKUP_PULL_MULT * (1 - toPlayer.len / player.pickupRange);
        pickup.vx += toPlayer.x * pull * dt;
        pickup.vy += toPlayer.y * pull * dt;
      }
      pickup.vx *= 1 - Math.min(0.12, dt * 2.8);
      pickup.vy *= 1 - Math.min(0.12, dt * 2.8);
      pickup.x += pickup.vx * dt;
      pickup.y += pickup.vy * dt;
      pickup.spin += dt * 5;
    }
  }

  function updateEffects(dt) {
    for (const particle of particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 1 - Math.min(0.18, dt * 2.5);
      particle.vy *= 1 - Math.min(0.18, dt * 2.5);
    }
    for (const text of floatTexts) {
      text.life -= dt;
      text.y -= dt * 38;
    }
    for (const line of arcLines) {
      line.life -= dt;
    }
    for (const line of beamLines) {
      line.life -= dt;
    }
    state.screenShake = Math.max(0, state.screenShake - dt * 2.8);
  }

  function handleCollisions() {
    for (let pi = projectiles.length - 1; pi >= 0; pi -= 1) {
      const projectile = projectiles[pi];
      if (projectile.life <= 0) continue;
      for (const enemy of enemies) {
        if (enemy.dead || projectile.hit.has(enemy.id)) continue;
        const hitRadius = projectile.radius + enemy.radius;
        if (distSq(projectile.x, projectile.y, enemy.x, enemy.y) > hitRadius * hitRadius) continue;

        projectile.hit.add(enemy.id);
        damageEnemy(enemy, projectile.damage.amount, projectile.damage.crit);
        if (projectile.blastRadius) {
          explode(projectile.x, projectile.y, projectile.blastRadius, projectile.damage.amount * 0.62);
          projectile.life = -1;
          break;
        }
        projectile.pierce -= 1;
        if (projectile.pierce < 0) {
          projectile.life = -1;
          break;
        }
      }
    }

    for (let bi = enemyProjectiles.length - 1; bi >= 0; bi -= 1) {
      const bullet = enemyProjectiles[bi];
      const hitRadius = bullet.radius + player.radius;
      const distanceSq = distSq(bullet.x, bullet.y, player.x, player.y);
      if (distanceSq <= hitRadius * hitRadius) {
        damagePlayer(bullet.damage);
        bullet.life = -1;
      } else if (!bullet.grazed && distanceSq <= (hitRadius + GRAZE_RADIUS) ** 2) {
        bullet.grazed = true;
        grantGraze(bullet);
      }
    }

    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const hitRadius = enemy.radius + player.radius;
      if (distSq(enemy.x, enemy.y, player.x, player.y) <= hitRadius * hitRadius) {
        damagePlayer(enemy.damage);
        const push = normalize(enemy.x - player.x, enemy.y - player.y);
        enemy.x += push.x * 18;
        enemy.y += push.y * 18;
      }
    }

    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      const pickup = pickups[i];
      const hitRadius = (pickup.radius || C.pickupRadius) + player.radius;
      if (distSq(pickup.x, pickup.y, player.x, player.y) <= hitRadius * hitRadius) {
        collectPickup(pickup);
        pickups.splice(i, 1);
      }
    }
  }

  function collectPickup(pickup) {
    addXp(pickup.value);
    if (pickup.kind === "cache") {
      player.hp = Math.min(player.maxHp, player.hp + 18 + state.stageIndex * 3);
      player.shield = Math.min(player.maxShield, player.shield + 16 + state.stageIndex * 3);
      state.score += 25 + state.stageIndex * 10;
      burst(pickup.x, pickup.y, pickup.color || currentStage().accent, 40, 4.2);
      floatTexts.push({
        x: pickup.x,
        y: pickup.y - 18,
        value: "补给",
        color: pickup.color || currentStage().accent,
        life: 0.8,
        maxLife: 0.8,
        size: 18,
      });
    } else if (pickup.kind === "chip") {
      grantTacticalChip(tacticalChipById[pickup.chipId]);
      burst(pickup.x, pickup.y, pickup.color || "#ffcf5a", 38, 4.4);
    }
  }

  function collectLoosePickups() {
    if (pickups.length === 0) return;
    let xp = 0;
    let cacheCount = 0;
    const chipIds = [];
    for (const pickup of pickups) {
      xp += pickup.value || 0;
      if (pickup.kind === "cache") cacheCount += 1;
      if (pickup.kind === "chip") chipIds.push(pickup.chipId);
    }
    pickups.length = 0;
    if (cacheCount > 0) {
      player.hp = Math.min(player.maxHp, player.hp + cacheCount * (18 + state.stageIndex * 3));
      player.shield = Math.min(player.maxShield, player.shield + cacheCount * (16 + state.stageIndex * 3));
      state.score += cacheCount * (25 + state.stageIndex * 10);
    }
    if (xp > 0) {
      addXp(xp);
      floatTexts.push({
        x: player.x,
        y: player.y - 34,
        value: "战利品回收",
        color: currentStage().accent,
        life: 0.9,
        maxLife: 0.9,
        size: 18,
      });
    }
    for (const chipId of chipIds) {
      grantTacticalChip(tacticalChipById[chipId]);
    }
  }

  function damageEnemy(enemy, amount, crit) {
    if (enemy.dead) return;
    const actualAmount = amount * (enemy.damageTakenMult ?? 1);
    enemy.hp -= actualAmount;
    enemy.flash = 0.07;
    if (crit || actualAmount > 40) {
      floatTexts.push({
        x: enemy.x + rand(-8, 8),
        y: enemy.y - enemy.radius,
        value: Math.round(actualAmount).toString(),
        color: crit ? "#ffcf5a" : "#f6f7fb",
        life: 0.54,
        maxLife: 0.54,
        size: crit ? 18 : 14,
      });
    }
    if (enemy.hp <= 0) killEnemy(enemy);
  }

  function damagePlayer(amount) {
    if (player.invuln > 0 || mode !== "playing") return;
    let remaining = amount * player.damageTakenMult * (player.barrierTimer > 0 ? 0.2 : 1);
    if (player.shield > 0) {
      const absorbed = Math.min(player.shield, remaining);
      player.shield -= absorbed;
      remaining -= absorbed;
    }
    if (remaining > 0) player.hp -= remaining;
    player.invuln = 0.7;
    player.shieldDelay = 4.2;
    state.screenShake = Math.max(state.screenShake, 0.38);
    burst(player.x, player.y, remaining > 0 ? "#ff6b6b" : "#5ee2ff", 16, 4);
  }

  function grantGraze(bullet) {
    state.graze += 1;
    state.grazeStreak += 1;
    state.grazeTimer = 2.8;
    state.score += 3 + state.stageIndex;
    if (state.grazeStreak % GRAZE_REWARD_STEP === 0) {
      addXp(3 + state.stageIndex);
      player.shield = Math.min(player.maxShield, player.shield + 2 + state.stageIndex * 0.35);
      floatTexts.push({
        x: player.x,
        y: player.y - 42,
        value: `擦弹 x${state.grazeStreak}`,
        color: "#8bdcff",
        life: 0.62,
        maxLife: 0.62,
        size: 17,
      });
    } else if (state.grazeStreak <= 3 || state.grazeStreak % 4 === 0) {
      floatTexts.push({
        x: bullet.x,
        y: bullet.y - 8,
        value: "擦弹",
        color: "#8bdcff",
        life: 0.42,
        maxLife: 0.42,
        size: 13,
      });
    }
  }

  function killEnemy(enemy) {
    if (enemy.dead) return;
    const bossLike = isBossEnemy(enemy);
    enemy.dead = true;
    state.kills += 1;
    if (!bossLike && state.stagePhase === "fight") {
      state.stageKills += 1;
      if (state.waveActive) state.waveKills += 1;
    }
    state.score += enemy.score;
    dropXp(enemy.x, enemy.y, enemy.xp);
    if (enemy.bounty) completeBounty(enemy);
    burst(enemy.x, enemy.y, enemy.color, bossLike ? 90 : 24, bossLike ? 8 : 4);
    state.screenShake = Math.max(state.screenShake, bossLike ? 0.8 : 0.18);

    if (enemy.behavior === "splitter" && !enemy.mini && !bossLike) {
      for (let i = 0; i < 3; i += 1) {
        spawnEnemy("chaser", {
          x: enemy.x + rand(-18, 18),
          y: enemy.y + rand(-18, 18),
          mini: true,
        });
      }
    }

    if (player.arcLevel > 0 && !bossLike) {
      const arcScale = endlessScale(player.arcLevel, 1, 32, 0.012);
      chainArc(
        enemy.x,
        enemy.y,
        Math.min(14, 2 + Math.floor(arcScale * 1.35) + player.arcBonusJumps),
        (18 + arcScale * 10) * player.damageMult * player.arcDamageMult,
      );
    }

    if (player.blackHoleLevel > 0 && !bossLike) {
      const chance = Math.min(0.72, 0.1 + endlessScale(player.blackHoleLevel, 0.075, 28, 0.003));
      if (Math.random() < chance) spawnVortex(enemy.x, enemy.y, player.blackHoleLevel);
    }

    if (player.killExplosionLevel > 0 && !bossLike) {
      const burstScale = endlessScale(player.killExplosionLevel, 1, 28, 0.012);
      const chance = Math.min(0.7, 0.14 + burstScale * 0.055);
      if (Math.random() < chance) {
        queueExplosion(enemy.x, enemy.y, 48 + Math.min(150, burstScale * 18), (18 + burstScale * 12) * player.damageMult);
      }
    }

    if (enemy.bossKind === "stage") {
      completeStage(enemy);
    } else if (enemy.bossKind === "final" || enemy.behavior === "boss") {
      state.boss = null;
      state.victoryTimer = C.victoryDelay;
    }
  }

  function queueExplosion(x, y, radius, damage, color = "#ffcf5a") {
    if (explosionQueue.length >= 240) return;
    explosionQueue.push({ x, y, radius, damage, color });
  }

  function updateExplosionQueue() {
    const count = Math.min(MAX_EXPLOSIONS_PER_FRAME, explosionQueue.length);
    for (let i = 0; i < count; i += 1) {
      const explosion = explosionQueue.shift();
      explode(explosion.x, explosion.y, explosion.radius, explosion.damage, explosion.color);
    }
  }

  function explode(x, y, radius, damage, color = "#ffcf5a") {
    burst(x, y, color, 26, 5);
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const d = Math.sqrt(distSq(x, y, enemy.x, enemy.y));
      if (d > radius + enemy.radius) continue;
      const falloff = 1 - clamp(d / (radius + enemy.radius), 0, 0.86);
      damageEnemy(enemy, damage * falloff, false);
    }
  }

  function completeBounty(enemy) {
    state.bountyActive = false;
    state.bountyTargetId = null;
    state.score += 160 + state.stageIndex * 45;
    dropTacticalChip(enemy.x, enemy.y);
    floatTexts.push({
      x: enemy.x,
      y: enemy.y - enemy.radius - 18,
      value: "悬赏完成",
      color: "#ffcf5a",
      life: 1,
      maxLife: 1,
      size: 20,
    });
  }

  function chainArc(x, y, jumps, damage) {
    const hit = new Set();
    let origin = { x, y };
    for (let i = 0; i < jumps; i += 1) {
      let target = null;
      const range = 190 + Math.min(620, player.arcRangeBonus);
      let best = range * range;
      for (const enemy of enemies) {
        if (enemy.dead || hit.has(enemy.id)) continue;
        const d = distSq(origin.x, origin.y, enemy.x, enemy.y);
        if (d < best) {
          best = d;
          target = enemy;
        }
      }
      if (!target) return;
      hit.add(target.id);
      arcLines.push({
        x1: origin.x,
        y1: origin.y,
        x2: target.x,
        y2: target.y,
        color: DATA.weapons.arc.color,
        life: 0.16,
        maxLife: 0.16,
      });
      damageEnemy(target, damage * Math.max(0.24, 1 - i * 0.1), false);
      origin = target;
    }
  }

  function dropXp(x, y, value) {
    const chunks = Math.max(1, Math.min(5, Math.ceil(value / 16)));
    for (let i = 0; i < chunks; i += 1) {
      const angle = rand(0, Math.PI * 2);
      pickups.push({
        x: x + Math.cos(angle) * rand(0, 12),
        y: y + Math.sin(angle) * rand(0, 12),
        vx: Math.cos(angle) * rand(35, 92),
        vy: Math.sin(angle) * rand(35, 92),
        value: value / chunks,
        spin: rand(0, Math.PI * 2),
      });
    }
  }

  function dropTacticalChip(x, y) {
    const chip = weightedPick(tacticalChipDefs, (item) => item.weight);
    pickups.push({
      kind: "chip",
      chipId: chip.id,
      x,
      y,
      vx: rand(-80, 80),
      vy: rand(-90, 40),
      value: 18 + state.stageIndex * 5,
      spin: rand(0, Math.PI * 2),
      radius: 14,
      color: chip.color,
    });
  }

  function grantTacticalChip(chip) {
    if (!chip) return;
    player.tacticalChipCount += 1;
    player.tacticalChipCounts[chip.id] = (player.tacticalChipCounts[chip.id] || 0) + 1;
    const level = player.tacticalChipCounts[chip.id];
    if (chip.id === "targeting") {
      player.critChance = Math.min(0.9, player.critChance + levelAdd(level, 0.025, 10, 0.22));
      player.critDamage += levelAdd(level, 0.09, 12, 0.24);
    } else if (chip.id === "reactor") {
      player.fireRate *= levelStep(level, 0.055, 12, 0.22);
      player.projectileSpeedMult *= levelStep(level, 0.045, 12, 0.2);
    } else if (chip.id === "warhead") {
      player.damageMult *= levelStep(level, 0.06, 12, 0.24);
      player.missileBlastBonus = Math.min(340, player.missileBlastBonus + levelAdd(level, 4, 12, 0.24));
    } else if (chip.id === "salvage") {
      player.xpGainMult *= levelStep(level, 0.045, 12, 0.24);
      player.pickupRange += levelAdd(level, 24, 12, 0.25);
      player.shield = Math.min(player.maxShield, player.shield + 12 + state.stageIndex * 2);
    } else if (chip.id === "phase") {
      player.dashCooldownMult = applyReduction(player.dashCooldownMult, levelAdd(level, 0.035, 12, 0.18), 0.2);
      player.shieldRegenMult *= levelStep(level, 0.08, 12, 0.22);
      player.damageTakenMult = applyReduction(player.damageTakenMult, levelAdd(level, 0.025, 14, 0.16), 0.16);
    }
    weaponSignature = "";
    floatTexts.push({
      x: player.x,
      y: player.y - 56,
      value: chip.name,
      color: chip.color,
      life: 1.05,
      maxLife: 1.05,
      size: 19,
    });
  }

  function addXp(value) {
    player.xp += value * player.xpGainMult;
    let leveled = false;
    while (player.xp >= player.xpToLevel) {
      player.xp -= player.xpToLevel;
      player.level += 1;
      player.xpToLevel = Math.floor(45 + player.level * 22 + player.level * player.level * 4);
      state.pendingUpgradePicks += state.skillChoicesPerLevel;
      leveled = true;
    }
    if (leveled && mode === "playing") openUpgrade();
  }

  function openUpgrade() {
    if (state.pendingUpgradePicks <= 0) return;
    const picksPerLevel = state.skillChoicesPerLevel || difficulties.normal.skillChoicesPerLevel;
    const remainingInLevel =
      ((state.pendingUpgradePicks - 1) % picksPerLevel) + 1;
    if (ui.upgradeTitle) ui.upgradeTitle.textContent = "选择强化";
    if (ui.upgradePrompt) {
      ui.upgradePrompt.textContent = `${state.difficultyName}难度本次升级可选择 ${picksPerLevel} 个技能，还剩 ${remainingInLevel} 个`;
    }
    const options = rollUpgrades(3);
    if (options.length === 0) {
      state.pendingUpgradePicks = 0;
      setMode("playing");
      return;
    }
    ui.upgradeCards.textContent = "";
    for (const upgrade of options) {
      const level = (state.upgradeLevels[upgrade.id] || 0) + 1;
      const button = document.createElement("button");
      button.style.setProperty("--upgrade-accent", upgradeAccent(upgrade));
      button.className = `upgrade-card ${upgrade.rarity}`;
      button.innerHTML = `
        <span class="upgrade-top">
          <span class="upgrade-icon"></span>
          <span class="upgrade-title">${upgrade.name}</span>
          <span class="upgrade-desc">${upgrade.desc}</span>
        </span>
        <span class="upgrade-meta">
          <span>${rarityLabel[upgrade.rarity]}</span>
          <span>Lv. ${level}</span>
        </span>
      `;
      button.addEventListener("click", () => chooseUpgrade(upgrade));
      ui.upgradeCards.appendChild(button);
    }
    setMode("upgrade");
  }

  function chooseUpgrade(upgrade) {
    state.upgradeLevels[upgrade.id] = (state.upgradeLevels[upgrade.id] || 0) + 1;
    const level = state.upgradeLevels[upgrade.id];
    state.pendingUpgradePicks = Math.max(0, state.pendingUpgradePicks - 1);
    upgrade.apply(level);
    burst(player.x, player.y, "#78f09a", 28, 4);
    weaponSignature = "";
    if (state.pendingUpgradePicks > 0) {
      openUpgrade();
    } else {
      setMode("playing");
    }
    updateHud();
  }

  function rollUpgrades(count) {
    const rarityWeight = {
      common: 1,
      rare: 0.68 + player.level * 0.012,
      epic: 0.28 + player.level * 0.009,
      legendary: 0.07 + player.level * 0.003,
    };
    const pool = upgrades.filter((upgrade) => {
      if (upgrade.requires && !upgrade.requires()) return false;
      return true;
    });
    const chosen = [];
    while (chosen.length < count && pool.length > 0) {
      const pick = weightedPick(pool, (upgrade) => upgrade.weight * rarityWeight[upgrade.rarity]);
      chosen.push(pick);
      pool.splice(pool.indexOf(pick), 1);
    }
    return chosen;
  }

  function cleanup() {
    for (let i = projectiles.length - 1; i >= 0; i -= 1) {
      const p = projectiles[i];
      if (
        p.life <= 0 ||
        p.x < -120 ||
        p.x > world.w + 120 ||
        p.y < -120 ||
        p.y > world.h + 120
      ) {
        projectiles.splice(i, 1);
      }
    }
    for (let i = enemyProjectiles.length - 1; i >= 0; i -= 1) {
      const p = enemyProjectiles[i];
      if (
        p.life <= 0 ||
        p.x < -160 ||
        p.x > world.w + 160 ||
        p.y < -160 ||
        p.y > world.h + 160
      ) {
        enemyProjectiles.splice(i, 1);
      }
    }
    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      if (enemies[i].dead) enemies.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }
    for (let i = floatTexts.length - 1; i >= 0; i -= 1) {
      if (floatTexts[i].life <= 0) floatTexts.splice(i, 1);
    }
    for (let i = arcLines.length - 1; i >= 0; i -= 1) {
      if (arcLines[i].life <= 0) arcLines.splice(i, 1);
    }
    for (let i = beamLines.length - 1; i >= 0; i -= 1) {
      if (beamLines[i].life <= 0) beamLines.splice(i, 1);
    }
    for (let i = vortices.length - 1; i >= 0; i -= 1) {
      if (vortices[i].life <= 0) vortices.splice(i, 1);
    }
  }

  function updateHud() {
    if (!player || !state) return;
    ui.hpText.textContent = `${Math.ceil(Math.max(0, player.hp))} / ${player.maxHp}`;
    ui.hpBar.style.width = `${clamp((player.hp / player.maxHp) * 100, 0, 100)}%`;
    ui.shieldText.textContent = `${Math.ceil(player.shield)} / ${player.maxShield}`;
    ui.shieldBar.style.width = `${player.maxShield > 0 ? clamp((player.shield / player.maxShield) * 100, 0, 100) : 0}%`;
    ui.timerText.textContent = formatTime(state.time);
    const stage = currentStage();
    if (ui.stageText) ui.stageText.textContent = `关卡 ${state.stageIndex + 1} / ${stages.length}`;
    if (ui.stageName) ui.stageName.textContent = stage.name;
    if (ui.stageTrait) ui.stageTrait.textContent = stage.trait;
    if (ui.stageObjective) ui.stageObjective.textContent = stageObjectiveText();
    ui.levelText.textContent = `Lv. ${player.level}`;
    ui.xpText.textContent = `${Math.floor(player.xp)} / ${player.xpToLevel}`;
    ui.xpBar.style.width = `${clamp((player.xp / player.xpToLevel) * 100, 0, 100)}%`;

    if (state.boss && !state.boss.dead) {
      ui.bossPanel.classList.add("is-visible");
      if (ui.bossName) ui.bossName.textContent = state.boss.name;
      ui.bossBar.style.width = `${clamp((state.boss.hp / state.boss.maxHp) * 100, 0, 100)}%`;
    } else {
      ui.bossPanel.classList.remove("is-visible");
    }

    updateActiveSkillHud();

    const weapons = [{ label: `机炮 x${player.cannonShots}`, color: "#5ee2ff" }];
    if (player.ammoSpreadLevel > 0) weapons.push({ label: `火神 Lv.${player.ammoSpreadLevel}`, color: "#ff6b6b" });
    if (player.ammoLaserLevel > 0) weapons.push({ label: `雷射 Lv.${player.ammoLaserLevel}`, color: "#5ee2ff" });
    if (player.ammoWaveLevel > 0) weapons.push({ label: `波刃 Lv.${player.ammoWaveLevel}`, color: "#78f09a" });
    if (player.ammoHomingLevel > 0) weapons.push({ label: `针弹 Lv.${player.ammoHomingLevel}`, color: "#ffcf5a" });
    if (player.ammoPlasmaLevel > 0) weapons.push({ label: `紫电 Lv.${player.ammoPlasmaLevel}`, color: "#b98cff" });
    if (player.ammoDrillLevel > 0) weapons.push({ label: `钻光 Lv.${player.ammoDrillLevel}`, color: "#f6f7fb" });
    if (player.missileLevel > 0) weapons.push({ label: `导弹 x${player.missileVolley}`, color: "#ffcf5a" });
    if (player.droneCount > 0) weapons.push({ label: `僚机 x${player.droneCount}`, color: "#78f09a" });
    if (player.arcLevel > 0) weapons.push({ label: `电弧 Lv.${player.arcLevel}`, color: "#b98cff" });
    if (player.orbitalLaserLevel > 0) weapons.push({ label: `天基 Lv.${player.orbitalLaserLevel}`, color: "#ffcf5a" });
    if (player.blackHoleLevel > 0) weapons.push({ label: `奇点 Lv.${player.blackHoleLevel}`, color: "#b98cff" });
    if (player.plasmaAuraLevel > 0) weapons.push({ label: `星环 Lv.${player.plasmaAuraLevel}`, color: "#78f09a" });
    if (player.frostNovaLevel > 0) weapons.push({ label: `霜爆 Lv.${player.frostNovaLevel}`, color: "#8bdcff" });
    if (player.killExplosionLevel > 0) weapons.push({ label: `星爆 Lv.${player.killExplosionLevel}`, color: "#ff6b6b" });
    if (player.enemySlowMult < 1) weapons.push({ label: "时滞核心", color: "#d18cff" });
    if (player.tacticalChipCount > 0) weapons.push({ label: `芯片 x${player.tacticalChipCount}`, color: "#ffcf5a" });
    if (state.grazeStreak >= 4) weapons.push({ label: `擦弹 x${state.grazeStreak}`, color: "#8bdcff" });
    const signature = weapons.map((weapon) => weapon.label).join("|");
    if (signature !== weaponSignature) {
      weaponSignature = signature;
      ui.weaponList.textContent = "";
      for (const weapon of weapons) {
        const chip = document.createElement("span");
        chip.className = "weapon-chip";
        const dot = document.createElement("span");
        dot.className = "weapon-dot";
        dot.style.background = weapon.color;
        const label = document.createElement("span");
        label.textContent = weapon.label;
        chip.append(dot, label);
        ui.weaponList.appendChild(chip);
      }
    }
  }

  function updateActiveSkillHud() {
    if (!ui.activeSkillHud || !player.activeSkills) return;
    const signature = player.activeSkills.map((slot) => slot.id).join("|");
    if (signature !== activeSkillHudSignature) {
      activeSkillHudSignature = signature;
      ui.activeSkillHud.textContent = "";
      for (let i = 0; i < player.activeSkills.length; i += 1) {
        const slot = player.activeSkills[i];
        const skill = activeSkillById[slot.id];
        if (!skill) continue;
        const card = document.createElement("button");
        card.type = "button";
        card.className = "active-hud-card";
        card.dataset.skillIndex = i.toString();
        card.style.setProperty("--skill-color", skill.color);
        card.innerHTML = `
          <span class="active-hud-fill"></span>
          <span class="active-hud-key">${slot.key}</span>
          <span class="active-hud-info">
            <span class="active-hud-name">${skill.name}</span>
            <span class="active-hud-cooldown">就绪</span>
          </span>
        `;
        card.addEventListener("click", () => activateActiveSkill(i));
        ui.activeSkillHud.appendChild(card);
      }
    }

    for (const card of ui.activeSkillHud.querySelectorAll(".active-hud-card")) {
      const index = Number(card.dataset.skillIndex);
      const slot = player.activeSkills[index];
      const skill = slot ? activeSkillById[slot.id] : null;
      if (!slot || !skill) continue;
      const ratio = clamp(slot.cooldown / skill.cooldown, 0, 1);
      card.classList.toggle("is-ready", slot.cooldown <= 0);
      card.classList.toggle("is-cooling", slot.cooldown > 0);
      card.style.setProperty("--cooldown-fill", `${ratio * 100}%`);
      const cooldown = card.querySelector(".active-hud-cooldown");
      if (cooldown) cooldown.textContent = slot.cooldown > 0 ? `${Math.ceil(slot.cooldown)}s` : "就绪";
    }
  }

  function render(dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

    drawBackground(dt);
    const shake = state && state.screenShake > 0 ? state.screenShake * 8 : 0;
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    if (player) {
      ctx.translate(view.w / 2, view.h / 2);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(-camera.x, -camera.y);
      drawWorldGround();
      drawHazards();
      drawPickups();
      drawProjectiles();
      drawEnemies();
      drawPlayer();
      drawEffects();
    }
    ctx.restore();
    if (state) drawStageOverlay();
  }

  function drawBackground(dt) {
    const speedScale = mode === "playing" ? 1 : 0.32;
    const stage = currentStage();
    const gradient = ctx.createLinearGradient(0, 0, 0, view.h);
    gradient.addColorStop(0, stage.palette[0]);
    gradient.addColorStop(0.56, stage.palette[1]);
    gradient.addColorStop(1, stage.palette[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, view.w, view.h);

    ctx.save();
    ctx.globalAlpha = 0.1 + Math.sin(state ? state.time * 0.7 : 0) * 0.025;
    ctx.fillStyle = stage.accent;
    for (let i = 0; i < 6; i += 1) {
      const x = ((i * 281 + (state ? state.time * (8 + i) : 0)) % (view.w + 260)) - 130;
      const y = (Math.sin((state ? state.time : 0) * 0.2 + i * 1.7) * 0.5 + 0.5) * view.h;
      ctx.beginPath();
      ctx.ellipse(x, y, 120 + i * 16, 44 + i * 5, i * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state?.stormPulse > 0) {
      ctx.globalAlpha = state.stormPulse * 0.22;
      ctx.fillStyle = stage.accent;
      ctx.fillRect(0, 0, view.w, view.h);
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const star of stars) {
      star.y += star.speed * dt * speedScale;
      if (star.y > view.h + 4) {
        star.y = -4;
        star.x = Math.random() * view.w;
      }
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = star.speed > 62 ? stage.accent : "#f6f7fb";
      ctx.fillRect(star.x, star.y, star.size, star.size * (star.speed > 62 ? 2.6 : 1));
    }
    ctx.restore();

  }

  function drawWorldGround() {
    const bounds = visibleWorldBounds(160);
    const stage = currentStage();
    const grid = 120;
    const left = Math.max(0, Math.floor(bounds.left / grid) * grid);
    const right = Math.min(world.w, Math.ceil(bounds.right / grid) * grid);
    const top = Math.max(0, Math.floor(bounds.top / grid) * grid);
    const bottom = Math.min(world.h, Math.ceil(bounds.bottom / grid) * grid);

    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = stage.grid;
    ctx.lineWidth = 1 / camera.zoom;
    for (let y = top; y <= bottom; y += grid) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
    for (let x = left; x <= right; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = stage.accent;
    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeRect(0, 0, world.w, world.h);
    ctx.restore();
  }

  function drawPlayer() {
    if (!player.alive) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.tilt);
    if (player.invuln > 0 && Math.floor(player.invuln * 18) % 2 === 0) ctx.globalAlpha = 0.48;

    const flame = 14 + Math.sin(performance.now() * 0.028) * 5;
    ctx.fillStyle = "#ffcf5a";
    ctx.beginPath();
    ctx.moveTo(-6, 18);
    ctx.lineTo(0, 18 + flame);
    ctx.lineTo(6, 18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#5ee2ff";
    ctx.strokeStyle = "rgba(246, 247, 251, 0.82)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(16, 16);
    ctx.lineTo(6, 12);
    ctx.lineTo(0, 25);
    ctx.lineTo(-6, 12);
    ctx.lineTo(-16, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#071014";
    ctx.beginPath();
    ctx.ellipse(0, -7, 5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (player.maxShield > 0 && player.shield > 0) {
      ctx.save();
      ctx.globalAlpha = 0.18 + (player.shield / player.maxShield) * 0.22;
      ctx.strokeStyle = "#5ee2ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (player.barrierTimer > 0) {
      ctx.save();
      const pulse = 0.5 + Math.sin(state.time * 14) * 0.5;
      ctx.globalAlpha = 0.32 + pulse * 0.18;
      ctx.strokeStyle = "#78f09a";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 22 + pulse * 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (player.droneCount > 0) {
      for (const drone of player.drones) {
        ctx.save();
        ctx.translate(drone.x, drone.y);
        ctx.fillStyle = "#78f09a";
        ctx.strokeStyle = "rgba(246, 247, 251, 0.72)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-8, -5, 16, 10, 4);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawEnemies() {
    for (const enemy of enemies) {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      const flash = enemy.flash > 0;
      ctx.fillStyle = flash ? "#f6f7fb" : enemy.color;
      ctx.strokeStyle = enemy.elite ? "#ffcf5a" : "rgba(246, 247, 251, 0.38)";
      ctx.lineWidth = enemy.elite ? 2.4 : 1.4;

      if (enemy.behavior === "boss") {
        drawBoss(enemy, flash);
      } else if (enemy.behavior === "strafe") {
        ctx.rotate(Math.atan2(enemy.vy, enemy.vx) + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -enemy.radius);
        ctx.lineTo(enemy.radius * 0.78, 0);
        ctx.lineTo(0, enemy.radius);
        ctx.lineTo(-enemy.radius * 0.78, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (enemy.behavior === "shooter") {
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#07090d";
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius * 0.42, 0, Math.PI * 2);
        ctx.fill();
      } else if (enemy.behavior === "splitter") {
        polygon(6, enemy.radius);
        ctx.fill();
        ctx.stroke();
      } else if (enemy.behavior === "armored") {
        ctx.beginPath();
        ctx.roundRect(-enemy.radius, -enemy.radius * 0.72, enemy.radius * 2, enemy.radius * 1.44, 6);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.rotate(Math.atan2(enemy.vy, enemy.vx) + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -enemy.radius);
        ctx.lineTo(enemy.radius * 0.9, enemy.radius * 0.9);
        ctx.lineTo(0, enemy.radius * 0.45);
        ctx.lineTo(-enemy.radius * 0.9, enemy.radius * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      if (enemy.stageBoss) {
        drawStageBossHalo(enemy);
      }
      if (enemy.bounty) {
        drawBountyMarker(enemy);
      }
      if ((enemy.elite || enemy.hp < enemy.maxHp) && enemy.behavior !== "boss") {
        drawMiniHealth(enemy);
      }
    }
  }

  function drawBountyMarker(enemy) {
    const pulse = 0.5 + Math.sin((state?.time || 0) * 8) * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.62 + pulse * 0.22;
    ctx.strokeStyle = "#ffcf5a";
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 16 + pulse * 5, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 4; i += 1) {
      const angle = (Math.PI / 2) * i + pulse * 0.15;
      const inner = enemy.radius + 8;
      const outer = enemy.radius + 27;
      ctx.beginPath();
      ctx.moveTo(enemy.x + Math.cos(angle) * inner, enemy.y + Math.sin(angle) * inner);
      ctx.lineTo(enemy.x + Math.cos(angle) * outer, enemy.y + Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStageBossHalo(enemy) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.45 + Math.sin(enemy.age * 5) * 0.12;
    ctx.strokeStyle = currentStage().accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBoss(enemy, flash) {
    const r = enemy.radius;
    ctx.fillStyle = flash ? "#f6f7fb" : "#b01f34";
    ctx.strokeStyle = "#ffcf5a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-r * 1.35, -r * 0.55, r * 2.7, r * 1.1, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = flash ? "#f6f7fb" : "#ff6b6b";
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.04);
    ctx.lineTo(r * 0.52, -r * 0.15);
    ctx.lineTo(0, r * 0.2);
    ctx.lineTo(-r * 0.52, -r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#07090d";
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.arc(i * r * 0.56, 0, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMiniHealth(enemy) {
    const w = enemy.radius * 2;
    const pct = clamp(enemy.hp / enemy.maxHp, 0, 1);
    ctx.save();
    ctx.translate(enemy.x - w / 2, enemy.y - enemy.radius - 10);
    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.fillRect(0, 0, w, 4);
    ctx.fillStyle = enemy.elite ? "#ffcf5a" : "#ff6b6b";
    ctx.fillRect(0, 0, w * pct, 4);
    ctx.restore();
  }

  function polygon(sides, radius) {
    ctx.beginPath();
    for (let i = 0; i < sides; i += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / sides;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawProjectiles() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const projectile of projectiles) {
      ctx.fillStyle = projectile.color;
      ctx.strokeStyle = projectile.color;
      if (projectile.type === "missile") {
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(Math.atan2(projectile.vy, projectile.vx) + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(6, 8);
        ctx.lineTo(-6, 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const bullet of enemyProjectiles) {
      ctx.fillStyle = bullet.color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.24;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawHazards() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const hazard of hazards) {
      if (hazard.kind === "shockwave") {
        const alpha = clamp(hazard.life / hazard.maxLife, 0, 1);
        ctx.save();
        ctx.globalAlpha = alpha * 0.86;
        ctx.strokeStyle = hazard.color;
        ctx.lineWidth = hazard.band * (0.72 + alpha * 0.35);
        ctx.beginPath();
        ctx.arc(hazard.x, hazard.y, hazard.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = alpha * 0.24;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hazard.x, hazard.y, hazard.radius * 0.72, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(hazard.x, hazard.y, hazard.radius * 1.14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      if (hazard.kind === "bossGravity") {
        const alpha = clamp(hazard.life / hazard.maxLife, 0, 1);
        const pulse = 0.5 + Math.sin((state?.time || 0) * 9) * 0.5;
        ctx.save();
        ctx.globalAlpha = alpha * 0.52;
        ctx.strokeStyle = hazard.color;
        ctx.lineWidth = 4 + pulse * 3;
        for (let i = 0; i < 4; i += 1) {
          ctx.beginPath();
          ctx.arc(hazard.x, hazard.y, hazard.radius * (0.24 + i * 0.2) * (1 + pulse * 0.05), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = alpha * 0.24;
        ctx.fillStyle = hazard.color;
        ctx.beginPath();
        ctx.arc(hazard.x, hazard.y, hazard.radius * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }
      if (hazard.kind !== "meteor") continue;
      ctx.save();
      ctx.translate(hazard.x, hazard.y);
      ctx.rotate(Math.atan2(hazard.vy, hazard.vx));
      ctx.fillStyle = hazard.color;
      ctx.strokeStyle = "rgba(246, 247, 251, 0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hazard.radius * 1.2, 0);
      ctx.lineTo(-hazard.radius * 0.7, hazard.radius * 0.72);
      ctx.lineTo(-hazard.radius, 0);
      ctx.lineTo(-hazard.radius * 0.7, -hazard.radius * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.moveTo(-hazard.radius, 0);
      ctx.lineTo(-hazard.radius * 4, hazard.radius * 0.5);
      ctx.lineTo(-hazard.radius * 4, -hazard.radius * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawPickups() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const pickup of pickups) {
      const pulse = 1 + Math.sin(pickup.spin) * 0.16;
      const radius = (pickup.radius || C.pickupRadius) * pulse;
      ctx.fillStyle =
        pickup.kind === "cache" || pickup.kind === "chip" ? pickup.color || currentStage().accent : "#78f09a";
      if (pickup.kind === "cache") {
        ctx.save();
        ctx.translate(pickup.x, pickup.y);
        ctx.rotate(pickup.spin);
        ctx.beginPath();
        ctx.roundRect(-radius, -radius, radius * 2, radius * 2, 5);
        ctx.fill();
        ctx.strokeStyle = "rgba(246, 247, 251, 0.7)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      } else if (pickup.kind === "chip") {
        ctx.save();
        ctx.translate(pickup.x, pickup.y);
        ctx.rotate(pickup.spin * 0.65);
        ctx.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 6;
          const r = i % 2 === 0 ? radius * 1.05 : radius * 0.72;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(246, 247, 251, 0.82)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(pickup.x, pickup.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, radius * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawEffects() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (player?.plasmaAuraLevel > 0) {
      const auraScale = endlessScale(player.plasmaAuraLevel, 1, 28, 0.012);
      const radius = 92 + Math.min(230, auraScale * 25);
      const pulse = 0.5 + Math.sin((state?.time || 0) * 8) * 0.5;
      ctx.globalAlpha = 0.28 + pulse * 0.16;
      ctx.strokeStyle = "#78f09a";
      ctx.lineWidth = 3 + Math.min(8, auraScale * 0.72);
      ctx.beginPath();
      ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (player?.timeSlowTimer > 0) {
      const pulse = 0.5 + Math.sin((state?.time || 0) * 10) * 0.5;
      ctx.globalAlpha = 0.2 + pulse * 0.16;
      ctx.strokeStyle = "#d18cff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 190 + pulse * 22, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const vortex of vortices) {
      const alpha = clamp(vortex.life / vortex.maxLife, 0, 1);
      ctx.globalAlpha = alpha * 0.6;
      ctx.strokeStyle = vortex.color;
      ctx.lineWidth = 3 + vortex.level;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(vortex.x, vortex.y, vortex.radius * (0.35 + i * 0.24) * (1 + (1 - alpha) * 0.18), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = alpha * 0.25;
      ctx.fillStyle = vortex.color;
      ctx.beginPath();
      ctx.arc(vortex.x, vortex.y, vortex.radius * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const particle of particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * (0.55 + alpha), 0, Math.PI * 2);
      ctx.fill();
    }
    for (const line of arcLines) {
      const alpha = clamp(line.life / line.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 3 + alpha * 4;
      ctx.beginPath();
      ctx.moveTo(line.x1, line.y1);
      ctx.lineTo(line.x2, line.y2);
      ctx.stroke();
    }
    for (const line of beamLines) {
      const alpha = clamp(line.life / line.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.width * alpha;
      ctx.beginPath();
      ctx.moveTo(line.x1, line.y1);
      ctx.lineTo(line.x2, line.y2);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.45;
      ctx.lineWidth = line.width * 2.4 * alpha;
      ctx.stroke();
    }
    ctx.restore();

    for (const text of floatTexts) {
      const alpha = clamp(text.life / text.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = text.color;
      ctx.font = `900 ${text.size}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(text.value, text.x, text.y);
      ctx.restore();
    }
  }

  function drawStageOverlay() {
    if (!state || state.stageAnnounce <= 0 || mode !== "playing") return;
    const stage = currentStage();
    const alpha = clamp(state.stageAnnounce / 3.2, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha * 1.25);
    ctx.textAlign = "center";
    ctx.fillStyle = stage.accent;
    ctx.font = "900 13px Inter, system-ui, sans-serif";
    ctx.fillText(`关卡 ${state.stageIndex + 1} / ${stages.length}`, view.w / 2, view.h * 0.28);
    ctx.fillStyle = "#f6f7fb";
    ctx.font = "950 42px Inter, system-ui, sans-serif";
    ctx.fillText(stage.name, view.w / 2, view.h * 0.28 + 46);
    ctx.fillStyle = stage.accent;
    ctx.font = "900 15px Inter, system-ui, sans-serif";
    ctx.fillText(stage.trait, view.w / 2, view.h * 0.28 + 76);
    ctx.fillStyle = "#f6f7fb";
    ctx.font = "850 14px Inter, system-ui, sans-serif";
    ctx.fillText(stageObjectiveText(), view.w / 2, view.h * 0.28 + 102);
    ctx.restore();
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = rand(0, Math.PI * 2);
      const velocity = rand(35, 80) * speed;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        size: rand(1.4, 4.6),
        color,
        life: rand(0.26, 0.72),
        maxLife: 0.72,
      });
    }
  }

  function puff(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = rand(0, Math.PI * 2);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * rand(12, 60),
        vy: Math.sin(angle) * rand(12, 60),
        size: rand(1, 2.8),
        color,
        life: rand(0.12, 0.28),
        maxLife: 0.28,
      });
    }
  }

  function loop(timestamp) {
    const dt = Math.min(0.033, (timestamp - lastFrame) / 1000 || 0);
    lastFrame = timestamp;
    update(dt);
    render(dt);
    requestAnimationFrame(loop);
  }

  function bindEvents() {
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", (event) => {
      keys.add(event.code);
      if (mode === "playing" && ACTIVE_SKILL_KEYS.includes(event.code)) {
        event.preventDefault();
        if (!event.repeat) activateActiveSkillByCode(event.code);
      }
      if (event.code === "Escape" || event.code === "KeyP") {
        event.preventDefault();
        togglePause();
      }
      if (event.code === "Space" || event.code === "ShiftLeft" || event.code === "ShiftRight") {
        event.preventDefault();
        triggerDash();
      }
      if (mode === "menu" && event.code === "Enter") startGame();
    });
    window.addEventListener("keyup", (event) => {
      keys.delete(event.code);
    });

    canvas.addEventListener("pointerdown", (event) => {
      const point = screenToWorld(event.clientX, event.clientY);
      pointer.active = true;
      pointer.hasTarget = true;
      pointer.x = point.x;
      pointer.y = point.y;
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!pointer.active) return;
      const point = screenToWorld(event.clientX, event.clientY);
      pointer.x = point.x;
      pointer.y = point.y;
      pointer.hasTarget = true;
    });
    window.addEventListener("pointerup", () => {
      pointer.active = false;
    });

    for (const button of ui.difficultyButtons) {
      button.addEventListener("click", () => setDifficulty(button.dataset.difficulty));
    }
    ui.startButton.addEventListener("click", startGame);
    ui.retryButton.addEventListener("click", startGame);
    ui.resumeButton.addEventListener("click", () => setMode("playing"));
    ui.pauseButton.addEventListener("click", togglePause);
    ui.restartFromPauseButton.addEventListener("click", startGame);
    ui.menuFromPauseButton.addEventListener("click", () => setMode("menu"));
    ui.menuButton.addEventListener("click", () => setMode("menu"));
  }

  if (!ctx.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radius) {
      const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
      this.moveTo(x + r, y);
      this.arcTo(x + width, y, x + width, y + height, r);
      this.arcTo(x + width, y + height, x, y + height, r);
      this.arcTo(x, y + height, x, y, r);
      this.arcTo(x, y, x + width, y, r);
      return this;
    };
  }

  resize();
  bindEvents();
  setDifficulty(selectedDifficulty);
  renderActiveSkillMenu();
  setMode("menu");
  requestAnimationFrame(loop);
})();
