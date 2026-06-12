import kaplay from "kaplay";
import "kaplay/global";

console.log("Starting game...");

try {
    kaplay({
        touchToMouse: true,
        letterbox: true,
        background: "#1a1a2e",
    });
    console.log("Kaplay initialized");
} catch(e) {
    console.error("Kaplay init failed:", e);
}

loadRoot("./");

console.log("Adding background...");

add([
    rect(width(), height()),
    color(30, 30, 60),
    fixed(),
    z(-100),
]);

console.log("Adding player...");

const player = add([
    pos(center()),
    circle(20),
    color(60, 120, 255),
    anchor("center"),
    z(10),
    area(),
    "player",
]);

console.log("Player added at", player.pos);

// Add a simple box
add([
    pos(100, 100),
    rect(50, 50),
    color(255, 100, 100),
    anchor("center"),
    z(5),
]);

// Mouse click handler
onClick(() => {
    console.log("Clicked at", mousePos());
});

// Update
onUpdate(() => {
    // Simple movement with arrow keys
    if (isKeyDown("left")) player.move(-200, 0);
    if (isKeyDown("right")) player.move(200, 0);
    if (isKeyDown("up")) player.move(0, -200);
    if (isKeyDown("down")) player.move(0, 200);
});

console.log("Game setup complete");
