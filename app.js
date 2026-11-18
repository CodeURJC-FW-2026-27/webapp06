'use strict';

/**
 * app.js – Express server entry point for LEAGUES MARKET.
 *
 *   - Views are .html files rendered with Mustache; the shared partials
 *     (head, header, footer...) live in views/partials.
 *   - Static files (CSS, JS, favicon) are served from public/ and the player
 *     images from uploads/.
 *   - On startup the database and the uploads folder are filled with the demo
 *     data (see seed.js) and the routers are mounted.
 */

const express = require('express');
const mustacheExpress = require('mustache-express');
const path = require('node:path');

const { connectDB } = require('./db');
const { createStore } = require('./store');
const { loadDemoData } = require('./seed');
const { UPLOADS_DIR } = require('./utils/images');
const { categoryLinks, renderError } = require('./utils/viewHelpers');
const createHomeRouter = require('./routes/homeRouter');
const createPlayerRouter = require('./routes/playerRouter');
const createReviewRouter = require('./routes/reviewRouter');

const PORT = process.env.PORT || 3000;
const app = express();

// --- View engine: Mustache templates with the .html extension ---------------
app.engine('html', mustacheExpress(path.join(__dirname, 'views', 'partials'), '.html'));
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));

// Default values for the shared header, so every page shows the same search
// form and category buttons. The home page overrides them with the active
// filters.
app.locals.categories = categoryLinks();
app.locals.allUrl = '/';

// --- Static files and form parsing -------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.urlencoded({ extended: false }));

// --- Start ---------------------------------------------------------------------
(async () => {
    try {
        const db = await connectDB();
        const store = createStore(db);
        await loadDemoData(store);

        app.use(createHomeRouter(store));
        app.use(createPlayerRouter(store));
        app.use(createReviewRouter(store));

        // Any other URL: error page with the same look as the rest of the site.
        app.use((req, res) => renderError(res, {
            status: 404,
            title: 'Página no encontrada',
            message: 'La página que buscas no existe.'
        }));

        // Unexpected errors (Express 5 also forwards here the errors thrown by
        // async route handlers).
        app.use((err, req, res, next) => {
            console.error(err);
            if (res.headersSent) return next(err);
            return renderError(res, {
                status: 500,
                title: 'Error del servidor',
                message: 'Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.'
            });
        });

        app.listen(PORT, () => {
            console.log(`LEAGUES MARKET listening on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
})();
