/**
 * routes/reviewRouter.js – Reviews of a player (secondary entity, LaLiga
 * Card Review). They are listed, and created, on the player's detail page.
 *
 * Routes:
 *   POST /player/:playerId/reviews                    create a review
 *   GET  /player/:playerId/reviews/:reviewId/edit     form to edit a review
 *   POST /player/:playerId/reviews/:reviewId/edit     update a review
 *   POST /player/:playerId/reviews/:reviewId/delete   delete a review
 *
 * Creating and editing share the form fields (partials/reviewFields.html)
 * and the handler that validates and saves the data (saveReview).
 */

const express = require('express');
const { REVIEW_LIMITS, todayISO, validateReview } = require('../utils/validator');
const {
    playerUrl,
    ratingOptions,
    renderConfirmation,
    renderError,
    renderPlayerNotFound,
    toPlayerView,
    toReviewView
} = require('../utils/viewHelpers');

const reviewFormUrl = (playerId, reviewId) => `/player/${playerId}/reviews/${reviewId}/edit`;

function renderReviewNotFound(res, playerId) {
    return renderError(res, {
        status: 404,
        title: 'Reseña no encontrada',
        message: 'La reseña solicitada no existe.',
        backUrl: playerUrl(playerId),
        backLabel: 'Volver al jugador'
    });
}

/**
 * @param {ReturnType<import('../store').createStore>} store
 * @returns {import('express').Router}
 */
module.exports = function createReviewRouter(store) {
    const router = express.Router();

    /**
     * Creates (POST /player/:playerId/reviews) or updates
     * (POST /player/:playerId/reviews/:reviewId/edit) a review.
     */
    async function saveReview(req, res) {
        const { playerId, reviewId } = req.params;
        const player = await store.getPlayer(playerId);
        if (!player) return renderPlayerNotFound(res);

        const existingReview = reviewId ? await store.getReview(playerId, reviewId) : null;
        if (reviewId && !existingReview) return renderReviewNotFound(res, playerId);

        const validation = validateReview(req.body, {
            existingReviews: await store.getReviews(playerId),
            excludeId: reviewId
        });
        if (!validation.valid) {
            return renderError(res, {
                title: existingReview ? 'No se pudo editar la reseña' : 'No se pudo crear la reseña',
                message: 'Revisa los siguientes errores:',
                errors: validation.errors,
                backUrl: playerUrl(playerId),
                backLabel: 'Volver al jugador',
                retryUrl: existingReview ? reviewFormUrl(playerId, reviewId) : null
            });
        }

        if (existingReview) {
            const updated = await store.updateReview(playerId, reviewId, validation.values);
            if (!updated) return renderReviewNotFound(res, playerId);
        } else {
            await store.addReview(playerId, validation.values);
        }

        return renderConfirmation(res, {
            title: existingReview ? 'Reseña editada' : 'Reseña creada',
            message: `La reseña de "${validation.values.nickname}" se ha ${existingReview ? 'actualizado' : 'añadido'} correctamente.`,
            backUrl: playerUrl(playerId),
            backLabel: 'Volver al jugador'
        });
    }

    // CREATE (the form is on the player's detail page) ---------------------
    router.post('/player/:playerId/reviews', saveReview);

    // EDIT -----------------------------------------------------------------
    router.get('/player/:playerId/reviews/:reviewId/edit', async (req, res) => {
        const { playerId, reviewId } = req.params;
        const player = await store.getPlayer(playerId);
        if (!player) return renderPlayerNotFound(res);
        const review = await store.getReview(playerId, reviewId);
        if (!review) return renderReviewNotFound(res, playerId);

        return res.render('reviewForm', {
            player: toPlayerView(player),
            review: toReviewView(review),
            action: reviewFormUrl(playerId, reviewId),
            cancelUrl: playerUrl(playerId),
            ratings: ratingOptions(review.rating),
            limits: REVIEW_LIMITS,
            today: todayISO()
        });
    });
    router.post('/player/:playerId/reviews/:reviewId/edit', saveReview);

    // DELETE ---------------------------------------------------------------
    router.post('/player/:playerId/reviews/:reviewId/delete', async (req, res) => {
        const { playerId, reviewId } = req.params;
        const player = await store.getPlayer(playerId);
        if (!player) return renderPlayerNotFound(res);
        const deleted = await store.deleteReview(playerId, reviewId);
        if (!deleted) return renderReviewNotFound(res, playerId);

        return renderConfirmation(res, {
            title: 'Reseña borrada',
            message: 'La reseña se ha borrado correctamente.',
            backUrl: playerUrl(playerId),
            backLabel: 'Volver al jugador'
        });
    });

    return router;
};
