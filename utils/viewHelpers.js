/**
 * utils/viewHelpers.js – Helpers shared by the routers to prepare data for
 * the Mustache views and to render the common confirmation and error pages.
 *
 * Mustache templates have no logic, so everything they need (readable dates,
 * formatted prices, which <option> is selected...) is computed here.
 */

const { POSITIONS, REVIEW_LIMITS } = require('./validator');

/** "2001-05-04" -> "04/05/2001". Any other value is returned unchanged. */
function formatDate(isoDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate ?? ''));
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(isoDate ?? '');
}

/** 79000000 -> "79.000.000" */
function formatPrice(price) {
    return String(price ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** URL of the detail page of a player. */
function playerUrl(playerId) {
    return `/player/${playerId}`;
}

/** Home page URL with the given query-string parameters (empty ones are skipped). */
function homeUrl(params = {}) {
    const query = new URLSearchParams(
        Object.entries(params).filter(([, value]) => value)
    ).toString();
    return query ? `/?${query}` : '/';
}

/** Player document ready for the views: string id plus readable date and price. */
function toPlayerView(player) {
    return {
        ...player,
        id: String(player._id),
        date_of_birth_label: formatDate(player.date_of_birth),
        price_label: formatPrice(player.price)
    };
}

/** Review document ready for the views: string id plus readable date and rating. */
function toReviewView(review) {
    return {
        ...review,
        id: String(review._id),
        date_label: formatDate(review.review_date),
        rating_label: `${review.rating}/${REVIEW_LIMITS.RATING_MAX}`
    };
}

/** Category buttons of the shared header, keeping the current search. */
function categoryLinks(search = '', activePosition = '') {
    return POSITIONS.map(({ value, label }) => ({
        label,
        url: homeUrl({ position: value, search }),
        active: value === activePosition
    }));
}

/** Options of the position <select> of the player form. */
function positionOptions(selected) {
    return POSITIONS.map(({ value }) => ({ value, selected: value === selected }));
}

const RATING_LABELS = ['Mala', 'Regular', 'Buena', 'Muy buena', 'Excelente'];

/** Options of the rating <select> of the review form. */
function ratingOptions(selected) {
    return RATING_LABELS.map((label, i) => ({
        value: i + 1,
        label: `${i + 1} - ${label}`,
        selected: String(selected) === String(i + 1)
    }));
}

/**
 * Renders the confirmation page shown after adding, editing or deleting an
 * element (views/confirmation.html).
 */
function renderConfirmation(res, { title, message, backUrl = '/', backLabel = 'Volver a la página principal' }) {
    return res.render('confirmation', { title, message, backUrl, backLabel });
}

/**
 * Renders the error page (views/error.html): invalid form data, elements that
 * do not exist, failed uploads and unexpected errors.
 */
function renderError(res, {
    status = 400,
    title = 'Error',
    message,
    errors = [],
    backUrl = '/',
    backLabel = 'Volver a la página principal',
    retryUrl = null
}) {
    return res.status(status).render('error', {
        title,
        message,
        errors,
        hasErrors: errors.length > 0,
        backUrl,
        backLabel,
        retryUrl
    });
}

/** Error page for a player id that does not exist (or is malformed). */
function renderPlayerNotFound(res) {
    return renderError(res, {
        status: 404,
        title: 'Jugador no encontrado',
        message: 'El jugador solicitado no existe.'
    });
}

module.exports = {
    categoryLinks,
    homeUrl,
    playerUrl,
    positionOptions,
    ratingOptions,
    renderConfirmation,
    renderError,
    renderPlayerNotFound,
    toPlayerView,
    toReviewView
};
