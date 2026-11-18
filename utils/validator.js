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

// ---------------------------------------------------------------------------
// Validación de la entidad principal (LaLiga Player).
// ---------------------------------------------------------------------------

const PLAYER_LIMITS = Object.freeze({
    NAME_MIN: 2,
    NAME_MAX: 80,
    TEAM_MIN: 2,
    TEAM_MAX: 60,
    LEAGUE_MIN: 2,
    LEAGUE_MAX: 60,
    PHOTOGRAPHER_MIN: 2,
    PHOTOGRAPHER_MAX: 80,
    DESCRIPTION_MIN: 20,
    DESCRIPTION_MAX: 2000,
    PRICE_MIN: 0,
    PRICE_MAX: 999_999_999,
    /** Edad mínima razonable (años) */
    AGE_MIN: 15,
    /** Edad máxima razonable (años) */
    AGE_MAX: 55,
    IMAGE_MAX_BYTES: 5 * 1024 * 1024
});

/** Posiciones válidas para un jugador. */
const VALID_POSITIONS = Object.freeze([
    'portero', 'defensa', 'centrocampista', 'delantero'
]);

/** Comprueba que la primera letra es mayúscula (soporta acentos y Unicode). */
function startsWithUppercase(value) {
    return /^\p{Lu}/u.test(value);
}

/**
 * Edad cumplida en años. Compara día, mes y año en el calendario, que es más
 * exacto que dividir milisegundos entre 365,25 (un jugador que hoy cumple
 * 15 años debe considerarse de 15, no de 14).
 *
 * @param {string} isoDate  Fecha "YYYY-MM-DD" ya validada con isValidISODate.
 * @param {Date} now        Fecha actual.
 * @returns {number}
 */
function ageInYears(isoDate, now) {
    const [year, month, day] = isoDate.split('-').map(Number);
    let age = now.getFullYear() - year;
    const monthDiff = now.getMonth() + 1 - month;
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < day)) {
        age -= 1;
    }
    return age;
}

/**
 * Valida la longitud y primera mayúscula de un campo de texto genérico.
 *
 * @param {string} value  Valor ya recortado con trim().
 * @param {string} label  Nombre legible del campo (para mensajes).
 * @param {number} min    Longitud mínima.
 * @param {number} max    Longitud máxima.
 * @returns {string|null} Mensaje de error o null si es válido.
 */
function validateTextField(value, label, min, max) {
    if (!value) {
        return `${label} es obligatorio.`;
    }
    if (value.length < min || value.length > max) {
        return `${label} debe tener entre ${min} y ${max} caracteres.`;
    }
    if (!startsWithUppercase(value)) {
        return `${label} debe empezar por mayúscula.`;
    }
    return null;
}

/**
 * Valida y normaliza los datos de un jugador.
 *
 * Es una función pura (sin acceso a base de datos ni a Express) para que se
 * pueda reutilizar tanto al crear como al editar un jugador.
 *
 * @param {object} input  Cuerpo del formulario (req.body).
 * @param {object} [options]
 * @param {Array<{id?: string, _id?: *, player_name: string}>} [options.existingPlayers]
 *        Jugadores existentes (para comprobar el nombre repetido).
 * @param {string} [options.excludeId]  Id del jugador que se está editando,
 *        para que no choque consigo mismo.
 * @param {Date} [options.now]  Fecha actual (inyectable para tests).
 * @returns {{valid: boolean, errors: string[], fieldErrors: object, values: object}}
 */
function validatePlayer(input, options = {}) {
    const { existingPlayers = [], excludeId = null, now = new Date() } = options;
    const body = input || {};

    const values = {
        player_name: asTrimmedString(body.player_name),
        team: asTrimmedString(body.team),
        league: asTrimmedString(body.league),
        photographer: asTrimmedString(body.photographer),
        position: asTrimmedString(body.position).toLowerCase(),
        date_of_birth: asTrimmedString(body.date_of_birth),
        price: asTrimmedString(body.price),
        description: asTrimmedString(body.description)
    };

    const fieldErrors = {};

    // player_name: obligatorio, longitud acotada, primera mayúscula y único
    const nameErr = validateTextField(
        values.player_name, 'El nombre del jugador',
        PLAYER_LIMITS.NAME_MIN, PLAYER_LIMITS.NAME_MAX
    );
    if (nameErr) {
        fieldErrors.player_name = nameErr;
    } else {
        const wanted = values.player_name.toLowerCase();
        const repeated = existingPlayers.some((p) => {
            const id = String(p.id ?? p._id ?? '');
            if (excludeId !== null && id === String(excludeId)) return false;
            return asTrimmedString(p.player_name).toLowerCase() === wanted;
        });
        if (repeated) {
            fieldErrors.player_name = 'Ya existe un jugador con ese nombre.';
        }
    }

    // team
    const teamErr = validateTextField(
        values.team, 'El equipo',
        PLAYER_LIMITS.TEAM_MIN, PLAYER_LIMITS.TEAM_MAX
    );
    if (teamErr) fieldErrors.team = teamErr;

    // league
    const leagueErr = validateTextField(
        values.league, 'El nombre de la liga',
        PLAYER_LIMITS.LEAGUE_MIN, PLAYER_LIMITS.LEAGUE_MAX
    );
    if (leagueErr) fieldErrors.league = leagueErr;

    // photographer
    const photoErr = validateTextField(
        values.photographer, 'El fotógrafo',
        PLAYER_LIMITS.PHOTOGRAPHER_MIN, PLAYER_LIMITS.PHOTOGRAPHER_MAX
    );
    if (photoErr) fieldErrors.photographer = photoErr;

    // position
    if (!values.position) {
        fieldErrors.position = 'La posición es obligatoria.';
    } else if (!VALID_POSITIONS.includes(values.position)) {
        fieldErrors.position =
            `La posición debe ser una de: ${VALID_POSITIONS.join(', ')}.`;
    }

    // date_of_birth: fecha real, no futura y rango de edad razonable
    if (!values.date_of_birth) {
        fieldErrors.date_of_birth = 'La fecha de nacimiento es obligatoria.';
    } else if (!isValidISODate(values.date_of_birth)) {
        fieldErrors.date_of_birth = 'La fecha de nacimiento no es válida.';
    } else {
        const today = todayISO(now);
        if (values.date_of_birth > today) {
            fieldErrors.date_of_birth = 'La fecha de nacimiento no puede ser futura.';
        } else {
            // Comprobar rango de edad razonable
            const age = ageInYears(values.date_of_birth, now);
            if (age < PLAYER_LIMITS.AGE_MIN) {
                fieldErrors.date_of_birth =
                    `El jugador debe tener al menos ${PLAYER_LIMITS.AGE_MIN} años.`;
            } else if (age > PLAYER_LIMITS.AGE_MAX) {
                fieldErrors.date_of_birth =
                    `El jugador no puede tener más de ${PLAYER_LIMITS.AGE_MAX} años.`;
            }
        }
    }

    // price: entero entre 0 y máximo
    if (values.price === '') {
        fieldErrors.price = 'El precio es obligatorio.';
    } else {
        const price = Number(values.price);
        if (!Number.isFinite(price) || !Number.isInteger(price)) {
            fieldErrors.price = 'El precio debe ser un número entero.';
        } else if (price < PLAYER_LIMITS.PRICE_MIN || price > PLAYER_LIMITS.PRICE_MAX) {
            fieldErrors.price =
                `El precio debe estar entre ${PLAYER_LIMITS.PRICE_MIN} y ${PLAYER_LIMITS.PRICE_MAX}.`;
        }
    }

    // description: obligatoria y de longitud acotada
    if (!values.description) {
        fieldErrors.description = 'La descripción es obligatoria.';
    } else if (
        values.description.length < PLAYER_LIMITS.DESCRIPTION_MIN ||
        values.description.length > PLAYER_LIMITS.DESCRIPTION_MAX
    ) {
        fieldErrors.description =
            `La descripción debe tener entre ${PLAYER_LIMITS.DESCRIPTION_MIN} y ${PLAYER_LIMITS.DESCRIPTION_MAX} caracteres.`;
    }

    const errors = Object.values(fieldErrors);
    const valid = errors.length === 0;

    if (valid) {
        values.price = Number(values.price);
    }

    return { valid, errors, fieldErrors, values };
}

/**
 * Valida el fichero de imagen subido por Multer.
 *
 * @param {object} file  Objeto de Multer (req.file).
 * @returns {{valid: boolean, error: string|null}}
 */
function validateImageFile(file) {
    if (!file) {
        return { valid: false, error: 'La imagen es obligatoria.' };
    }
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
        return { valid: false, error: 'El archivo debe ser una imagen.' };
    }
    if (file.size > PLAYER_LIMITS.IMAGE_MAX_BYTES) {
        const mb = (PLAYER_LIMITS.IMAGE_MAX_BYTES / (1024 * 1024)).toFixed(0);
        return { valid: false, error: `La imagen no puede superar los ${mb} MB.` };
    }
    return { valid: true, error: null };
}

module.exports = {
    validateReview,
    isValidISODate,
    LIMITS,
    validatePlayer,
    PLAYER_LIMITS,
    VALID_POSITIONS,
    validateImageFile
};
