'use strict';

/**
 * Validación de la entidad secundaria (LaLiga Card Review).
 *
 * Es una función pura (sin acceso a base de datos ni a Express) para que se
 * pueda reutilizar tanto al crear como al editar una reseña.
 *
 * Atributos de la entidad: nickname, review_date, opinion, rating.
 * El "título" que no puede repetirse es el `nickname`: un mismo usuario no
 * puede publicar dos reseñas sobre el mismo jugador.
 */

const LIMITS = Object.freeze({
    NICKNAME_MIN: 2,
    NICKNAME_MAX: 30,
    OPINION_MIN: 10,
    OPINION_MAX: 500,
    RATING_MIN: 1,
    RATING_MAX: 5
});

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function todayISO(now = new Date()) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Devuelve true si `value` es una fecha real en formato YYYY-MM-DD. */
function isValidISODate(value) {
    const match = ISO_DATE.exec(value);
    if (!match) return false;
    const [, y, m, d] = match.map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function asTrimmedString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * Valida y normaliza los datos de una reseña.
 *
 * @param {object} input  Cuerpo del formulario (req.body).
 * @param {object} [options]
 * @param {Array<{id?: string, _id?: *, nickname: string}>} [options.existingReviews]
 *        Reseñas que ya tiene el jugador (para comprobar el nickname repetido).
 * @param {string} [options.excludeId]  Id de la reseña que se está editando,
 *        para que no choque consigo misma.
 * @param {Date} [options.now]  Fecha actual (inyectable para tests).
 * @returns {{valid: boolean, errors: string[], fieldErrors: object, values: object}}
 *          `values` son los datos ya normalizados, o lo que escribió el usuario
 *          para volver a pintarlo si hay errores.
 */
function validateReview(input, options = {}) {
    const { existingReviews = [], excludeId = null, now = new Date() } = options;
    const body = input || {};

    const values = {
        nickname: asTrimmedString(body.nickname),
        review_date: asTrimmedString(body.review_date),
        opinion: asTrimmedString(body.opinion),
        rating: asTrimmedString(body.rating)
    };

    const fieldErrors = {};

    // nickname: obligatorio, longitud acotada y no repetido en el mismo jugador
    if (!values.nickname) {
        fieldErrors.nickname = 'El nombre de usuario es obligatorio.';
    } else if (values.nickname.length < LIMITS.NICKNAME_MIN || values.nickname.length > LIMITS.NICKNAME_MAX) {
        fieldErrors.nickname =
            `El nombre de usuario debe tener entre ${LIMITS.NICKNAME_MIN} y ${LIMITS.NICKNAME_MAX} caracteres.`;
    } else {
        const wanted = values.nickname.toLowerCase();
        const repeated = existingReviews.some((review) => {
            const id = String(review.id ?? review._id ?? '');
            if (excludeId !== null && id === String(excludeId)) return false;
            return asTrimmedString(review.nickname).toLowerCase() === wanted;
        });
        if (repeated) {
            fieldErrors.nickname = 'Ya existe una reseña con ese nombre de usuario para este jugador.';
        }
    }

    // review_date: obligatoria, fecha real y no futura
    if (!values.review_date) {
        fieldErrors.review_date = 'La fecha de la reseña es obligatoria.';
    } else if (!isValidISODate(values.review_date)) {
        fieldErrors.review_date = 'La fecha de la reseña no es válida.';
    } else if (values.review_date > todayISO(now)) {
        fieldErrors.review_date = 'La fecha de la reseña no puede ser futura.';
    }

    // opinion: obligatoria y de longitud acotada
    if (!values.opinion) {
        fieldErrors.opinion = 'La reseña es obligatoria.';
    } else if (values.opinion.length < LIMITS.OPINION_MIN || values.opinion.length > LIMITS.OPINION_MAX) {
        fieldErrors.opinion =
            `La reseña debe tener entre ${LIMITS.OPINION_MIN} y ${LIMITS.OPINION_MAX} caracteres.`;
    }

    // rating: obligatorio y entero entre 1 y 5
    if (!values.rating) {
        fieldErrors.rating = 'La puntuación es obligatoria.';
    } else {
        const rating = Number(values.rating);
        if (!Number.isInteger(rating) || rating < LIMITS.RATING_MIN || rating > LIMITS.RATING_MAX) {
            fieldErrors.rating =
                `La puntuación debe ser un número entero entre ${LIMITS.RATING_MIN} y ${LIMITS.RATING_MAX}.`;
        }
    }

    const errors = Object.values(fieldErrors);
    const valid = errors.length === 0;

    if (valid) {
        values.rating = Number(values.rating);
    }

    return { valid, errors, fieldErrors, values };
}

module.exports = { validateReview, isValidISODate, LIMITS };
