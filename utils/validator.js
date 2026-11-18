/**
 * utils/validator.js – Server-side validation of the forms.
 *
 * Both validators are pure functions (no database and no Express access), so
 * the same rules are reused when an element is created and when it is edited.
 * They are built from small field checks shared by both entities. Error
 * messages are shown to the user, so they are written in Spanish.
 */

// ---------------------------------------------------------------------------
// Limits and categories
// ---------------------------------------------------------------------------

const REVIEW_LIMITS = Object.freeze({
    NICKNAME_MIN: 2,
    NICKNAME_MAX: 30,
    OPINION_MIN: 10,
    OPINION_MAX: 500,
    RATING_MIN: 1,
    RATING_MAX: 5
});

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
    /** Minimum reasonable age (years). */
    AGE_MIN: 15,
    /** Maximum reasonable age (years). */
    AGE_MAX: 55,
    IMAGE_MAX_BYTES: 5 * 1024 * 1024
});

/**
 * Positions of a player: the categories of the main entity. `value` is what
 * is stored in the database and `label` the name of the category button.
 */
const POSITIONS = Object.freeze([
    { value: 'Portero', label: 'Porteros' },
    { value: 'Defensa', label: 'Defensas' },
    { value: 'Centrocampista', label: 'Centrocampistas' },
    { value: 'Delantero', label: 'Delanteros' }
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INTEGER = /^-?\d+$/;

/** Today's local date as YYYY-MM-DD (the format used by <input type="date">). */
function todayISO(now = new Date()) {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Returns true if `value` is a real calendar date written as YYYY-MM-DD. */
function isValidISODate(value) {
    const match = ISO_DATE.exec(value);
    if (!match) return false;
    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function asTrimmedString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

/** Returns true if the first character is an uppercase letter (accents included). */
function startsWithUppercase(value) {
    return /^\p{Lu}/u.test(value);
}

/**
 * Age in completed years. Compares day, month and year in the calendar, which
 * is more accurate than dividing milliseconds by 365.25 (a player who turns 15
 * today must be considered 15 years old, not 14).
 *
 * @param {string} isoDate  YYYY-MM-DD date already checked with isValidISODate.
 * @param {Date} now        Current date.
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
 * Returns true if another element of `elements` (ignoring the one whose id is
 * `excludeId`) already has `value` in `field`, ignoring case.
 */
function isRepeated(elements, field, value, excludeId) {
    const wanted = value.toLowerCase();
    return elements.some((element) => {
        const id = String(element.id ?? element._id ?? '');
        if (excludeId != null && id === String(excludeId)) return false;
        return asTrimmedString(element[field]).toLowerCase() === wanted;
    });
}

/** Position whose value matches `value` ignoring case, or undefined. */
function findPosition(value) {
    return POSITIONS.find((position) => position.value.toLowerCase() === value.toLowerCase());
}

// ---------------------------------------------------------------------------
// Field checks. Each one returns an error message, or null if the value is
// valid. Labels include their article ("La reseña", "El equipo"), which also
// tells the gender of "obligatorio/obligatoria".
// ---------------------------------------------------------------------------

function requiredMessage(label) {
    return `${label} es ${label.startsWith('La ') ? 'obligatoria' : 'obligatorio'}.`;
}

/** Required text whose length is between `min` and `max`. */
function checkText(value, label, min, max) {
    if (!value) return requiredMessage(label);
    if (value.length < min || value.length > max) {
        return `${label} debe tener entre ${min} y ${max} caracteres.`;
    }
    return null;
}

/** Like checkText, and the text must also start with an uppercase letter. */
function checkCapitalizedText(value, label, min, max) {
    return checkText(value, label, min, max)
        ?? (startsWithUppercase(value) ? null : `${label} debe empezar por mayúscula.`);
}

/** Required integer (digits only) between `min` and `max`. */
function checkInteger(value, label, min, max) {
    if (!value) return requiredMessage(label);
    const number = Number(value);
    if (!INTEGER.test(value) || number < min || number > max) {
        return `${label} debe ser un número entero entre ${min} y ${max}.`;
    }
    return null;
}

/** Required YYYY-MM-DD date that is not in the future (labels are "La fecha..."). */
function checkPastDate(value, label, now) {
    if (!value) return requiredMessage(label);
    if (!isValidISODate(value)) return `${label} no es válida.`;
    if (value > todayISO(now)) return `${label} no puede ser futura.`;
    return null;
}

/** The player must be between AGE_MIN and AGE_MAX years old. */
function checkAge(isoDate, now) {
    const age = ageInYears(isoDate, now);
    if (age < PLAYER_LIMITS.AGE_MIN) return `El jugador debe tener al menos ${PLAYER_LIMITS.AGE_MIN} años.`;
    if (age > PLAYER_LIMITS.AGE_MAX) return `El jugador no puede tener más de ${PLAYER_LIMITS.AGE_MAX} años.`;
    return null;
}

/** Required position, one of POSITIONS. */
function checkPosition(value) {
    if (!value) return requiredMessage('La posición');
    return findPosition(value)
        ? null
        : `La posición debe ser una de: ${POSITIONS.map((position) => position.value).join(', ')}.`;
}

/**
 * Common result of both validators.
 *
 * @param {object} checks  Error message (or null) of every field.
 * @param {object} values  Values read from the form.
 * @returns {{valid: boolean, errors: string[], fieldErrors: object, values: object}}
 *          `fieldErrors` only keeps the fields that failed.
 */
function buildResult(checks, values) {
    const fieldErrors = Object.fromEntries(Object.entries(checks).filter(([, message]) => message));
    const errors = Object.values(fieldErrors);
    return { valid: errors.length === 0, errors, fieldErrors, values };
}

// ---------------------------------------------------------------------------
// Secondary entity: LaLiga Card Review
// ---------------------------------------------------------------------------

/**
 * Validates and normalises the data of a review.
 *
 * The nickname works as the review "title": the same user cannot publish two
 * reviews about the same player.
 *
 * @param {object} input  Form body (req.body).
 * @param {object} [options]
 * @param {Array<{_id?: *, nickname: string}>} [options.existingReviews]
 *        Reviews the player already has (to detect a repeated nickname).
 * @param {string} [options.excludeId]  Id of the review being edited, so it
 *        does not clash with itself.
 * @param {Date} [options.now]  Current date (injectable for tests).
 * @returns {{valid: boolean, errors: string[], fieldErrors: object, values: object}}
 *          When valid, `values` holds the normalised data (rating as a number).
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

    const result = buildResult({
        nickname: checkText(values.nickname, 'El nombre de usuario', REVIEW_LIMITS.NICKNAME_MIN, REVIEW_LIMITS.NICKNAME_MAX)
            ?? (isRepeated(existingReviews, 'nickname', values.nickname, excludeId)
                ? 'Ya existe una reseña con ese nombre de usuario para este jugador.'
                : null),
        review_date: checkPastDate(values.review_date, 'La fecha de la reseña', now),
        opinion: checkText(values.opinion, 'La opinión', REVIEW_LIMITS.OPINION_MIN, REVIEW_LIMITS.OPINION_MAX),
        rating: checkInteger(values.rating, 'La puntuación', REVIEW_LIMITS.RATING_MIN, REVIEW_LIMITS.RATING_MAX)
    }, values);

    if (result.valid) {
        values.rating = Number(values.rating);
    }
    return result;
}

// ---------------------------------------------------------------------------
// Main entity: LaLiga Player
// ---------------------------------------------------------------------------

/**
 * Validates and normalises the data of a player.
 *
 * @param {object} input  Form body (req.body).
 * @param {object} [options]
 * @param {Array<{_id?: *, player_name: string}>} [options.existingPlayers]
 *        Existing players (to detect a repeated name).
 * @param {string} [options.excludeId]  Id of the player being edited, so it
 *        does not clash with itself.
 * @param {boolean} [options.hasImage=true]  Whether the player has an image
 *        (a new upload or the one it already had). The image is mandatory.
 * @param {Date} [options.now]  Current date (injectable for tests).
 * @returns {{valid: boolean, errors: string[], fieldErrors: object, values: object}}
 *          When valid, `values` holds the normalised data (price as a number
 *          and position with its canonical spelling).
 */
function validatePlayer(input, options = {}) {
    const { existingPlayers = [], excludeId = null, hasImage = true, now = new Date() } = options;
    const body = input || {};

    const values = {
        player_name: asTrimmedString(body.player_name),
        team: asTrimmedString(body.team),
        league: asTrimmedString(body.league),
        photographer: asTrimmedString(body.photographer),
        position: asTrimmedString(body.position),
        date_of_birth: asTrimmedString(body.date_of_birth),
        price: asTrimmedString(body.price),
        description: asTrimmedString(body.description)
    };

    const result = buildResult({
        player_name: checkCapitalizedText(values.player_name, 'El nombre del jugador', PLAYER_LIMITS.NAME_MIN, PLAYER_LIMITS.NAME_MAX)
            ?? (isRepeated(existingPlayers, 'player_name', values.player_name, excludeId)
                ? 'Ya existe un jugador con ese nombre.'
                : null),
        team: checkCapitalizedText(values.team, 'El equipo', PLAYER_LIMITS.TEAM_MIN, PLAYER_LIMITS.TEAM_MAX),
        league: checkCapitalizedText(values.league, 'El nombre de la liga', PLAYER_LIMITS.LEAGUE_MIN, PLAYER_LIMITS.LEAGUE_MAX),
        photographer: checkCapitalizedText(values.photographer, 'El fotógrafo', PLAYER_LIMITS.PHOTOGRAPHER_MIN, PLAYER_LIMITS.PHOTOGRAPHER_MAX),
        position: checkPosition(values.position),
        date_of_birth: checkPastDate(values.date_of_birth, 'La fecha de nacimiento', now)
            ?? checkAge(values.date_of_birth, now),
        price: checkInteger(values.price, 'El precio', PLAYER_LIMITS.PRICE_MIN, PLAYER_LIMITS.PRICE_MAX),
        description: checkText(values.description, 'La descripción', PLAYER_LIMITS.DESCRIPTION_MIN, PLAYER_LIMITS.DESCRIPTION_MAX),
        image: hasImage ? null : 'La imagen es obligatoria.'
    }, values);

    if (result.valid) {
        values.position = findPosition(values.position).value;
        values.price = Number(values.price);
    }
    return result;
}

module.exports = {
    PLAYER_LIMITS,
    POSITIONS,
    REVIEW_LIMITS,
    todayISO,
    validatePlayer,
    validateReview
};
