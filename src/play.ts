import { DungeonManager } from './dungeon/DungeonManager.js';
import { MultipleDungeonSystem } from './systems/MultipleDungeonSystem.js';
import { PlayerEntity } from './entities/Player.js';
import { UISystem } from './systems/UISystem.js';
import { Position } from './types/core.js';

function clearScreen() {
  process.stdout.write('\x1Bc');
}

function render(ui: UISystem, player: PlayerEntity, dm: DungeonManager) {
  clearScreen();
  const mapStr = ui.renderDungeonAsString(player, true);
  console.log(mapStr);
  console.log('\n' + ui.getPlayerStatusLine(player));
  console.log("\nControls: Arrow keys=move, '>'=stairs down, '.'=wait, 'q'=quit");
}

async function main() {
  const dungeonManager = new DungeonManager();
  const multi = new MultipleDungeonSystem(dungeonManager);
  const ui = new UISystem(dungeonManager);

  const player = new PlayerEntity('player-1', 'Hero', { x: 0, y: 0 });

  // Enter the first dungeon
  const select = multi.selectDungeon('beginner-cave', player);
  if (!select.success) {
    console.error('Failed to enter dungeon:', select.message);
    process.exit(1);
  }

  const dungeon = dungeonManager.getCurrentDungeon();
  if (!dungeon) {
    console.error('No dungeon generated.');
    process.exit(1);
  }

  const spawn: Position = dungeon.playerSpawn;
  player.setPosition(spawn);
  dungeonManager.addEntity(player, spawn);

  render(ui, player, dungeonManager);

  // Input loop
  process.stdin.setRawMode?.(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  const onAdvanceFloor = () => {
    const adv = multi.advanceFloor(player);
    if (!adv.success) return;
    const newDungeon = dungeonManager.getCurrentDungeon();
    if (newDungeon) {
      const newSpawn = newDungeon.playerSpawn;
      player.setPosition(newSpawn);
      dungeonManager.addEntity(player, newSpawn);
    }
  };

  process.stdin.on('data', (key: string) => {
    // Quit
    if (key === 'q' || key === 'Q' || key === '\u0003') { // Ctrl+C
      process.stdin.setRawMode?.(false);
      process.stdin.pause();
      console.log('\nBye!');
      process.exit(0);
    }

    const current = player.position;
    let next: Position | null = null;

    // Arrow keys (ESC [ A/B/C/D)
    if (key === '\u001b[A') next = { x: current.x, y: current.y - 1 }; // Up
    else if (key === '\u001b[B') next = { x: current.x, y: current.y + 1 }; // Down
    else if (key === '\u001b[C') next = { x: current.x + 1, y: current.y }; // Right
    else if (key === '\u001b[D') next = { x: current.x - 1, y: current.y }; // Left
    else if (key === '.') {
      // wait/skip turn
    } else if (key === '>') {
      // Try to use stairs down if on it
      const cell = dungeonManager.getCellAt(player.position);
      if (cell && cell.type === 'stairs-down') {
        onAdvanceFloor();
      }
    }

    if (next) {
      if (dungeonManager.moveEntity(player, next)) {
        // moved successfully
      }
    }

    render(ui, player, dungeonManager);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
