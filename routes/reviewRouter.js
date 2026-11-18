'use strict';

const express = require('express');
const { validateReview } = require('../utils/validator');

/**
 * Rutas CRUD de la entidad secundaria (LaLiga Card Review).
 *
 * Se exporta una fábrica para no depender de cómo se implemente la base de
 * datos: quien monte la app le pasa un `store` con esta interfaz (todo async):
 *
 *   getPlayer(playerId)                  -> jugador | null
 *   getReviews(playerId)                 -> reseñas del jugador
 *   getReview(playerId, reviewId)        -> reseña | null
 *   addReview(playerId, review)          -> reseña creada
 *   updateReview(playerId, reviewId, f)  -> true si existía y se actualizó
 *   deleteReview(playerId, reviewId)     -> true si existía y se borró
 *
 * Uso en app.js:
 *   app.use(require('./routes/secondaryRouter')(store));
 *
 * Rutas (todas con el prefijo /player/:playerId/reviews):
 *   POST   /                   crear (formulario de la página de detalle)
 *   GET    /:reviewId/edit     formulario de edición
 *   POST   /:reviewId/edit     guardar la edición
 *   POST   /:reviewId/delete   borrar
 */

const PLAYER_URL = (playerId) => `/player/${encodeURIComponent(playerId)}`;

function reviewId(review) {
    return String(review.id ?? review._id ?? '');
}

/** "2026-10-08" -> "08/10/2026" */
function formatDate(iso) {
    const [y, m, d] = String(iso).split('-');
    return y && m && d ? `${d}/${m}/${y}` : String(iso);
}

/**
 * Prepara una reseña para las plantillas (id como string, fecha legible,
 * estrellas). El router principal debe usarla al renderizar detail.mustache:
 *   reviews: (await store.getReviews(id)).map(formatReview)
 */
function formatReview(review) {
    const rating = Number(review.rating) || 0;
    return {
        ...review,
        id: reviewId(review),
        date_label: formatDate(review.review_date),
        rating_label: `${rating}/5`
    };
}

const RATING_LABELS = ['Mala', 'Regular', 'Buena', 'Muy buena', 'Excelente'];

/**
 * Opciones del <select> de puntuación (Mustache no puede comparar valores,
 * así que se marca `selected` aquí). El router principal debe pasar
 * `ratings: ratingOptions()` al renderizar detail.mustache.
 */
function ratingOptions(selected) {
    return RATING_LABELS.map((label, i) => ({
        value: i + 1,
        label: `${i + 1} - ${label}`,
        selected: String(selected) === String(i + 1)
    }));
}

module.exports = function createSecondaryRouter(store) {
    const router = express.Router({ mergeParams: true });

    // Página de confirmación / error común a las tres operaciones.
    function renderResult(res, { status = 200, ok, title, message, errors = [], playerId, retryUrl }) {
        return res.status(status).render('secondaryResult', {
            ok,
            title,
            message,
            errors,
            hasErrors: errors.length > 0,
            backUrl: PLAYER_URL(playerId),
            retryUrl
        });
    }

    function notFound(res, playerId, what) {
        return renderResult(res, {
            status: 404,
            ok: false,
            title: 'No encontrado',
            message: `${what} no existe.`,
            playerId
        });
    }

    function serverError(res, playerId, err) {
        console.error(err);
        return renderResult(res, {
            status: 500,
            ok: false,
            title: 'Error del servidor',
            message: 'Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.',
            playerId
        });
    }

    // Envuelve los handlers async para capturar cualquier excepción.
    const handle = (fn) => async (req, res) => {
        try {
            await fn(req, res);
        } catch (err) {
            serverError(res, req.params.playerId, err);
        }
    };

    // CREAR ---------------------------------------------------------------
    router.post('/player/:playerId/reviews', handle(async (req, res) => {
        const { playerId } = req.params;
        const player = await store.getPlayer(playerId);
        if (!player) return notFound(res, playerId, 'El jugador');

        const existing = await store.getReviews(playerId);
        const result = validateReview(req.body, { existingReviews: existing });

        if (!result.valid) {
            return renderResult(res, {
                status: 400,
                ok: false,
                title: 'No se pudo crear la reseña',
                message: 'Revisa los siguientes errores:',
                errors: result.errors,
                playerId
            });
        }

        await store.addReview(playerId, result.values);
        return renderResult(res, {
            ok: true,
            title: 'Reseña creada',
            message: `La reseña de "${result.values.nickname}" se ha añadido correctamente.`,
            playerId
        });
    }));

    // EDITAR (formulario) -------------------------------------------------
    router.get('/player/:playerId/reviews/:reviewId/edit', handle(async (req, res) => {
        const { playerId, reviewId: id } = req.params;
        const player = await store.getPlayer(playerId);
        if (!player) return notFound(res, playerId, 'El jugador');
        const review = await store.getReview(playerId, id);
        if (!review) return notFound(res, playerId, 'La reseña');

        return res.render('secondaryForm', {
            player: { ...player, id: String(player.id ?? player._id ?? playerId) },
            action: `${PLAYER_URL(playerId)}/reviews/${encodeURIComponent(id)}/edit`,
            cancelUrl: PLAYER_URL(playerId),
            heading: 'Editar reseña',
            values: formatReview(review),
            ratings: ratingOptions(review.rating),
            today: new Date().toISOString().slice(0, 10)
        });
    }));

    // EDITAR (guardar) ----------------------------------------------------
    router.post('/player/:playerId/reviews/:reviewId/edit', handle(async (req, res) => {
        const { playerId, reviewId: id } = req.params;
        const review = await store.getReview(playerId, id);
        if (!review) return notFound(res, playerId, 'La reseña');

        const existing = await store.getReviews(playerId);
        const result = validateReview(req.body, { existingReviews: existing, excludeId: id });

        if (!result.valid) {
            return renderResult(res, {
                status: 400,
                ok: false,
                title: 'No se pudo editar la reseña',
                message: 'Revisa los siguientes errores:',
                errors: result.errors,
                playerId,
                retryUrl: `${PLAYER_URL(playerId)}/reviews/${encodeURIComponent(id)}/edit`
            });
        }

        await store.updateReview(playerId, id, result.values);
        return renderResult(res, {
            ok: true,
            title: 'Reseña editada',
            message: `La reseña de "${result.values.nickname}" se ha actualizado correctamente.`,
            playerId
        });
    }));

    // BORRAR --------------------------------------------------------------
    router.post('/player/:playerId/reviews/:reviewId/delete', handle(async (req, res) => {
        const { playerId, reviewId: id } = req.params;
        const deleted = await store.deleteReview(playerId, id);
        if (!deleted) return notFound(res, playerId, 'La reseña');

        return renderResult(res, {
            ok: true,
            title: 'Reseña borrada',
            message: 'La reseña se ha borrado correctamente.',
            playerId
        });
    }));

    return router;
};

module.exports.formatReview = formatReview;
module.exports.ratingOptions = ratingOptions;
