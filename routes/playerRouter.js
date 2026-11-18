'use strict';

/**
 * routes/playerRouter.js – Pages of the main entity (LaLiga Player).
 *
 * Routes:
 *   GET  /player/new          empty form to create a player
 *   POST /player              create a player (multipart form with its image)
 *   GET  /player/:id          detail page, with the player's reviews
 *   GET  /player/:id/edit     the same form, filled with the player's data
 *   POST /player/:id/edit     update a player (a new image is optional)
 *   POST /player/:id/delete   delete a player, its reviews and its image
 *
 * Creating and editing share the form view (playerForm.html) and the handler
 * that validates and saves the data (savePlayer).
 */

const express = require('express');
const { PLAYER_LIMITS, REVIEW_LIMITS, todayISO, validatePlayer } = require('../utils/validator');
const {
    IMAGE_ACCEPT,
    IMAGE_MAX_MB,
    deleteImage,
    imageUpload,
    uploadErrorMessage
} = require('../utils/images');
const {
    playerUrl,
    positionOptions,
    ratingOptions,
    renderConfirmation,
    renderError,
    renderPlayerNotFound,
    toPlayerView,
    toReviewView
} = require('../utils/viewHelpers');

const playerFormUrl = (playerId) => (playerId ? `/player/${playerId}/edit` : '/player/new');

/** Date `years` years before `now` as YYYY-MM-DD (limits of the birth date input). */
function dateYearsAgo(years, now = new Date()) {
    const year = now.getFullYear() - years;
    const month = now.getMonth();
    const day = Math.min(now.getDate(), new Date(year, month + 1, 0).getDate());
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Multer middleware for the player form. If the uploaded file is rejected
 * (wrong type, too big...) the error page is shown instead.
 */
function receivePlayerImage(req, res, next) {
    imageUpload(req, res, (error) => {
        if (!error) return next();
        const message = uploadErrorMessage(error);
        if (!message) return next(error);
        return renderError(res, {
            title: 'Error al subir la imagen',
            message,
            retryUrl: playerFormUrl(req.params.id)
        });
    });
}

/**
 * @param {ReturnType<import('../store').createStore>} store
 * @returns {import('express').Router}
 */
module.exports = function createPlayerRouter(store) {
    const router = express.Router();

    /** Form to create a player (player = null) or to edit `player`. */
    function renderPlayerForm(res, player) {
        const isEdit = Boolean(player);
        const now = new Date();
        return res.render('playerForm', {
            player: isEdit ? toPlayerView(player) : null,
            isEdit,
            formTitle: isEdit ? 'Editar jugador' : 'Crear nuevo jugador',
            submitLabel: isEdit ? 'Guardar cambios' : 'Guardar',
            action: isEdit ? playerFormUrl(player._id) : '/player',
            cancelUrl: isEdit ? playerUrl(player._id) : '/',
            positions: positionOptions(player?.position),
            hasPosition: Boolean(player?.position),
            limits: PLAYER_LIMITS,
            imageAccept: IMAGE_ACCEPT,
            imageMaxMb: IMAGE_MAX_MB,
            minBirthDate: dateYearsAgo(PLAYER_LIMITS.AGE_MAX, now),
            maxBirthDate: dateYearsAgo(PLAYER_LIMITS.AGE_MIN, now)
        });
    }

    /**
     * Creates (POST /player) or updates (POST /player/:id/edit) a player.
     * Both use the same validation; if anything is wrong, the error page
     * lists every problem. A new image that does not end up saved with the
     * player is always removed from the uploads folder.
     */
    async function savePlayer(req, res) {
        let imageSaved = false;
        try {
            const playerId = req.params.id;
            const existingPlayer = playerId ? await store.getPlayer(playerId) : null;
            if (playerId && !existingPlayer) return renderPlayerNotFound(res);

            const validation = validatePlayer(req.body, {
                existingPlayers: await store.getPlayerNames(),
                excludeId: playerId,
                hasImage: Boolean(req.file || existingPlayer?.image)
            });
            if (!validation.valid) {
                return renderError(res, {
                    title: 'Datos del jugador no válidos',
                    message: 'Corrige los siguientes errores:',
                    errors: validation.errors,
                    backUrl: existingPlayer ? playerUrl(playerId) : '/',
                    backLabel: existingPlayer ? 'Volver al jugador' : 'Volver a la página principal',
                    retryUrl: playerFormUrl(playerId)
                });
            }

            const player = {
                ...validation.values,
                image: req.file ? req.file.filename : existingPlayer.image
            };

            let savedId = playerId;
            if (existingPlayer) {
                // false if the player was deleted while the form was being sent
                const updated = await store.updatePlayer(playerId, player);
                if (!updated) return renderPlayerNotFound(res);
            } else {
                savedId = await store.addPlayer(player);
            }
            imageSaved = true;

            if (existingPlayer && req.file) {
                await deleteImage(existingPlayer.image);
            }
            return renderConfirmation(res, {
                title: existingPlayer ? 'Jugador actualizado' : 'Jugador creado',
                message: `El jugador "${player.player_name}" se ha ${existingPlayer ? 'actualizado' : 'creado'} correctamente.`,
                backUrl: playerUrl(savedId),
                backLabel: 'Ver jugador'
            });
        } finally {
            if (!imageSaved) {
                await deleteImage(req.file?.filename);
            }
        }
    }

    // CREATE ---------------------------------------------------------------
    router.get('/player/new', (req, res) => renderPlayerForm(res, null));
    router.post('/player', receivePlayerImage, savePlayer);

    // DETAIL ---------------------------------------------------------------
    router.get('/player/:id', async (req, res) => {
        const player = await store.getPlayer(req.params.id);
        if (!player) return renderPlayerNotFound(res);

        const reviews = await store.getReviews(req.params.id);
        return res.render('playerDetail', {
            player: toPlayerView(player),
            reviews: reviews.map(toReviewView),
            // Empty form to add a review.
            ratings: ratingOptions(),
            limits: REVIEW_LIMITS,
            today: todayISO()
        });
    });

    // EDIT -----------------------------------------------------------------
    router.get('/player/:id/edit', async (req, res) => {
        const player = await store.getPlayer(req.params.id);
        if (!player) return renderPlayerNotFound(res);
        return renderPlayerForm(res, player);
    });
    router.post('/player/:id/edit', receivePlayerImage, savePlayer);

    // DELETE ---------------------------------------------------------------
    router.post('/player/:id/delete', async (req, res) => {
        const player = await store.deletePlayer(req.params.id);
        if (!player) return renderPlayerNotFound(res);

        await deleteImage(player.image);
        return renderConfirmation(res, {
            title: 'Jugador borrado',
            message: `El jugador "${player.player_name}" y sus reseñas se han borrado correctamente.`
        });
    });

    return router;
};
