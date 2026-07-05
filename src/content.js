(function () {
  "use strict";

  const difficulties = {
    easy: {
      id: "easy",
      name: "简单",
      skillChoicesPerLevel: 3,
    },
    normal: {
      id: "normal",
      name: "中等",
      skillChoicesPerLevel: 2,
    },
    hard: {
      id: "hard",
      name: "困难",
      skillChoicesPerLevel: 1,
    },
  };

  const activeSkillKeys = ["KeyQ", "KeyE", "KeyR"];
  const activeSkillLabels = ["Q", "E", "R"];
  const defaultActiveSkills = ["afterburner", "barrier", "missile_rain"];

  const activeSkillSpecs = [
    {
      id: "afterburner",
      name: "推进超载",
      desc: "4秒高速推进",
      cooldown: 12,
      color: "#5ee2ff",
      activateKey: "activateAfterburner",
    },
    {
      id: "barrier",
      name: "棱镜护盾",
      desc: "护盾充能并减伤",
      cooldown: 18,
      color: "#78f09a",
      activateKey: "activateBarrier",
    },
    {
      id: "missile_rain",
      name: "蜂群导弹",
      desc: "齐射追踪爆弹",
      cooldown: 14,
      color: "#ffcf5a",
      activateKey: "activateMissileRain",
    },
    {
      id: "time_freeze",
      name: "时滞力场",
      desc: "减速敌人与弹幕",
      cooldown: 20,
      color: "#d18cff",
      activateKey: "activateTimeFreeze",
    },
    {
      id: "singularity",
      name: "奇点炸弹",
      desc: "牵引并撕裂敌群",
      cooldown: 22,
      color: "#b98cff",
      activateKey: "activateSingularity",
    },
    {
      id: "nanorepair",
      name: "纳米急救",
      desc: "回复机体并清弹",
      cooldown: 26,
      color: "#78f09a",
      activateKey: "activateNanorepair",
    },
    {
      id: "emp",
      name: "电磁脉冲",
      desc: "范围伤害和定身",
      cooldown: 17,
      color: "#8bdcff",
      activateKey: "activateEmp",
    },
    {
      id: "orbital_judgement",
      name: "轨道审判",
      desc: "多重天基激光",
      cooldown: 24,
      color: "#ff6b6b",
      activateKey: "activateOrbitalJudgement",
    },
  ];

  function createActiveSkillDefs(activators) {
    return activeSkillSpecs.map(({ activateKey, ...skill }) => ({
      ...skill,
      activate: activators[activateKey],
    }));
  }

  const stages = [
    {
      name: "近地轨道",
      trait: "补给航道",
      waves: 12,
      waveSize: 7,
      waveGrowth: 1,
      miniBossType: "shooter",
      miniBossName: "轨道哨卫",
      palette: ["#07090d", "#0d1014", "#090b0f"],
      accent: "#5ee2ff",
      grid: "#5ee2ff",
      spawnMult: 1,
      hpMult: 1,
      speedMult: 1,
      eliteAfter: 70,
      hazard: "cache",
      bias: { chaser: 1.25, strafe: 0.4 },
    },
    {
      name: "等离子云海",
      trait: "能量补给",
      waves: 14,
      waveSize: 8,
      waveGrowth: 1.1,
      miniBossType: "shooter",
      miniBossName: "云海炮艇",
      palette: ["#071116", "#10211f", "#07100d"],
      accent: "#78f09a",
      grid: "#78f09a",
      spawnMult: 1.08,
      hpMult: 1.08,
      speedMult: 0.96,
      eliteAfter: 55,
      hazard: "cache",
      bias: { chaser: 1, shooter: 0.55 },
    },
    {
      name: "陨石带",
      trait: "横穿陨石",
      waves: 16,
      waveSize: 9,
      waveGrowth: 1.2,
      miniBossType: "armored",
      miniBossName: "碎星重甲",
      palette: ["#110d08", "#17120d", "#0c0b0a"],
      accent: "#ffcf5a",
      grid: "#ffcf5a",
      spawnMult: 1.12,
      hpMult: 1.15,
      speedMult: 1.02,
      eliteAfter: 45,
      hazard: "meteor",
      bias: { strafe: 1.1, armored: 0.35 },
    },
    {
      name: "冰晶环",
      trait: "低温补给",
      waves: 18,
      waveSize: 10,
      waveGrowth: 1.25,
      miniBossType: "splitter",
      miniBossName: "冰晶母巢",
      palette: ["#061018", "#0c1720", "#070b10"],
      accent: "#8bdcff",
      grid: "#8bdcff",
      spawnMult: 1.18,
      hpMult: 1.18,
      speedMult: 0.92,
      eliteAfter: 38,
      hazard: "cache",
      bias: { shooter: 0.9, splitter: 0.35 },
    },
    {
      name: "太阳风暴",
      trait: "太阳脉冲",
      waves: 20,
      waveSize: 11,
      waveGrowth: 1.3,
      miniBossType: "strafe",
      miniBossName: "日冕突击者",
      palette: ["#160908", "#24100a", "#0f0808"],
      accent: "#ff6b6b",
      grid: "#ff6b6b",
      spawnMult: 1.24,
      hpMult: 1.22,
      speedMult: 1.06,
      eliteAfter: 32,
      hazard: "storm",
      bias: { strafe: 1.1, shooter: 0.75 },
    },
    {
      name: "废墟航道",
      trait: "残骸补给",
      waves: 22,
      waveSize: 12,
      waveGrowth: 1.35,
      miniBossType: "armored",
      miniBossName: "废墟破城锤",
      palette: ["#0b0d10", "#15161a", "#090a0c"],
      accent: "#f6f7fb",
      grid: "#aeb4c2",
      spawnMult: 1.28,
      hpMult: 1.3,
      speedMult: 1,
      eliteAfter: 30,
      hazard: "cache",
      bias: { armored: 0.85, splitter: 0.65 },
    },
    {
      name: "重力井",
      trait: "裂隙增援",
      waves: 24,
      waveSize: 13,
      waveGrowth: 1.4,
      miniBossType: "splitter",
      miniBossName: "重力畸变体",
      palette: ["#090814", "#110d22", "#080810"],
      accent: "#b98cff",
      grid: "#b98cff",
      spawnMult: 1.34,
      hpMult: 1.36,
      speedMult: 1.08,
      eliteAfter: 26,
      hazard: "rift",
      bias: { chaser: 1.2, splitter: 0.95 },
    },
    {
      name: "虚空裂隙",
      trait: "虚空撕裂",
      waves: 26,
      waveSize: 14,
      waveGrowth: 1.45,
      miniBossType: "shooter",
      miniBossName: "裂隙主炮",
      palette: ["#05070d", "#100b18", "#07060d"],
      accent: "#d18cff",
      grid: "#b98cff",
      spawnMult: 1.42,
      hpMult: 1.48,
      speedMult: 1.1,
      eliteAfter: 24,
      hazard: "rift",
      bias: { shooter: 1, splitter: 1 },
    },
    {
      name: "赤色战区",
      trait: "高速陨石",
      waves: 28,
      waveSize: 15,
      waveGrowth: 1.5,
      miniBossType: "strafe",
      miniBossName: "赤翼王牌",
      palette: ["#140807", "#1e0a0d", "#0b0607"],
      accent: "#ff4f6d",
      grid: "#ff6b6b",
      spawnMult: 1.55,
      hpMult: 1.58,
      speedMult: 1.15,
      eliteAfter: 18,
      hazard: "meteor",
      bias: { strafe: 1.35, armored: 1, shooter: 0.9 },
    },
    {
      name: "深空核心",
      trait: "核心风暴",
      waves: 30,
      waveSize: 16,
      waveGrowth: 1.55,
      miniBossType: "boss",
      miniBossName: "深空母舰",
      palette: ["#05050a", "#120814", "#06060a"],
      accent: "#ffcf5a",
      grid: "#ffcf5a",
      spawnMult: 1.7,
      hpMult: 1.75,
      speedMult: 1.18,
      eliteAfter: 14,
      hazard: "storm",
      bias: { chaser: 1, strafe: 1.2, shooter: 1.1, splitter: 1.1, armored: 1.1 },
    },
  ];

  const rarityLabel = {
    common: "普通",
    rare: "稀有",
    epic: "史诗",
    legendary: "传说",
  };

  const tacticalChipDefs = [
    {
      id: "targeting",
      name: "鹰眼芯片",
      color: "#ffcf5a",
      desc: "暴击率和暴击伤害提升。",
      weight: 1,
    },
    {
      id: "reactor",
      name: "反应堆芯片",
      color: "#5ee2ff",
      desc: "全武器射速和弹速提升。",
      weight: 1,
    },
    {
      id: "warhead",
      name: "战斗部芯片",
      color: "#ff6b6b",
      desc: "全武器伤害和导弹爆风提升。",
      weight: 1,
    },
    {
      id: "salvage",
      name: "回收芯片",
      color: "#78f09a",
      desc: "经验收益、吸附范围和护盾补给提升。",
      weight: 1,
    },
    {
      id: "phase",
      name: "相位芯片",
      color: "#b98cff",
      desc: "冲刺冷却、护盾恢复和受伤减免提升。",
      weight: 0.8,
    },
  ];

  const upgradeAccents = {
    damage: "#ff6b6b",
    fire_rate: "#ffcf5a",
    speed: "#5ee2ff",
    repair: "#78f09a",
    magnet: "#78f09a",
    combat_scoop: "#78f09a",
    ballistic_core: "#ffcf5a",
    field_medic: "#78f09a",
    shield: "#5ee2ff",
    shield_reactor: "#5ee2ff",
    armor_plate: "#f6f7fb",
    afterburner: "#5ee2ff",
    phase_dash: "#b98cff",
    pierce: "#ffcf5a",
    crit: "#ffcf5a",
    crit_damage: "#ffcf5a",
    cannon_fork: "#5ee2ff",
    cannon_overclock: "#5ee2ff",
    cannon_rail: "#5ee2ff",
    ammo_spread: "#ff6b6b",
    ammo_laser: "#5ee2ff",
    ammo_wave: "#78f09a",
    ammo_homing: "#ffcf5a",
    ammo_plasma: "#b98cff",
    ammo_drill: "#f6f7fb",
    missile_unlock: "#ffcf5a",
    missile_volley: "#ffcf5a",
    missile_payload: "#ff6b6b",
    missile_coolant: "#ffcf5a",
    missile_shrapnel: "#ff6b6b",
    drone_unlock: "#78f09a",
    drone_count: "#78f09a",
    drone_rapid: "#78f09a",
    drone_lens: "#78f09a",
    arc_unlock: "#b98cff",
    arc_amplifier: "#b98cff",
    arc_branch: "#b98cff",
    veteran_protocol: "#ffcf5a",
    orbital_laser: "#ffcf5a",
    black_hole: "#b98cff",
    plasma_aura: "#78f09a",
    frost_dash: "#8bdcff",
    starburst: "#ff6b6b",
    time_dilation: "#d18cff",
    overdrive: "#ff6b6b",
  };

  function upgradeAccent(upgrade) {
    return upgradeAccents[upgrade.id] || "#5ee2ff";
  }

  function createPlayerProxy(getPlayer) {
    return new Proxy({}, {
      get(_target, property) {
        return getPlayer()[property];
      },
      set(_target, property, value) {
        getPlayer()[property] = value;
        return true;
      },
    });
  }

  function createUpgrades(api) {
    const player = createPlayerProxy(api.getPlayer);
    const { levelStep, levelAdd, softCount, overflowBonus, applyReduction, syncDrones } = api;

    return [
    {
      id: "damage",
      name: "高能弹药",
      rarity: "common",
      softCap: 10,
      weight: 1.3,
      desc: "全武器伤害 +18%。",
      apply(level) {
        player.damageMult *= levelStep(level, 0.18, 12, 0.26);
      },
    },
    {
      id: "fire_rate",
      name: "过载枪管",
      rarity: "common",
      softCap: 8,
      weight: 1.15,
      desc: "全武器射速 +15%。",
      apply(level) {
        player.fireRate *= levelStep(level, 0.15, 10, 0.2);
        if (level > 18) player.damageMult *= 1 + Math.min(0.055, overflowBonus(level, 18, 0.0025));
      },
    },
    {
      id: "speed",
      name: "矢量推进",
      rarity: "common",
      softCap: 6,
      weight: 0.9,
      desc: "移动速度 +12%。",
      apply(level) {
        player.speed *= levelStep(level, 0.12, 8, 0.16);
      },
    },
    {
      id: "repair",
      name: "纳米修补",
      rarity: "common",
      softCap: 7,
      weight: 0.95,
      desc: "最大机体 +10，并回复 38 生命。",
      apply(level) {
        player.maxHp += Math.ceil(levelAdd(level, 10, 12, 0.32));
        player.hp = Math.min(player.maxHp, player.hp + levelAdd(level, 38, 12, 0.35));
      },
    },
    {
      id: "magnet",
      name: "磁吸雷达",
      rarity: "common",
      softCap: 5,
      weight: 0.85,
      desc: "经验拾取范围 +42。",
      apply(level) {
        player.pickupRange += levelAdd(level, 42, 10, 0.28);
      },
    },
    {
      id: "combat_scoop",
      name: "战场回收",
      rarity: "common",
      softCap: 5,
      weight: 0.88,
      desc: "经验收益 +15%，拾取范围 +24。",
      apply(level) {
        player.xpGainMult *= levelStep(level, 0.15, 12, 0.24);
        player.pickupRange += levelAdd(level, 24, 12, 0.28);
      },
    },
    {
      id: "ballistic_core",
      name: "弹道核心",
      rarity: "common",
      softCap: 6,
      weight: 0.82,
      desc: "弹速 +16%，己方弹丸尺寸 +10%。",
      apply(level) {
        player.projectileSpeedMult *= levelStep(level, 0.16, 10, 0.2);
        player.projectileSizeMult *= levelStep(level, 0.1, 10, 0.18);
      },
    },
    {
      id: "field_medic",
      name: "战地维护",
      rarity: "common",
      softCap: 5,
      weight: 0.72,
      desc: "每秒回复少量机体生命。",
      apply(level) {
        player.regen += levelAdd(level, 1.1, 10, 0.24);
      },
    },
    {
      id: "shield",
      name: "偏转护盾",
      rarity: "rare",
      softCap: 5,
      weight: 0.8,
      desc: "最大护盾 +24，脱战后自动恢复。",
      apply(level) {
        player.maxShield += Math.ceil(levelAdd(level, 24, 10, 0.3));
        player.shield = player.maxShield;
      },
    },
    {
      id: "shield_reactor",
      name: "护盾反应堆",
      rarity: "rare",
      softCap: 4,
      weight: 0.66,
      desc: "护盾恢复速度 +35%，最大护盾 +10。",
      apply(level) {
        player.shieldRegenMult *= levelStep(level, 0.35, 8, 0.18);
        player.maxShield += Math.ceil(levelAdd(level, 10, 10, 0.28));
        player.shield = Math.min(player.maxShield, player.shield + 10);
      },
    },
    {
      id: "armor_plate",
      name: "轻质装甲",
      rarity: "rare",
      softCap: 5,
      weight: 0.72,
      desc: "受到的伤害 -12%。",
      apply(level) {
        player.damageTakenMult = applyReduction(player.damageTakenMult, levelAdd(level, 0.12, 8, 0.18), 0.18);
      },
    },
    {
      id: "afterburner",
      name: "加力燃烧室",
      rarity: "rare",
      softCap: 4,
      weight: 0.7,
      desc: "冲刺冷却 -14%，移动速度 +5%。",
      apply(level) {
        player.dashCooldownMult = applyReduction(player.dashCooldownMult, levelAdd(level, 0.14, 8, 0.18), 0.22);
        player.speed *= levelStep(level, 0.05, 10, 0.18);
      },
    },
    {
      id: "phase_dash",
      name: "相位突进",
      rarity: "epic",
      softCap: 3,
      weight: 0.42,
      desc: "冲刺距离 +18%，冲刺持续时间略增。",
      apply(level) {
        player.dashPowerMult *= levelStep(level, 0.1, 8, 0.18);
        player.dashDurationMult *= levelStep(level, 0.08, 8, 0.18);
      },
    },
    {
      id: "pierce",
      name: "穿甲弹头",
      rarity: "rare",
      softCap: 4,
      weight: 0.72,
      desc: "机炮和僚机弹丸穿透提升；后续等级转化为弹丸火力。",
      apply(level) {
        const targetPierce = Math.min(28, level <= 4 ? level : 4 + Math.floor(Math.sqrt(level - 4) * 1.25));
        const addedPierce = targetPierce > player.pierce;
        player.pierce = Math.max(player.pierce, targetPierce);
        if (!addedPierce) {
          player.cannonDamageMult *= levelStep(level, 0.05, 16, 0.24);
          player.droneDamageMult *= levelStep(level, 0.04, 16, 0.24);
        }
      },
    },
    {
      id: "crit",
      name: "鹰眼火控",
      rarity: "rare",
      softCap: 5,
      weight: 0.72,
      desc: "暴击率 +8%。",
      apply(level) {
        player.critChance += levelAdd(level, 0.08, 8, 0.16);
        if (player.critChance > 0.88) {
          player.critDamage += (player.critChance - 0.88) * 0.35;
          player.critChance = 0.88;
        }
      },
    },
    {
      id: "crit_damage",
      name: "弱点校准",
      rarity: "rare",
      softCap: 4,
      weight: 0.56,
      desc: "暴击伤害 +35%。",
      apply(level) {
        player.critDamage += levelAdd(level, 0.35, 10, 0.22);
      },
    },
    {
      id: "cannon_fork",
      name: "双联机炮",
      rarity: "rare",
      softCap: 3,
      weight: 0.62,
      desc: "机炮弹道扩编；弹道有软上限，溢出等级转为机炮伤害和射速。",
      apply(level) {
        const previousShots = player.cannonShots;
        player.cannonShots = Math.max(player.cannonShots, softCount(1, level, 9, 1));
        const addedBarrel = player.cannonShots > previousShots;
        player.cannonDamageMult *= levelStep(level, addedBarrel ? 0.055 : 0.09, 14, 0.28);
        if (!addedBarrel) player.cannonFireRate *= levelStep(level, 0.035, 16, 0.22);
      },
    },
    {
      id: "cannon_overclock",
      name: "机炮超频",
      rarity: "rare",
      softCap: 5,
      weight: 0.7,
      desc: "机炮专属射速 +18%。",
      apply(level) {
        player.cannonFireRate *= levelStep(level, 0.18, 12, 0.22);
        if (level > 14) player.cannonDamageMult *= 1 + Math.min(0.06, overflowBonus(level, 14, 0.003));
      },
    },
    {
      id: "cannon_rail",
      name: "磁轨加速",
      rarity: "epic",
      softCap: 4,
      weight: 0.48,
      desc: "机炮伤害 +24%，弹速 +10%。",
      apply(level) {
        player.cannonDamageMult *= levelStep(level, 0.24, 12, 0.26);
        player.projectileSpeedMult *= levelStep(level, 0.1, 10, 0.18);
      },
    },
    {
      id: "ammo_spread",
      name: "红色火神炮",
      rarity: "rare",
      softCap: 999,
      weight: 0.76,
      desc: "主弹药追加宽扇火神弹；高等级提升弹幕密度和单发威力。",
      apply(level) {
        player.ammoSpreadLevel = level;
      },
    },
    {
      id: "ammo_laser",
      name: "蓝色雷射",
      rarity: "epic",
      softCap: 999,
      weight: 0.58,
      desc: "主弹药追加直线贯穿雷射；高等级强化光束数量、射程和灼穿伤害。",
      apply(level) {
        player.ammoLaserLevel = level;
      },
    },
    {
      id: "ammo_wave",
      name: "绿色波刃炮",
      rarity: "epic",
      softCap: 999,
      weight: 0.52,
      desc: "周期性释放宽幅波刃；高等级强化波刃体积、爆风和穿透。",
      apply(level) {
        player.ammoWaveLevel = level;
        player.ammoWaveTimer = Math.min(player.ammoWaveTimer, 0.2);
      },
    },
    {
      id: "ammo_homing",
      name: "黄色追踪针",
      rarity: "rare",
      softCap: 999,
      weight: 0.64,
      desc: "主弹药追加追踪针弹；高等级增加锁定数量、转向和补刀伤害。",
      apply(level) {
        player.ammoHomingLevel = level;
        player.ammoHomingTimer = Math.min(player.ammoHomingTimer, 0.12);
      },
    },
    {
      id: "ammo_plasma",
      name: "紫电锁链",
      rarity: "legendary",
      softCap: 999,
      weight: 0.34,
      desc: "主弹药追加锁链紫电；高等级增加跳跃、链距和首段伤害。",
      apply(level) {
        player.ammoPlasmaLevel = level;
        player.ammoPlasmaTimer = Math.min(player.ammoPlasmaTimer, 0.08);
      },
    },
    {
      id: "ammo_drill",
      name: "质子钻光",
      rarity: "legendary",
      softCap: 999,
      weight: 0.28,
      desc: "主弹药周期性发射质子钻光；高等级强化宽度、射程和贯穿爆发。",
      apply(level) {
        player.ammoDrillLevel = level;
        player.ammoDrillTimer = Math.min(player.ammoDrillTimer, 0.12);
      },
    },
    {
      id: "missile_unlock",
      name: "散射导弹",
      rarity: "rare",
      softCap: 1,
      weight: 0.95,
      desc: "解锁扇形导弹齐射。",
      requires() {
        return player.missileLevel === 0;
      },
      apply() {
        player.missileLevel = 1;
        player.missileVolley = 3;
      },
    },
    {
      id: "missile_volley",
      name: "蜂群挂架",
      rarity: "epic",
      softCap: 4,
      weight: 0.7,
      desc: "导弹齐射扩编；导弹数量有软上限，溢出等级转为伤害和射速。",
      requires() {
        return player.missileLevel > 0;
      },
      apply(level) {
        const previousVolley = player.missileVolley;
        player.missileLevel = Math.max(player.missileLevel, level + 1);
        player.missileVolley = Math.max(player.missileVolley, softCount(3, level, 12, 1));
        const addedRack = player.missileVolley > previousVolley;
        player.missileDamageMult *= levelStep(level, addedRack ? 0.06 : 0.1, 12, 0.28);
        if (!addedRack) player.missileFireRate *= levelStep(level, 0.035, 16, 0.22);
      },
    },
    {
      id: "missile_payload",
      name: "聚爆弹仓",
      rarity: "rare",
      softCap: 5,
      weight: 0.68,
      desc: "导弹伤害和爆炸范围提升。",
      requires() {
        return player.missileLevel > 0;
      },
      apply(level) {
        player.missileDamageMult *= levelStep(level, 0.22, 12, 0.24);
        player.missileBlastBonus = Math.min(300, player.missileBlastBonus + levelAdd(level, 6, 12, 0.25));
      },
    },
    {
      id: "missile_coolant",
      name: "导弹冷却液",
      rarity: "rare",
      softCap: 4,
      weight: 0.62,
      desc: "导弹发射频率 +18%。",
      requires() {
        return player.missileLevel > 0;
      },
      apply(level) {
        player.missileFireRate *= levelStep(level, 0.18, 12, 0.22);
        if (level > 16) player.missileDamageMult *= 1 + Math.min(0.055, overflowBonus(level, 16, 0.0025));
      },
    },
    {
      id: "missile_shrapnel",
      name: "破片弹头",
      rarity: "epic",
      softCap: 4,
      weight: 0.5,
      desc: "导弹爆炸范围 +12，导弹伤害 +10%。",
      requires() {
        return player.missileLevel > 0;
      },
      apply(level) {
        player.missileBlastBonus = Math.min(300, player.missileBlastBonus + levelAdd(level, 12, 12, 0.24));
        player.missileDamageMult *= levelStep(level, 0.1, 12, 0.24);
      },
    },
    {
      id: "drone_unlock",
      name: "僚机编队",
      rarity: "rare",
      softCap: 1,
      weight: 0.9,
      desc: "解锁 1 架环绕僚机。",
      requires() {
        return player.droneCount === 0;
      },
      apply() {
        player.droneLevel = 1;
        player.droneCount = 1;
        syncDrones();
      },
    },
    {
      id: "drone_count",
      name: "扩编协议",
      rarity: "epic",
      softCap: 5,
      weight: 0.68,
      desc: "僚机编队扩编；可见僚机有软上限，溢出等级强化僚机火力。",
      requires() {
        return player.droneCount > 0;
      },
      apply(level) {
        const previousDrones = player.droneCount;
        player.droneLevel = Math.max(player.droneLevel, level + 1);
        player.droneCount = Math.max(player.droneCount, softCount(1, level, 9, 1));
        const addedDrone = player.droneCount > previousDrones;
        player.droneDamageMult *= levelStep(level, addedDrone ? 0.055 : 0.1, 12, 0.28);
        if (!addedDrone) player.droneFireRate *= levelStep(level, 0.04, 14, 0.22);
        syncDrones();
      },
    },
    {
      id: "drone_rapid",
      name: "僚机加速",
      rarity: "rare",
      softCap: 5,
      weight: 0.64,
      desc: "僚机射速 +18%。",
      requires() {
        return player.droneCount > 0;
      },
      apply(level) {
        player.droneFireRate *= levelStep(level, 0.18, 12, 0.22);
        if (level > 14) player.droneDamageMult *= 1 + Math.min(0.06, overflowBonus(level, 14, 0.003));
      },
    },
    {
      id: "drone_lens",
      name: "僚机透镜",
      rarity: "rare",
      softCap: 5,
      weight: 0.58,
      desc: "僚机伤害 +18%，索敌范围提升。",
      requires() {
        return player.droneCount > 0;
      },
      apply(level) {
        player.droneDamageMult *= levelStep(level, 0.18, 12, 0.24);
        player.droneRangeBonus = Math.min(560, player.droneRangeBonus + levelAdd(level, 42, 12, 0.24));
      },
    },
    {
      id: "arc_unlock",
      name: "连锁电容",
      rarity: "epic",
      softCap: 4,
      weight: 0.52,
      desc: "击坠敌人时释放跳跃电弧。",
      apply(level) {
        player.arcLevel = level;
        player.arcDamageMult *= levelStep(level, 0.06, 14, 0.28);
      },
    },
    {
      id: "arc_amplifier",
      name: "电弧放大器",
      rarity: "epic",
      softCap: 4,
      weight: 0.46,
      desc: "电弧跳跃范围 +45，电弧伤害 +15%。",
      requires() {
        return player.arcLevel > 0;
      },
      apply(level) {
        player.arcRangeBonus = Math.min(620, player.arcRangeBonus + levelAdd(level, 45, 12, 0.24));
        player.arcDamageMult *= levelStep(level, 0.15, 12, 0.24);
      },
    },
    {
      id: "arc_branch",
      name: "分叉电链",
      rarity: "legendary",
      softCap: 2,
      weight: 0.2,
      desc: "电弧跳跃数扩展；跳数有软上限，溢出等级转为电弧伤害。",
      requires() {
        return player.arcLevel > 0;
      },
      apply(level) {
        const previousJumps = player.arcBonusJumps;
        player.arcBonusJumps = Math.max(player.arcBonusJumps, softCount(0, level, 7, 1));
        player.arcDamageMult *= levelStep(level, player.arcBonusJumps > previousJumps ? 0.07 : 0.11, 14, 0.28);
      },
    },
    {
      id: "veteran_protocol",
      name: "老兵协议",
      rarity: "legendary",
      softCap: 2,
      weight: 0.18,
      desc: "伤害 +12%，经验收益 +20%，受到伤害 -8%。",
      apply(level) {
        player.damageMult *= levelStep(level, 0.12, 12, 0.24);
        player.xpGainMult *= levelStep(level, 0.2, 12, 0.22);
        player.damageTakenMult = applyReduction(player.damageTakenMult, levelAdd(level, 0.08, 10, 0.2), 0.18);
      },
    },
    {
      id: "orbital_laser",
      name: "天基裁决",
      rarity: "legendary",
      softCap: 4,
      weight: 0.32,
      desc: "周期性召唤轨道激光，贯穿并灼烧目标区域。",
      apply(level) {
        player.orbitalLaserLevel = level;
        player.orbitalLaserTimer = Math.min(player.orbitalLaserTimer, 0.8);
      },
    },
    {
      id: "black_hole",
      name: "奇点炸弹",
      rarity: "legendary",
      softCap: 3,
      weight: 0.28,
      desc: "击坠敌人有概率生成黑洞，牵引并撕裂敌群。",
      apply(level) {
        player.blackHoleLevel = level;
      },
    },
    {
      id: "plasma_aura",
      name: "等离子星环",
      rarity: "epic",
      softCap: 5,
      weight: 0.46,
      desc: "机体周围生成持续伤害星环，等级越高范围越大。",
      apply(level) {
        player.plasmaAuraLevel = level;
      },
    },
    {
      id: "frost_dash",
      name: "霜爆突进",
      rarity: "epic",
      softCap: 4,
      weight: 0.42,
      desc: "冲刺时释放冰霜冲击，伤害并减速周围敌人。",
      apply(level) {
        player.frostNovaLevel = level;
        player.dashCooldownMult = applyReduction(player.dashCooldownMult, levelAdd(level, 0.06, 10, 0.18), 0.22);
      },
    },
    {
      id: "starburst",
      name: "星爆协议",
      rarity: "epic",
      softCap: 4,
      weight: 0.44,
      desc: "击坠敌人时有概率引发小型爆炸连锁。",
      apply(level) {
        player.killExplosionLevel = level;
      },
    },
    {
      id: "time_dilation",
      name: "时滞核心",
      rarity: "legendary",
      softCap: 3,
      weight: 0.2,
      desc: "压低敌方推进效率，所有敌人速度下降。",
      apply(level) {
        player.enemySlowMult = applyReduction(player.enemySlowMult, levelAdd(level, 0.1, 12, 0.18), 0.45);
        if (level > 12) player.damageMult *= 1 + Math.min(0.045, overflowBonus(level, 12, 0.002));
      },
    },
    {
      id: "overdrive",
      name: "红线过载",
      rarity: "legendary",
      softCap: 2,
      weight: 0.22,
      desc: "伤害 +18%，射速 +22%，最大机体 -8。",
      apply(level) {
        player.damageMult *= levelStep(level, 0.18, 12, 0.24);
        player.fireRate *= levelStep(level, 0.22, 12, 0.22);
        player.maxHp = Math.max(60, player.maxHp - Math.ceil(levelAdd(level, 8, 12, 0.25)));
        player.hp = Math.min(player.hp, player.maxHp);
      },
    },

    ];
  }

  window.GameContent = {
    activeSkillKeys,
    activeSkillLabels,
    createActiveSkillDefs,
    createUpgrades,
    defaultActiveSkills,
    difficulties,
    rarityLabel,
    stages,
    tacticalChipDefs,
    upgradeAccent,
  };
}());
