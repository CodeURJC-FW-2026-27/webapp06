'use strict';

const crypto = require('node:crypto');
const express = require('express');
const fs = require('node:fs');
const multer = require('multer');
const path = require('node:path');
const {
    PLAYER_LIMITS,
    VALID_POSITIONS,
    validateImageFile,
    validatePlayer
} = require('../utils/validator');

const uploadsDirectory = path.resolve(__dirname, '..', 'uploads');

fs.mkdirSync(uploadsDirectory, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: uploadsDirectory,
        filename: (req, file, callback) => {
            const extension = path.extname(file.originalname);
            callback(null, `${crypto.randomBytes(16).toString('hex')}${extension}`);
        }
    }),
    limits: {
        files: 1,
        fileSize: PLAYER_LIMITS.IMAGE_MAX_BYTES
    },
    fileFilter: (req, file, callback) => {
        if (!file.mimetype || !file.mimetype.startsWith('image/')) {
            const error = new Error('Only image files are allowed.');
            error.code = 'INVALID_IMAGE_TYPE';
            return callback(error);
        }
        callback(null, true);
    }
});

const PLAYER_FIELD_ERRORS = Object.freeze({
    player_name: `Player name is required, must start with an uppercase letter, be between ${PLAYER_LIMITS.NAME_MIN} and ${PLAYER_LIMITS.NAME_MAX} characters, and be unique.`,
    team: `Team is required, must start with an uppercase letter, and be between ${PLAYER_LIMITS.TEAM_MIN} and ${PLAYER_LIMITS.TEAM_MAX} characters.`,
    league: `League is required, must start with an uppercase letter, and be between ${PLAYER_LIMITS.LEAGUE_MIN} and ${PLAYER_LIMITS.LEAGUE_MAX} characters.`,
    photographer: `Photographer is required, must start with an uppercase letter, and be between ${PLAYER_LIMITS.PHOTOGRAPHER_MIN} and ${PLAYER_LIMITS.PHOTOGRAPHER_MAX} characters.`,
    position: `Position is required and must be one of: ${VALID_POSITIONS.join(', ')}.`,
    date_of_birth: `Date of birth must be valid, and the player must be between ${PLAYER_LIMITS.AGE_MIN} and ${PLAYER_LIMITS.AGE_MAX} years old.`,
    price: `Price is required and must be an integer between ${PLAYER_LIMITS.PRICE_MIN} and ${PLAYER_LIMITS.PRICE_MAX}.`,
    description: `Description is required and must be between ${PLAYER_LIMITS.DESCRIPTION_MIN} and ${PLAYER_LIMITS.DESCRIPTION_MAX} characters.`
});

function renderError(res, {
    status = 400,
    title = 'Player information error',
    message,
    errors = [],
    backUrl = '/',
    backLabel = 'Back to the home page',
    retryUrl = '/player/new'
}) {
    return res.status(status).render('error', {
        ok: false,
        title,
        message,
        errors,
        hasErrors: errors.length > 0,
        backUrl,
        backLabel,
        retryUrl
    });
}

function getRetryUrl(req) {
    return req.params.id
        ? `/player/${encodeURIComponent(req.params.id)}/edit`
        : '/player/new';
}

function dateYearsAgo(years, now = new Date()) {
    const year = now.getFullYear() - years;
    const month = now.getMonth();
    const day = Math.min(now.getDate(), new Date(year, month + 1, 0).getDate());
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function handleImageUpload(req, res, next) {
    upload.single('image')(req, res, (error) => {
        if (!error) {
            return next();
        }

        let status = 400;
        let message;
        if (error.code === 'INVALID_IMAGE_TYPE') {
            message = 'Only image files are allowed.';
        } else if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            message = `The image must not exceed ${PLAYER_LIMITS.IMAGE_MAX_BYTES / (1024 * 1024)} MB.`;
        } else if (error instanceof multer.MulterError && error.code === 'LIMIT_UNEXPECTED_FILE') {
            message = 'Only one image file can be uploaded.';
        } else if (error instanceof multer.MulterError) {
            message = 'The image upload request is invalid.';
        } else {
            console.error('Could not upload the player image:', error);
            status = 500;
            message = 'The image could not be uploaded due to a server error.';
        }

        return renderError(res, {
            status,
            title: 'Image upload error',
            message,
            errors: [message],
            retryUrl: getRetryUrl(req)
        });
    });
}

async function removeFile(filePath) {
    try {
        await fs.promises.unlink(filePath);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }
}

async function removeUploadedFile(file) {
    if (file) {
        await removeFile(file.path);
    }
}

async function removeStoredUpload(imagePath) {
    if (typeof imagePath !== 'string' || !imagePath.startsWith('/uploads/')) {
        return false;
    }

    const fileName = imagePath.slice('/uploads/'.length);
    if (!fileName || fileName === '.' || fileName === '..' || path.posix.basename(fileName) !== fileName) {
        return false;
    }

    await removeFile(path.join(uploadsDirectory, fileName));
    return true;
}

function getPlayerErrors(validation, file, existingPlayer) {
    const errors = Object.keys(validation.fieldErrors).map((field) =>
        PLAYER_FIELD_ERRORS[field] || 'Player information is invalid.'
    );

    if (file) {
        if (!validateImageFile(file).valid) {
            errors.push(`The image must be a valid image file no larger than ${PLAYER_LIMITS.IMAGE_MAX_BYTES / (1024 * 1024)} MB.`);
        }
    } else if (!existingPlayer || !existingPlayer.image) {
        errors.push('An image is required.');
    }

    return errors;
}

/**
 * Player creation and editing routes.
 *
 * The application must mount this router before mainRouter because
 * mainRouter handles GET /player/:id.
 *
 * The store contract is:
 *   addPlayer(player)              -> the created player
 *   getPlayers()                   -> all players
 *   getPlayer(playerId)            -> player | null
 *   updatePlayer(playerId, player) -> true if the player was updated
 *
 * Usage in app.js:
 *   app.use(require('./routes/playerRouter')(store));
 *
 * Routes:
 *   GET  /player/new       render the creation form
 *   POST /player           create a player
 *   GET  /player/:id/edit  render the editing form
 *   POST /player/:id/edit  update a player
 */
module.exports = function createPlayerRouter(store) {
    const router = express.Router();

    const positionOptions = (selectedPosition) => [
        { value: 'portero', label: 'Goalkeeper' },
        { value: 'defensa', label: 'Defender' },
        { value: 'centrocampista', label: 'Midfielder' },
        { value: 'delantero', label: 'Forward' }
    ].map((position) => ({
        ...position,
        selected: position.value === selectedPosition
    }));

    const renderForm = (res, player, playerId) => {
        const formPlayer = player
            ? {
                ...player,
                id: String(player.id ?? player._id ?? playerId)
            }
            : null;
        const isEdit = Boolean(formPlayer);
        const options = positionOptions(formPlayer && formPlayer.position);
        const now = new Date();

        return res.render('playerForm', {
            player: formPlayer,
            isEdit,
            formTitle: isEdit ? 'Edit Player' : 'Create New Player',
            submitLabel: isEdit ? 'Save changes' : 'Save',
            action: isEdit ? `/player/${encodeURIComponent(playerId)}/edit` : '/player',
            hasPosition: options.some((position) => position.selected),
            positionOptions: options,
            hasImage: Boolean(formPlayer && formPlayer.image),
            minBirthDate: dateYearsAgo(PLAYER_LIMITS.AGE_MAX, now),
            maxBirthDate: dateYearsAgo(PLAYER_LIMITS.AGE_MIN, now)
        });
    };

    const renderNotFound = (res) => renderError(res, {
        status: 404,
        title: 'Player not found',
        message: 'The requested player does not exist.',
        retryUrl: '/player/new'
    });

    const handle = (fn) => async (req, res) => {
        try {
            await fn(req, res);
        } catch (err) {
            console.error(err);
            if (req.file && !req.uploadedImageSaved) {
                try {
                    await removeUploadedFile(req.file);
                } catch (cleanupError) {
                    console.error('Could not remove the uploaded player image:', cleanupError);
                }
            }
            return renderError(res, {
                status: 500,
                title: 'Server error',
                message: 'An unexpected error occurred. Please try again later.',
                retryUrl: getRetryUrl(req)
            });
        }
    };

    const getExistingPlayers = async () => {
        if (typeof store.getPlayers !== 'function') {
            throw new TypeError('The store must implement getPlayers() for player validation.');
        }

        const players = await store.getPlayers();
        if (!Array.isArray(players)) {
            throw new TypeError('store.getPlayers() must return an array.');
        }
        return players;
    };

    router.get('/player/new', (req, res) => {
        return renderForm(res, null);
    });

    router.post('/player', handleImageUpload, handle(async (req, res) => {
        const existingPlayers = await getExistingPlayers();
        const validation = validatePlayer(req.body, { existingPlayers });
        const errors = getPlayerErrors(validation, req.file, null);

        if (errors.length > 0) {
            await removeUploadedFile(req.file);
            return renderError(res, {
                status: 400,
                title: 'Player information is invalid',
                message: 'Please correct the following issues:',
                errors
            });
        }

        const player = {
            ...validation.values,
            image: `/uploads/${req.file.filename}`
        };

        await store.addPlayer(player);
        req.uploadedImageSaved = true;

        return res.render('confirmation', {
            ok: true,
            title: 'Player created',
            message: `Player "${player.player_name}" was created successfully.`,
            backUrl: '/',
            backLabel: 'Back to the home page'
        });
    }));

    router.get('/player/:id/edit', handle(async (req, res) => {
        const player = await store.getPlayer(req.params.id);

        if (!player) {
            return renderNotFound(res);
        }

        return renderForm(res, player, req.params.id);
    }));

    router.post('/player/:id/edit', handleImageUpload, handle(async (req, res) => {
        const { id } = req.params;
        const existingPlayer = await store.getPlayer(id);

        if (!existingPlayer) {
            await removeUploadedFile(req.file);
            return renderNotFound(res);
        }

        const existingPlayers = await getExistingPlayers();
        const validation = validatePlayer(req.body, {
            existingPlayers,
            excludeId: id
        });
        const errors = getPlayerErrors(validation, req.file, existingPlayer);

        if (errors.length > 0) {
            await removeUploadedFile(req.file);
            return renderError(res, {
                status: 400,
                title: 'Player information is invalid',
                message: 'Please correct the following issues:',
                errors,
                backUrl: `/player/${encodeURIComponent(id)}`,
                backLabel: 'Back to the player',
                retryUrl: `/player/${encodeURIComponent(id)}/edit`
            });
        }

        const updatedPlayer = {
            ...validation.values,
            image: req.file ? `/uploads/${req.file.filename}` : existingPlayer.image
        };

        const updateResult = await store.updatePlayer(id, updatedPlayer);
        if (updateResult === false) {
            await removeUploadedFile(req.file);
            return renderNotFound(res);
        }

        req.uploadedImageSaved = true;

        let cleanupWarning = false;
        if (req.file && existingPlayer.image) {
            try {
                await removeStoredUpload(existingPlayer.image);
            } catch (cleanupError) {
                console.error('Could not remove the previous player image:', cleanupError);
                cleanupWarning = true;
            }
        }

        return res.render('confirmation', {
            ok: true,
            title: 'Player updated',
            message: cleanupWarning
                ? 'The player was updated, but the previous image could not be removed.'
                : `Player "${updatedPlayer.player_name}" was updated successfully.`,
            backUrl: `/player/${encodeURIComponent(id)}`,
            backLabel: 'Back to the player'
        });
    }));

    return router;
};
