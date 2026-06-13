import kaplay from "kaplay";
import "kaplay/global";

kaplay({
    touchToMouse: true,
    letterbox: true,
    width: 480,
    height: 800,
    background: "#0a0a14",
});

loadRoot("./");

// ─── Game State ───
const game = {
    paused: false,
    speed: 240,
    fireRate: 1.0,
    bullets: 1,
    xp: 0,
    xpNext: 50,
    level: 1,
    joystickDir: vec2(0, 0),
    keysHeld: { left: false, right: false, up: false, down: false },
    enemySpeed: 60,
};

// ─── Player ───
let playerHP = 5;
let playerMaxHP = 5;
let invincibleTimer = 0;
let gameOver = false;

const player = add([
    pos(center()),
    circle(18),
    color(60, 120, 255),
    outline(2, rgb(100, 160, 255)),
    anchor("center"),
    z(10),
    area(),
    "player",
]);

// Invincibility blink + HP check
player.onUpdate(() => {
    if (invincibleTimer > 0) {
        invincibleTimer -= dt();
        player.opacity = Math.sin(invincibleTimer * 20) > 0 ? 0.3 : 1;
    } else {
        player.opacity = 1;
    }
    if (playerHP <= 0) {
        triggerGameOver();
    }
});

// ─── Virtual Joystick ───
const J_RADIUS = 70;
const J_KNOB = 30;
const JX = width() / 2;
const JY = height() - 90;

add([
    pos(JX, JY),
    circle(J_RADIUS),
    color(255, 255, 255),
    opacity(0.12),
    anchor("center"),
    fixed(),
    z(100),
]);

const jKnob = add([
    pos(JX, JY),
    circle(J_KNOB),
    color(255, 255, 255),
    opacity(0.35),
    anchor("center"),
    fixed(),
    z(101),
]);

let touchId = null;

onTouchStart((pos, t) => {
    if (game.paused) return;
    if (pos.dist(vec2(JX, JY)) < 160) {
        touchId = t.identifier;
    }
});

onTouchMove((pos, t) => {
    if (t.identifier !== touchId) return;
    const offset = pos.sub(vec2(JX, JY));
    const maxR = J_RADIUS * 0.55;
    const len = offset.len();
    const clamped = len > maxR ? offset.unit().scale(maxR) : offset;
    jKnob.pos = vec2(JX, JY).add(clamped);
    game.joystickDir = len > 10 ? offset.unit() : vec2(0, 0);
});

onTouchEnd((pos, t) => {
    if (t.identifier === touchId) {
        touchId = null;
        jKnob.pos = vec2(JX, JY);
        game.joystickDir = vec2(0, 0);
    }
});

// ─── Keyboard ───
onKeyDown("left", () => game.keysHeld.left = true);
onKeyRelease("left", () => game.keysHeld.left = false);
onKeyDown("right", () => game.keysHeld.right = true);
onKeyRelease("right", () => game.keysHeld.right = false);
onKeyDown("up", () => game.keysHeld.up = true);
onKeyRelease("up", () => game.keysHeld.up = false);
onKeyDown("down", () => game.keysHeld.down = true);
onKeyRelease("down", () => game.keysHeld.down = false);

// ─── Player Movement ───
onUpdate(() => {
    if (game.paused || gameOver) return;

    let mx = 0, my = 0;
    if (game.keysHeld.left) mx -= 1;
    if (game.keysHeld.right) mx += 1;
    if (game.keysHeld.up) my -= 1;
    if (game.keysHeld.down) my += 1;

    let dir;
    if (mx !== 0 || my !== 0) {
        dir = vec2(mx, my).unit();
    } else if (game.joystickDir.len() > 0.1) {
        dir = game.joystickDir;
    } else {
        return;
    }

    player.pos = player.pos.add(dir.scale(game.speed * dt()));
    setCamPos(player.pos);
});

// ─── Enemy Spawning ───
let spawnTimer = 0;

onUpdate(() => {
    if (game.paused || gameOver) return;
    spawnTimer += dt();
    const interval = Math.max(0.4, 1.2 - game.level * 0.05);
    if (spawnTimer >= interval) {
        spawnTimer = 0;
        spawnEnemy();
        if (game.level >= 3) spawnEnemy();
    }
});

function spawnEnemy() {
    const angle = rand(0, Math.PI * 2);
    const dist = 500 + rand(0, 200);
    const x = player.pos.x + Math.cos(angle) * dist;
    const y = player.pos.y + Math.sin(angle) * dist;

    const size = 20 + rand(-3, 3);

    add([
        pos(x, y),
        rect(size, size),
        color(220, 40, 40),
        outline(1, rgb(200, 20, 20)),
        anchor("center"),
        area(),
        z(5),
        "enemy",
    ]);
}

// ─── Enemy Movement ───
onUpdate("enemy", (e) => {
    if (game.paused || gameOver) return;
    if (player.pos.dist(e.pos) > 1200) {
        destroy(e);
        return;
    }
    const dir = player.pos.sub(e.pos).unit();
    const spd = game.enemySpeed + game.level * 5;
    e.pos = e.pos.add(dir.scale(spd * dt()));
});

// ─── Auto-Shoot ───
let shootTimer = 0;

onUpdate(() => {
    if (game.paused) return;
    shootTimer += dt();
    if (shootTimer >= game.fireRate) {
        shootTimer = 0;
        autoShoot();
    }
});

function autoShoot() {
    const enemies = get("enemy");
    if (enemies.length === 0) return;

    let nearest = enemies[0];
    let minDist = player.pos.dist(nearest.pos);
    for (const e of enemies) {
        const d = player.pos.dist(e.pos);
        if (d < minDist) { minDist = d; nearest = e; }
    }

    const dir = nearest.pos.sub(player.pos).unit();

    for (let i = 0; i < game.bullets; i++) {
        const spread = (i - (game.bullets - 1) / 2) * 0.2;
        const bDir = dir.rotate(spread);
        add([
            pos(player.pos.add(dir.scale(30))),
            circle(5),
            color(255, 255, 80),
            outline(1, rgb(255, 200, 50)),
            anchor("center"),
            area(),
            z(6),
            move(bDir, 500),
            opacity(1),
            lifespan(1.5),
            "bullet",
        ]);
    }
}

// ─── Collisions (manual distance-based) ───
onUpdate("bullet", (b) => {
    for (const e of get("enemy")) {
        if (b.pos.dist(e.pos) < 20) {
            destroy(b);
            add([
                pos(e.pos),
                rect(8, 8),
                color(80, 220, 80),
                anchor("center"),
                area(),
                z(3),
                "xp",
            ]);
            destroy(e);
            return;
        }
    }
});

onUpdate(() => {
    if (invincibleTimer > 0 || gameOver) return;
    for (const e of get("enemy")) {
        if (player.pos.dist(e.pos) < 25) {
            playerHP -= 1;
            destroy(e);
            invincibleTimer = 1.0;
            break;
        }
    }
});

function triggerGameOver() {
    if (gameOver) return;
    gameOver = true;
    game.paused = true;
    destroyAll("enemy");
    destroyAll("bullet");
    destroyAll("xp");

    add([
        rect(width(), height()),
        color(0, 0, 0),
        opacity(0.8),
        fixed(),
        z(200),
    ]);

    add([
        text("GAME OVER 💀", { size: 32 }),
        pos(width() / 2, height() / 2 - 30),
        anchor("center"),
        color(255, 80, 80),
        fixed(),
        z(201),
    ]);

    add([
        text(`Level atingido: ${game.level}`, { size: 18 }),
        pos(width() / 2, height() / 2 + 20),
        anchor("center"),
        color(200, 200, 200),
        fixed(),
        z(201),
    ]);

    add([
        text("Atualize a página para jogar de novo", { size: 14 }),
        pos(width() / 2, height() / 2 + 55),
        anchor("center"),
        color(150, 150, 150),
        fixed(),
        z(201),
    ]);
}

// ─── XP Magnet ───
onUpdate("xp", (x) => {
    if (game.paused) return;
    const dist = player.pos.dist(x.pos);
    if (dist < 90) {
        const dir = player.pos.sub(x.pos).unit();
        x.pos = x.pos.add(dir.scale(250 * dt()));
    }
});

// ─── XP Collection (manual distance) ───
onUpdate(() => {
    for (const x of get("xp")) {
        if (player.pos.dist(x.pos) < 22) {
            destroy(x);
            game.xp += 10;
            checkLevelUp();
        }
    }
});

// ─── HUD ───
onDraw(() => {
    const barW = Math.min(260, width() - 40);
    const barH = 14;
    const bx = 20, by = 20;

    drawRect({
        pos: vec2(bx, by),
        width: barW,
        height: barH,
        color: rgb(30, 30, 45),
        radius: 6,
        fixed: true,
    });

    const fill = Math.min(1, game.xp / game.xpNext);
    if (fill > 0) {
        drawRect({
            pos: vec2(bx, by),
            width: barW * fill,
            height: barH,
            color: rgb(80, 220, 80),
            radius: 6,
            fixed: true,
        });
    }

    drawText({
        text: `LV ${game.level}`,
        pos: vec2(bx, by + barH + 8),
        size: 14,
        color: rgb(180, 220, 180),
        fixed: true,
    });

    drawText({
        text: `${game.xp}/${game.xpNext} XP`,
        pos: vec2(bx + 55, by + barH + 8),
        size: 12,
        color: rgb(140, 180, 140),
        fixed: true,
    });

    drawText({
        text: `👾 ${get("enemy").length}`,
        pos: vec2(width() - 20, by + barH + 8),
        size: 13,
        color: rgb(200, 120, 120),
        fixed: true,
        anchor: "right",
    });

    // Health bar
    const hp = playerHP;
    const maxHp = playerMaxHP;
    const hpW = 80;
    drawText({
        text: "❤️",
        pos: vec2(width() - 20 - hpW - 25, by + barH + 8),
        size: 11,
        color: rgb(255, 100, 100),
        fixed: true,
    });
    drawRect({
        pos: vec2(width() - 20 - hpW, by),
        width: hpW,
        height: barH,
        color: rgb(50, 20, 20),
        radius: 6,
        fixed: true,
    });
    drawRect({
        pos: vec2(width() - 20 - hpW, by),
        width: hpW * (hp / maxHp),
        height: barH,
        color: rgb(255, 60, 60),
        radius: 6,
        fixed: true,
    });
});

// ─── Level Up ───
function checkLevelUp() {
    if (game.xp >= game.xpNext) {
        game.xp -= game.xpNext;
        game.level += 1;
        game.xpNext = Math.floor(game.xpNext * 1.45);
        showUpgradeUI();
    }
}

function showUpgradeUI() {
    game.paused = true;

    add([
        rect(width(), height()),
        color(0, 0, 0),
        opacity(0.75),
        fixed(),
        z(200),
        "upgradeUI",
    ]);

    add([
        text("LEVEL UP! 🎉", { size: 26 }),
        pos(width() / 2, height() / 2 - 150),
        anchor("center"),
        color(255, 255, 100),
        fixed(),
        z(201),
        "upgradeUI",
    ]);

    const options = [
        { text: "⚡ Tiro mais rápido", apply: () => { game.fireRate = Math.max(0.2, game.fireRate - 0.15); } },
        { text: "💥 +1 Projétil", apply: () => { game.bullets += 1; } },
        { text: "🏃 +Velocidade", apply: () => { game.speed += 30; } },
    ];

    const chosen = [...options].sort(() => Math.random() - 0.5).slice(0, 3);

    chosen.forEach((upg, i) => {
        const y = height() / 2 - 60 + i * 85;

        add([
            rect(260, 58),
            pos(width() / 2, y),
            anchor("center"),
            color(50, 50, 75),
            outline(2, rgb(100, 100, 150)),
            fixed(),
            z(201),
            area(),
            "upgradeUI",
            "upgradeBtn",
            { upg },
        ]);

        add([
            text(upg.text, { size: 16 }),
            pos(width() / 2, y),
            anchor("center"),
            color(255, 255, 255),
            fixed(),
            z(202),
            "upgradeUI",
        ]);
    });

    onClick("upgradeBtn", (btn) => {
        btn.upg.apply();
        destroyAll("upgradeUI");
        game.paused = false;
    });
}
