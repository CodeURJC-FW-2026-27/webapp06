'use strict';

const crypto = require('node:crypto');
const express = require('express');
const fs = require('node:fs/promises');
const multer = require('multer');
const { ObjectId } = require('mongodb');
const path = require('node:path');
const {
    PLAYER_LIMITS,
    VALID_POSITIONS,
    validateImageFile,
    validatePlayer
} = require('../utils/validator');

const imagesDirectory = path.resolve(__dirname, '..', 'images');

const upload = multer({
    storage: multer.diskStorage({
        destination: async (req, file, callback) => {
            try {
                await fs.mkdir(imagesDirectory, { recursive: true });
                callback(null, imagesDirectory);
            } catch (error) {
                callback(error);
            }
        },
        filename: (req, file, callback) => {
            const extension = path.extname(file.originalname);
            callback(null, `player-upload-${crypto.randomBytes(16).toString('hex')}${extension}`);
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
    player_name: `El nombre del jugador es obligatorio, debe empezar por mayúscula, tener entre ${PLAYER_LIMITS.NAME_MIN} y ${PLAYER_LIMITS.NAME_MAX} caracteres y no repetirse.`,
    team: `El equipo es obligatorio, debe empezar por mayúscula y tener entre ${PLAYER_LIMITS.TEAM_MIN} y ${PLAYER_LIMITS.TEAM_MAX} caracteres.`,
    league: `La liga es obligatoria, debe empezar por mayúscula y tener entre ${PLAYER_LIMITS.LEAGUE_MIN} y ${PLAYER_LIMITS.LEAGUE_MAX} caracteres.`,
    photographer: `El fotógrafo es obligatorio, debe empezar por mayúscula y tener entre ${PLAYER_LIMITS.PHOTOGRAPHER_MIN} y ${PLAYER_LIMITS.PHOTOGRAPHER_MAX} caracteres.`,
    position: `La posición es obligatoria y debe ser una de estas: ${VALID_POSITIONS.join(', ')}.`,
    date_of_birth: `La fecha de nacimiento debe ser válida y el jugador debe tener entre ${PLAYER_LIMITS.AGE_MIN} y ${PLAYER_LIMITS.AGE_MAX} años.`,
    price: `El precio es obligatorio y debe ser un número entero entre ${PLAYER_LIMITS.PRICE_MIN} y ${PLAYER_LIMITS.PRICE_MAX}.`,
    description: `La descripción es obligatoria y debe tener entre ${PLAYER_LIMITS.DESCRIPTION_MIN} y ${PLAYER_LIMITS.DESCRIPTION_MAX} caracteres.`
});

function renderError(res, {
    status = 400,
    title = 'Error en los datos del jugador',
    message,
    errors = [],
    backUrl = '/',
    backLabel = 'Volver a la página principal',
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

function isValidObjectId(id) {
    return ObjectId.isValid(id) && String(new ObjectId(id)) === String(id);
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
            message = 'Solo se permiten archivos de imagen.';
        } else if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            message = `La imagen no puede superar los ${PLAYER_LIMITS.IMAGE_MAX_BYTES / (1024 * 1024)} MB.`;
        } else if (error instanceof multer.MulterError && error.code === 'LIMIT_UNEXPECTED_FILE') {
            message = 'Solo se puede subir una imagen.';
        } else if (error instanceof multer.MulterError) {
            message = 'La solicitud de subida de imagen no es válida.';
        } else {
            console.error('Could not upload the player image:', error);
            status = 500;
            message = 'No se pudo subir la imagen debido a un error del servidor.';
        }

        return renderError(res, {
            status,
            title: 'Error al subir la imagen',
            message,
            errors: [message],
            retryUrl: getRetryUrl(req)
        });
    });
}

async function removeFile(filePath) {
    try {
        await fs.unlink(filePath);
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

async function removeStoredImage(imagePath, playerId, store) {
    if (typeof imagePath !== 'string' || !imagePath.startsWith('/images/')) {
        return false;
    }

    const fileName = imagePath.slice('/images/'.length);
    if (!fileName || fileName === '.' || fileName === '..' || path.basename(fileName) !== fileName) {
        return false;
    }

    if (store.getPlayerByImage) {
        const otherPlayer = await store.getPlayerByImage(imagePath, playerId);
        if (otherPlayer) {
            return false;
        }
    }

    await removeFile(path.join(imagesDirectory, fileName));
    return true;
}

function getPlayerErrors(validation, file, existingPlayer) {
    const errors = Object.keys(validation.fieldErrors).map((field) =>
        PLAYER_FIELD_ERRORS[field] || 'Los datos del jugador no son válidos.'
    );

    if (file) {
        if (!validateImageFile(file).valid) {
            errors.push(`La imagen debe ser válida y no superar los ${PLAYER_LIMITS.IMAGE_MAX_BYTES / (1024 * 1024)} MB.`);
        }
    } else if (!existingPlayer || !existingPlayer.image) {
        errors.push('La imagen es obligatoria.');
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
 *   getPlayerByImage(imagePath, excludeId) -> player | null (optional)
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
        { value: 'portero', label: 'Portero' },
        { value: 'defensa', label: 'Defensa' },
        { value: 'centrocampista', label: 'Centrocampista' },
        { value: 'delantero', label: 'Delantero' }
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
            formTitle: isEdit ? 'Editar jugador' : 'Crear nuevo jugador',
            submitLabel: isEdit ? 'Guardar cambios' : 'Guardar',
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
        title: 'Jugador no encontrado',
        message: 'El jugador solicitado no existe.',
        retryUrl: '/player/new'
    });

    const renderInvalidId = (res) => renderError(res, {
        status: 404,
        title: 'No encontrado',
        message: 'El identificador del jugador no es válido.'
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
                title: 'Error del servidor',
                message: 'Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.',
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
                title: 'Datos del jugador no válidos',
                message: 'Corrige los siguientes errores:',
                errors
            });
        }

        const player = {
            ...validation.values,
            image: `/images/${req.file.filename}`
        };

        await store.addPlayer(player);
        req.uploadedImageSaved = true;

        return res.render('confirmation', {
            ok: true,
            title: 'Jugador creado',
            message: `El jugador "${player.player_name}" se ha creado correctamente.`,
            backUrl: '/',
            backLabel: 'Volver a la página principal'
        });
    }));

    router.get('/player/:id/edit', handle(async (req, res) => {
        if (!isValidObjectId(req.params.id)) {
            return renderInvalidId(res);
        }

        const player = await store.getPlayer(req.params.id);

        if (!player) {
            return renderNotFound(res);
        }

        return renderForm(res, player, req.params.id);
    }));

    router.post('/player/:id/edit', handleImageUpload, handle(async (req, res) => {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            await removeUploadedFile(req.file);
            return renderInvalidId(res);
        }

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
                title: 'Datos del jugador no válidos',
                message: 'Corrige los siguientes errores:',
                errors,
                backUrl: `/player/${encodeURIComponent(id)}`,
                backLabel: 'Volver al jugador',
                retryUrl: `/player/${encodeURIComponent(id)}/edit`
            });
        }

        const updatedPlayer = {
            ...validation.values,
            image: req.file ? `/images/${req.file.filename}` : existingPlayer.image
        };

        const updateResult = await store.updatePlayer(id, updatedPlayer);
        if (updateResult === false || (updateResult && updateResult.matchedCount === 0)) {
            await removeUploadedFile(req.file);
            return renderNotFound(res);
        }

        req.uploadedImageSaved = true;

        let cleanupWarning = false;
        if (req.file && existingPlayer.image) {
            try {
                await removeStoredImage(existingPlayer.image, id, store);
            } catch (cleanupError) {
                console.error('Could not remove the previous player image:', cleanupError);
                cleanupWarning = true;
            }
        }

        return res.render('confirmation', {
            ok: true,
            title: 'Jugador actualizado',
            message: cleanupWarning
                ? 'El jugador se actualizó, pero no se pudo eliminar la imagen anterior.'
                : `El jugador "${updatedPlayer.player_name}" se actualizó correctamente.`,
            backUrl: `/player/${encodeURIComponent(id)}`,
            backLabel: 'Volver al jugador'
        });
    }));

    return router;
};
