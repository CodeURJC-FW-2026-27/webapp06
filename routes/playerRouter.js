'use strict';

const crypto = require('node:crypto');
const express = require('express');
const fs = require('node:fs');
const multer = require('multer');
const path = require('node:path');

const uploadsDirectory = path.resolve(__dirname, '..', 'uploads');

fs.mkdirSync(uploadsDirectory, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: uploadsDirectory,
        filename: (req, file, callback) => {
            const extension = path.extname(file.originalname);
            callback(null, `${crypto.randomBytes(16).toString('hex')}${extension}`);
        }
    })
});

/**
 * Player creation routes.
 *
 * The application must mount this router before mainRouter because
 * mainRouter handles GET /player/:id.
 *
 * The store contract is:
 *   addPlayer(player) -> the created player
 *
 * Usage in app.js:
 *   app.use(require('./routes/playerRouter')(store));
 *
 * Routes:
 *   GET  /player/new  render the creation form
 *   POST /player      create a player
 */
module.exports = function createPlayerRouter(store) {
    const router = express.Router();

    const handle = (fn) => async (req, res) => {
        try {
            await fn(req, res);
        } catch (err) {
            console.error(err);
            return res.status(500).render('error', {
                ok: false,
                title: 'Error del servidor',
                message: 'Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.',
                errors: [],
                hasErrors: false,
                backUrl: '/',
                backLabel: 'Volver a la página principal',
                retryUrl: '/player/new'
            });
        }
    };

    router.get('/player/new', (req, res) => {
        return res.render('playerForm', {
            action: '/player'
        });
    });

    router.post('/player', upload.single('image'), handle(async (req, res) => {
        const player = {
            player_name: req.body.player_name,
            team: req.body.team,
            position: req.body.position,
            league: req.body.league,
            description: req.body.description,
            photographer: req.body.photographer,
            price: req.body.price,
            date_of_birth: req.body.date_of_birth,
            image: req.file ? `/uploads/${req.file.filename}` : ''
        };

        await store.addPlayer(player);

        return res.render('confirmation', {
            ok: true,
            title: 'Jugador creado',
            message: `El jugador "${player.player_name}" se ha creado correctamente.`,
            backUrl: '/',
            backLabel: 'Volver a la página principal'
        });
    }));

    return router;
};
