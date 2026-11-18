'use strict';

/**
 * routes/mainRouter.js – Main application router.
 *
 * Implements:
 *   - GET /: Home-page route rendering the main entity list (LaLiga players)
 *     from MongoDB through index.mustache. Supports 6-item pagination (?page=N),
 *     diacritic-flexible player_name search (?search=...), and position category
 *     filtering (?position=...), preserving active filters across pagination links.
 *
 * Reconciles router dependencies:
 *   - createMainRouter(db)               -> returns the MongoDB-backed home-page router (GET /).
 *   - createMainRouter(store)            -> returns the store-backed player detail and deletion router
 *                                           (delegates to routes/playerDetailRouter.js).
 *   - createMainRouter({ db, store })    -> mounts both routers together.
 */

const express = require('express');
const createPlayerDetailRouter = require('./playerDetailRouter');

const ITEMS_PER_PAGE = 6;

/**
 * Builds a regex pattern that matches regardless of accents/diacritics and
 * escapes special regex characters.
 *
 * @param {string} str
 * @returns {string}
 */
function toDiacriticRegex(str) {
    return str
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/[aáàäâ]/gi, '[aáàäâ]')
        .replace(/[eéèëê]/gi, '[eéèëê]')
        .replace(/[iíìïî]/gi, '[iíìïî]')
        .replace(/[oóòöô]/gi, '[oóòöô]')
        .replace(/[uúùüû]/gi, '[uúùüû]')
        .replace(/[nñ]/gi, '[nñ]');
}

/**
 * Valid positions recognised by the domain (category buttons in the header).
 * Values must match the ones stored in MongoDB (title-cased singular).
 */
const VALID_POSITIONS = ['Portero', 'Defensa', 'Centrocampista', 'Delantero'];

/**
 * Factory: receives the database instance and returns the home-page router (GET /).
 *
 * @param {import('mongodb').Db} db
 * @returns {import('express').Router}
 */
function createHomeRouter(db) {
    const router = express.Router();
    const players = db.collection('players');

    router.get('/', async (req, res) => {
        try {
            // --- Build MongoDB filter ---
            const filter = {};
            const search   = (req.query.search   || '').trim();
            const position = (req.query.position  || '').trim();

            if (search) {
                // Case-insensitive substring match on player_name with diacritic flexibility.
                filter.player_name = { $regex: toDiacriticRegex(search), $options: 'i' };
            }

            if (position && VALID_POSITIONS.includes(position)) {
                filter.position = position;
            }

            // --- Pagination arithmetic ---
            const totalItems = await players.countDocuments(filter);
            const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

            let currentPage = parseInt(req.query.page, 10) || 1;
            if (currentPage < 1) currentPage = 1;
            if (currentPage > totalPages) currentPage = totalPages;

            const skip = (currentPage - 1) * ITEMS_PER_PAGE;

            // --- Fetch only the requested page ---
            const docs = await players
                .find(filter)
                .skip(skip)
                .limit(ITEMS_PER_PAGE)
                .toArray();

            // Prepare each player for the template (add string id).
            const playerList = docs.map((p) => ({
                ...p,
                id: String(p._id)
            }));

            // --- Build query-string base for pagination links ---
            const qsParts = [];
            if (search)   qsParts.push(`search=${encodeURIComponent(search)}`);
            if (position && VALID_POSITIONS.includes(position)) {
                qsParts.push(`position=${encodeURIComponent(position)}`);
            }
            const qsBase = qsParts.length ? qsParts.join('&') : '';

            function pageUrl(n) {
                const parts = [`page=${n}`];
                if (qsBase) parts.push(qsBase);
                return `/?${parts.join('&')}`;
            }

            // Numbered page links.
            const pages = [];
            for (let i = 1; i <= totalPages; i++) {
                pages.push({ number: i, url: pageUrl(i), active: i === currentPage });
            }

            // Previous / next helpers.
            const hasPrev = currentPage > 1;
            const hasNext = currentPage < totalPages;

            // --- Category buttons (mark the active one) ---
            const categories = VALID_POSITIONS.map((pos) => {
                const parts = [`position=${encodeURIComponent(pos)}`];
                if (search) parts.push(`search=${encodeURIComponent(search)}`);
                return {
                    label: pos === 'Portero'       ? 'Porteros'
                          : pos === 'Defensa'       ? 'Defensas'
                          : pos === 'Centrocampista' ? 'Centrocampistas'
                          : 'Delanteros',
                    value: pos,
                    url: `/?${parts.join('&')}`,
                    active: position === pos
                };
            });
            const allActive = !position;

            // --- Render ---
            res.render('index', {
                players:     playerList,
                hasPlayers:  playerList.length > 0,
                pages,
                showPagination: totalPages > 1,
                hasPrev,
                hasNext,
                prevUrl: hasPrev ? pageUrl(currentPage - 1) : null,
                nextUrl: hasNext ? pageUrl(currentPage + 1) : null,
                search,
                position,
                categories,
                allActive,
                allUrl: search ? `/?search=${encodeURIComponent(search)}` : '/'
            });
        } catch (err) {
            console.error('Error in GET /:', err);
            res.status(500).send('Internal server error');
        }
    });

    return router;
}

/**
 * Reconciled router factory:
 *   - If called with a MongoDB Db instance (has .collection), returns the home-page router.
 *   - If called with a store object (has .getPlayer), returns the detail and deletion router.
 *   - If called with an object containing { db, store }, mounts both.
 *
 * @param {import('mongodb').Db|object} dbOrStore
 * @returns {import('express').Router}
 */
module.exports = function createMainRouter(dbOrStore) {
    if (!dbOrStore) {
        throw new Error('createMainRouter requires a MongoDB Db instance or a store adapter');
    }

    // Combined object { db, store }
    if (dbOrStore.db && dbOrStore.store) {
        const router = express.Router();
        router.use(createHomeRouter(dbOrStore.db));
        router.use(createPlayerDetailRouter(dbOrStore.store));
        return router;
    }

    // Direct MongoDB Db instance
    if (typeof dbOrStore.collection === 'function') {
        return createHomeRouter(dbOrStore);
    }

    // Store adapter
    return createPlayerDetailRouter(dbOrStore);
};

module.exports.createHomeRouter = createHomeRouter;
module.exports.createPlayerDetailRouter = createPlayerDetailRouter;
