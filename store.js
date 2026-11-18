/**
 * store.js – Data access layer of LEAGUES MARKET.
 *
 * Wraps the two MongoDB collections of the application:
 *   - players: main entity (LaLiga Player).
 *   - reviews: secondary entity (LaLiga Card Review). Each review is linked to
 *              its player through the `playerId` field.
 *
 * The routers only reach MongoDB through the object returned by createStore().
 * Ids come from URLs, so a malformed id behaves like the id of an element that
 * does not exist: lookups return null and updates/deletions return false.
 */

const { ObjectId } = require('mongodb');

/** Converts an id taken from a URL into an ObjectId, or null if it is malformed. */
function toObjectId(id) {
    return typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null;
}

/** Filter that selects one review of one player, or null if an id is malformed. */
function reviewFilter(playerId, reviewId) {
    const playerObjectId = toObjectId(playerId);
    const _id = toObjectId(reviewId);
    return playerObjectId && _id ? { _id, playerId: playerObjectId } : null;
}

/**
 * Builds a regex pattern that matches regardless of accents/diacritics and
 * escapes special regex characters ("garcia" finds "García").
 *
 * @param {string} text
 * @returns {string}
 */
function toDiacriticRegex(text) {
    return text
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/[aáàäâ]/gi, '[aáàäâ]')
        .replace(/[eéèëê]/gi, '[eéèëê]')
        .replace(/[iíìïî]/gi, '[iíìïî]')
        .replace(/[oóòöô]/gi, '[oóòöô]')
        .replace(/[uúùüû]/gi, '[uúùüû]')
        .replace(/[nñ]/gi, '[nñ]');
}

/**
 * @param {import('mongodb').Db} db
 */
function createStore(db) {
    const players = db.collection('players');
    const reviews = db.collection('reviews');

    return {
        // --- Players ---------------------------------------------------------

        /**
         * One page of players, optionally filtered by name (case and accent
         * insensitive) and by position. Players keep their creation order.
         *
         * @returns {Promise<{players: object[], currentPage: number, totalPages: number}>}
         *          `currentPage` is `page` moved into the valid range.
         */
        async getPlayersPage({ search = '', position = '', page = 1, pageSize }) {
            const filter = {};
            if (search) {
                filter.player_name = { $regex: toDiacriticRegex(search), $options: 'i' };
            }
            if (position) {
                filter.position = position;
            }

            const totalItems = await players.countDocuments(filter);
            const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
            const currentPage = Math.min(Math.max(1, page), totalPages);

            const pagePlayers = await players
                .find(filter)
                .sort({ _id: 1 })
                .skip((currentPage - 1) * pageSize)
                .limit(pageSize)
                .toArray();

            return { players: pagePlayers, currentPage, totalPages };
        },

        async getPlayer(id) {
            const _id = toObjectId(id);
            return _id ? players.findOne({ _id }) : null;
        },

        /** Id and name of every player (to check that names are unique). */
        async getPlayerNames() {
            return players.find({}, { projection: { player_name: 1 } }).toArray();
        },

        /** Inserts a player and returns its id as a string. */
        async addPlayer(player) {
            const { insertedId } = await players.insertOne({ ...player });
            return String(insertedId);
        },

        /** Overwrites the data of a player. Returns false if it does not exist. */
        async updatePlayer(id, player) {
            const _id = toObjectId(id);
            if (!_id) return false;
            const { matchedCount } = await players.updateOne({ _id }, { $set: player });
            return matchedCount > 0;
        },

        /** Deletes a player and all its reviews. Returns the deleted player, or null. */
        async deletePlayer(id) {
            const _id = toObjectId(id);
            if (!_id) return null;
            const player = await players.findOneAndDelete({ _id });
            if (player) {
                await reviews.deleteMany({ playerId: _id });
            }
            return player;
        },

        // --- Reviews ---------------------------------------------------------

        /** Reviews of a player, newest first. */
        async getReviews(playerId) {
            const _id = toObjectId(playerId);
            return _id
                ? reviews.find({ playerId: _id }).sort({ review_date: -1, _id: -1 }).toArray()
                : [];
        },

        async getReview(playerId, reviewId) {
            const filter = reviewFilter(playerId, reviewId);
            return filter ? reviews.findOne(filter) : null;
        },

        /** Inserts a review of an existing player and returns its id as a string. */
        async addReview(playerId, review) {
            const { insertedId } = await reviews.insertOne({ ...review, playerId: toObjectId(playerId) });
            return String(insertedId);
        },

        /** Overwrites the data of a review. Returns false if it does not exist. */
        async updateReview(playerId, reviewId, review) {
            const filter = reviewFilter(playerId, reviewId);
            if (!filter) return false;
            const { matchedCount } = await reviews.updateOne(filter, { $set: review });
            return matchedCount > 0;
        },

        /** Deletes a review. Returns false if it does not exist. */
        async deleteReview(playerId, reviewId) {
            const filter = reviewFilter(playerId, reviewId);
            if (!filter) return false;
            const { deletedCount } = await reviews.deleteOne(filter);
            return deletedCount > 0;
        },

        // --- Demo data -------------------------------------------------------

        /** Removes every player and review (used before loading the demo data). */
        async deleteAll() {
            await reviews.deleteMany({});
            await players.deleteMany({});
        }
    };
}

module.exports = { createStore };
