'use strict';

const express = require('express');
const { ObjectId } = require('mongodb');
const fs = require('node:fs/promises');
const path = require('node:path');
const { formatReview, ratingOptions } = require('./secondaryRouter');

/**
 * Rutas de la entidad principal (LaLiga Player): detalle y borrado.
 *
 * Se exporta una fábrica para no depender de cómo se implemente la base de
 * datos: quien monte la app le pasa un `store` con esta interfaz (todo async):
 *
 *   getPlayer(playerId)                    -> jugador | null
 *   getReviews(playerId)                   -> reseñas del jugador
 *   deletePlayer(playerId)                 -> true si existía y se borró
 *   deleteReviewsByPlayer(playerId)        -> número de reseñas borradas
 *                                             (se admite el alias deleteReviews)
 *   getPlayerByImage(imagePath, excludeId) -> jugador | null  (para saber si
 *                                             otro jugador usa la misma imagen)
 *
 * Uso en app.js:
 *   app.use(require('./routes/playerDetailRouter')(store));
 *
 * Rutas:
 *   GET    /player/:id          detalle del jugador (también /item/:id)
 *   POST   /player/:id/delete   borrar jugador + reseñas + imagen
 */

/** Carpeta donde se almacenan las imágenes subidas. */
const IMAGES_DIR = path.resolve(__dirname, '..', 'images');

/**
 * Convierte una fecha a "15/01/2000". Acepta "YYYY-MM-DD", fechas ISO
 * completas y objetos Date (por si la capa de datos guarda Date en Mongo).
 */
function formatDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return formatDate(value.toISOString().slice(0, 10));
    }
    const iso = String(value ?? '').slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value ?? '');
}

/**
 * Comprueba que un string es un ObjectId válido de MongoDB.
 * @param {string} id
 * @returns {boolean}
 */
function isValidObjectId(id) {
    return ObjectId.isValid(id) && String(new ObjectId(id)) === String(id);
}

/**
 * Renderiza la vista de confirmación genérica.
 */
function renderConfirmation(res, { status = 200, ok, title, message, errors = [], backUrl, backLabel, retryUrl }) {
    return res.status(status).render('confirmation', {
        ok,
        title,
        message,
        errors,
        hasErrors: errors.length > 0,
        backUrl: backUrl || '/',
        backLabel: backLabel || 'Volver a la página principal',
        retryUrl
    });
}

/**
 * Renderiza la vista de error genérica.
 */
function renderError(res, { status = 500, title, message, errors = [], backUrl, backLabel, retryUrl }) {
    return res.status(status).render('error', {
        ok: false,
        title: title || 'Error',
        message,
        errors,
        hasErrors: errors.length > 0,
        backUrl: backUrl || '/',
        backLabel: backLabel || 'Volver a la página principal',
        retryUrl
    });
}

/**
 * Elimina de forma segura el fichero de imagen de un jugador.
 *
 * - Comprueba que la ruta resuelta queda dentro de IMAGES_DIR (evita path traversal).
 * - Ignora ENOENT (el fichero ya no existe).
 * - Si otro jugador usa la misma imagen, no la borra.
 * - Si falla el borrado, lo registra con console.error sin romper la operación.
 *
 * @param {string} imagePath  Ruta relativa o URL de la imagen (p. ej. "/images/foto.webp").
 * @param {string} playerId   Id del jugador que se está borrando.
 * @param {object} store      Capa de acceso a datos.
 */
async function safeDeleteImage(imagePath, playerId, store) {
    if (!imagePath) return;

    // Extraer solo el nombre del fichero (puede venir como "/images/foto.webp")
    const basename = path.basename(String(imagePath));
    const resolved = path.resolve(IMAGES_DIR, basename);

    // Comprobar que la ruta queda dentro de IMAGES_DIR (path traversal)
    if (!resolved.startsWith(IMAGES_DIR + path.sep) && resolved !== IMAGES_DIR) {
        console.error(`Ruta de imagen fuera del directorio permitido: ${resolved}`);
        return;
    }

    // Comprobar si otro jugador usa la misma imagen
    if (store.getPlayerByImage) {
        try {
            const otherPlayer = await store.getPlayerByImage(imagePath, playerId);
            if (otherPlayer) {
                return; // otro jugador la sigue usando
            }
        } catch (err) {
            console.error('Error al comprobar imagen compartida:', err);
        }
    }

    try {
        await fs.unlink(resolved);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error(`No se pudo borrar la imagen ${resolved}:`, err);
        }
    }
}

module.exports = function createPlayerDetailRouter(store) {
    const router = express.Router();

    // Envuelve los handlers async para capturar cualquier excepción.
    const handle = (fn) => async (req, res) => {
        try {
            await fn(req, res);
        } catch (err) {
            console.error(err);
            renderError(res, {
                status: 500,
                title: 'Error del servidor',
                message: 'Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.'
            });
        }
    };

    // DETALLE --------------------------------------------------------------
    const detailHandler = handle(async (req, res) => {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return renderError(res, {
                status: 404,
                title: 'No encontrado',
                message: 'El identificador del jugador no es válido.'
            });
        }

        const player = await store.getPlayer(id);
        if (!player) {
            return renderError(res, {
                status: 404,
                title: 'No encontrado',
                message: 'El jugador solicitado no existe.'
            });
        }

        const reviews = (await store.getReviews(id)).map(formatReview);

        return res.render('detail', {
            player: {
                ...player,
                id: String(player.id ?? player._id ?? id),
                date_of_birth_label: formatDate(player.date_of_birth)
            },
            reviews,
            ratings: ratingOptions(),
            values: {},
            today: new Date().toISOString().slice(0, 10)
        });
    });

    router.get('/player/:id', detailHandler);
    router.get('/item/:id', detailHandler);

    // BORRAR ---------------------------------------------------------------
    router.post('/player/:id/delete', handle(async (req, res) => {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return renderError(res, {
                status: 404,
                title: 'No encontrado',
                message: 'El identificador del jugador no es válido.'
            });
        }

        const player = await store.getPlayer(id);
        if (!player) {
            return renderError(res, {
                status: 404,
                title: 'No encontrado',
                message: 'El jugador que intentas borrar no existe.'
            });
        }

        // 1) Borrar reseñas del jugador (alias admitido: deleteReviews)
        const removeReviews = store.deleteReviewsByPlayer ?? store.deleteReviews;
        await removeReviews.call(store, id);

        // 2) Borrar el documento del jugador
        await store.deletePlayer(id);

        // 3) Borrar la imagen de disco (best-effort)
        await safeDeleteImage(player.image, id, store);

        return renderConfirmation(res, {
            ok: true,
            title: 'Jugador borrado',
            message: `El jugador "${player.player_name}" y sus reseñas se han borrado correctamente.`,
            backUrl: '/',
            backLabel: 'Volver a la página principal'
        });
    }));

    return router;
};
