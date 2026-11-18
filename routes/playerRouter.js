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
 * Player creation and editing routes.
 *
 * The application must mount this router before mainRouter because
 * mainRouter handles GET /player/:id.
 *
 * The store contract is:
 *   addPlayer(player)              -> the created player
 *   getPlayer(playerId)            -> player | null
 *   updatePlayer(playerId, player) -> true if the player was updated
 *
 * Usage in app.js:
 *   app.use(require('./routes/playerRouter')(store));
 *
 * Routes:
 *   GET  /player/new       render the creation form
 *   POST /player           create a player
 *   GET  /player/:id/edit  render the editing form
 *   POST /player/:id/edit  update a player
 */
module.exports = function createPlayerRouter(store) {
    const router = express.Router();

    const positionOptions = (selectedPosition) => [
        { value: 'portero', label: 'Portero' },
        { value: 'defensa', label: 'Defensa' },
        { value: 'centrocampista', label: 'Centrocampista' },
        { value: 'delantero', label: 'Delantero' }
    ].map((position) => ({
        ...position,
        selected: position.value === selectedPosition
    }));

    const renderForm = (res, player, playerId) => {
        const isEdit = Boolean(player);
        const options = positionOptions(player && player.position);

        return res.render('playerForm', {
            player,
            isEdit,
            formTitle: isEdit ? 'Editar Jugador' : 'Crear Nuevo Jugador',
            submitLabel: isEdit ? 'Guardar cambios' : 'Guardar',
            action: isEdit ? `/player/${encodeURIComponent(playerId)}/edit` : '/player',
            hasPosition: options.some((position) => position.selected),
            positionOptions: options,
            hasImage: Boolean(player && player.image)
        });
    };

    const renderNotFound = (res) => res.status(404).render('error', {
        ok: false,
        title: 'Jugador no encontrado',
        message: 'El jugador solicitado no existe.',
        errors: [],
        hasErrors: false,
        backUrl: '/',
        backLabel: 'Volver a la página principal',
        retryUrl: '/player/new'
    });

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
                retryUrl: req.params.id
                    ? `/player/${encodeURIComponent(req.params.id)}/edit`
                    : '/player/new'
            });
        }
    };

    router.get('/player/new', (req, res) => {
        return renderForm(res, null);
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

    router.get('/player/:id/edit', handle(async (req, res) => {
        const player = await store.getPlayer(req.params.id);

        if (!player) {
            return renderNotFound(res);
        }

        return renderForm(res, player, req.params.id);
    }));

    router.post('/player/:id/edit', upload.single('image'), handle(async (req, res) => {
        const { id } = req.params;
        const existingPlayer = await store.getPlayer(id);

        if (!existingPlayer) {
            return renderNotFound(res);
        }

        const updatedPlayer = {
            player_name: req.body.player_name,
            team: req.body.team,
            position: req.body.position,
            league: req.body.league,
            description: req.body.description,
            photographer: req.body.photographer,
            price: req.body.price,
            date_of_birth: req.body.date_of_birth,
            image: req.file ? `/uploads/${req.file.filename}` : existingPlayer.image
        };

        const updateResult = await store.updatePlayer(id, updatedPlayer);
        if (updateResult === false) {
            return renderNotFound(res);
        }

        return res.render('confirmation', {
            ok: true,
            title: 'Jugador actualizado',
            message: `El jugador "${updatedPlayer.player_name}" se ha actualizado correctamente.`,
            backUrl: `/player/${encodeURIComponent(id)}`,
            backLabel: 'Volver al jugador'
        });
    }));

    return router;
};
