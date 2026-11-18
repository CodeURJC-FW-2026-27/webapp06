/**
 * seed.js – Loads the demo data every time the application starts.
 *
 *   - Players and their reviews: data/data.json (each player lists its reviews).
 *   - Player images: data/images, copied into the uploads folder, which is
 *     where the application keeps every player image.
 *
 * The previous contents of the database and of the uploads folder are removed
 * first, so the demo always starts from the same state and every player in
 * the database has its image in uploads.
 */

const fs = require('node:fs/promises');
const path = require('node:path');
const { UPLOADS_DIR } = require('./utils/images');

const DATA_DIR = path.join(__dirname, 'data');

/**
 * @param {ReturnType<import('./store').createStore>} store
 */
async function loadDemoData(store) {
    const players = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'data.json'), 'utf8'));

    await store.deleteAll();
    let reviewCount = 0;
    for (const { reviews = [], ...player } of players) {
        const playerId = await store.addPlayer(player);
        for (const review of reviews) {
            await store.addReview(playerId, review);
            reviewCount++;
        }
    }

    await fs.rm(UPLOADS_DIR, { recursive: true, force: true });
    await fs.cp(path.join(DATA_DIR, 'images'), UPLOADS_DIR, { recursive: true });

    console.log(`Demo data loaded: ${players.length} players and ${reviewCount} reviews.`);
}

module.exports = { loadDemoData };
