'use strict';

/**
 * app.js – Express server entry point for LEAGUES MARKET.
 *
 * Configures:
 *   - Mustache as the view engine (views/ directory, partials/ subdirectory).
 *   - Static files served from the project root (css/, js/, images/, assets/).
 *   - URL-encoded body parsing for form submissions.
 *   - MongoDB connection + seed on first run.
 *   - Main-entity home page router (Person 1).
 *
 * Secondary-entity router (Person 4) is NOT mounted here because it depends
 * on a `store` object whose methods (getPlayer, getReviews, etc.) are not yet
 * implemented.  See INTEGRATION NOTE below.
 */

const express = require('express');
const mustacheExpress = require('mustache-express');
const path = require('path');

const { connectDB } = require('./db');
const { seedIfEmpty } = require('./seed');
const createMainRouter = require('./routes/mainRouter');

const PORT = process.env.PORT || 3000;
const app = express();

// --- View engine -----------------------------------------------------------
app.engine('mustache', mustacheExpress(
    path.join(__dirname, 'views', 'partials') // partials directory
));
app.set('view engine', 'mustache');
app.set('views', path.join(__dirname, 'views'));

// --- Static assets ----------------------------------------------------------
// Redirect /index.html to / so the dynamic template is always served.
app.get('/index.html', (req, res) => {
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(301, `/${qs}`);
});

// Serve CSS, JS, images and other static files from the project root so that
// existing paths like /css/styles.css, /images/..., /assets/favicon.ico work.
// Disable default 'index.html' serving so that the dynamic GET / route in mainRouter is not shadowed.
app.use(express.static(path.join(__dirname), { index: false }));

// --- Body parser (form data) ------------------------------------------------
app.use(express.urlencoded({ extended: false }));

// --- Start ------------------------------------------------------------------
(async () => {
    try {
        const db = await connectDB();
        await seedIfEmpty(db);

        // Person 1 – home page, search, pagination
        app.use(createMainRouter(db));

        /*
         * INTEGRATION NOTE – Teammates' Store-backed Routers
         * --------------------------------------------------
         * Person 2 (playerRouter), Person 3 (playerDetailRouter / mainRouter(store)),
         * and Person 4 (secondaryRouter) export router factories that require a
         * `store` data-access adapter implementing:
         *   - getPlayers()
         *   - getPlayer(playerId)
         *   - addPlayer(player)
         *   - updatePlayer(playerId, player)
         *   - deletePlayer(playerId)
         *   - deleteReviewsByPlayer(playerId)
         *   - getPlayerByImage(imagePath, excludeId)
         *   - getReviews(playerId)
         *   - getReview(playerId, reviewId)
         *   - addReview(playerId, review)
         *   - updateReview(playerId, reviewId, f)
         *   - deleteReview(playerId, reviewId)
         *
         * Since those store methods are not implemented yet, mounting them with incomplete
         * dependencies or fake stubs is strictly avoided. Once a store module is created:
         *
         *   app.use(require('./routes/playerRouter')(store));
         *   app.use(require('./routes/playerDetailRouter')(store));
         *   app.use(require('./routes/secondaryRouter')(store));
         */

        app.listen(PORT, () => {
            console.log(`LEAGUES MARKET listening on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
})();
