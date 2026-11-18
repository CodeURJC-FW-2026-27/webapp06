'use strict';

/**
 * routes/homeRouter.js – Home page: the list of players (main entity).
 *
 * GET / supports:
 *   - pagination, 6 players per page (?page=N),
 *   - search by player name, ignoring case and accents (?search=...),
 *   - filtering by position, the category of a player (?position=...).
 * Active filters are kept in the pagination and category links.
 */

const express = require('express');
const { POSITIONS } = require('../utils/validator');
const { categoryLinks, homeUrl, toPlayerView } = require('../utils/viewHelpers');

const PLAYERS_PER_PAGE = 6;

/** Query-string parameter as a trimmed string ('' if missing or repeated). */
function queryText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param {ReturnType<import('../store').createStore>} store
 * @returns {import('express').Router}
 */
module.exports = function createHomeRouter(store) {
    const router = express.Router();

    router.get('/', async (req, res) => {
        const search = queryText(req.query.search);
        const requestedPosition = queryText(req.query.position);
        const position = POSITIONS.some((p) => p.value === requestedPosition) ? requestedPosition : '';
        const requestedPage = Number.parseInt(queryText(req.query.page), 10) || 1;

        const { players, currentPage, totalPages } = await store.getPlayersPage({
            search,
            position,
            page: requestedPage,
            pageSize: PLAYERS_PER_PAGE
        });

        const pageUrl = (page) => homeUrl({ search, position, page });
        const pages = Array.from({ length: totalPages }, (_, i) => ({
            number: i + 1,
            url: pageUrl(i + 1),
            active: i + 1 === currentPage
        }));

        res.render('index', {
            players: players.map(toPlayerView),
            hasPlayers: players.length > 0,
            showPagination: totalPages > 1,
            pages,
            hasPrev: currentPage > 1,
            hasNext: currentPage < totalPages,
            prevUrl: pageUrl(currentPage - 1),
            nextUrl: pageUrl(currentPage + 1),
            // Shared header: current filters and category buttons.
            search,
            position,
            categories: categoryLinks(search, position),
            allActive: !position,
            allUrl: homeUrl({ search })
        });
    });

    return router;
};
