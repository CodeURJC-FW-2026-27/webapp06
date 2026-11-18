/**
 * utils/images.js – Storage of the player images.
 *
 * Every player image lives in the "uploads" folder, which is served at
 * /uploads and is not tracked by Git. On startup it is filled with the sample
 * images of "data/images" (see seed.js); new images are uploaded with Multer.
 * The database only stores the file name of each image.
 */

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const multer = require('multer');
const { PLAYER_LIMITS } = require('./validator');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

/**
 * Accepted image types and the extension used to store each one. The
 * extension comes from this list and not from the user's file name, so a file
 * can never be stored (and later served) as something other than an image.
 */
const IMAGE_EXTENSIONS = Object.freeze({
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif'
});

/** Value for the "accept" attribute of the file input. */
const IMAGE_ACCEPT = Object.keys(IMAGE_EXTENSIONS).join(',');

/** Upload size limit in MB (for the messages). */
const IMAGE_MAX_MB = PLAYER_LIMITS.IMAGE_MAX_BYTES / (1024 * 1024);

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, callback) => {
            fs.mkdir(UPLOADS_DIR, { recursive: true })
                .then(() => callback(null, UPLOADS_DIR), callback);
        },
        filename: (req, file, callback) => {
            callback(null, `player-${crypto.randomUUID()}${IMAGE_EXTENSIONS[file.mimetype]}`);
        }
    }),
    limits: {
        files: 1,
        fileSize: PLAYER_LIMITS.IMAGE_MAX_BYTES
    },
    fileFilter: (req, file, callback) => {
        if (IMAGE_EXTENSIONS[file.mimetype]) {
            return callback(null, true);
        }
        const error = new Error(`Unsupported image type: ${file.mimetype}`);
        error.code = 'INVALID_IMAGE_TYPE';
        return callback(error);
    }
});

/** Multer middleware that parses a multipart form and stores its "image" file. */
const imageUpload = upload.single('image');

/**
 * Message for the user when `error` was caused by the uploaded file, or null
 * when it is any other kind of error.
 */
function uploadErrorMessage(error) {
    if (error.code === 'INVALID_IMAGE_TYPE') {
        return 'La imagen debe estar en formato JPG, PNG, WEBP, GIF o AVIF.';
    }
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return `La imagen no puede superar los ${IMAGE_MAX_MB} MB.`;
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE' || error.code === 'LIMIT_FILE_COUNT') {
            return 'Solo se puede subir una imagen.';
        }
        return 'El formulario enviado no es válido.';
    }
    return null;
}

/**
 * Deletes an image from the uploads folder. It never throws: a missing file is
 * ignored and any other problem is only logged, because the database
 * operation that called it has already finished.
 *
 * @param {string} [fileName]  File name stored in the player document.
 */
async function deleteImage(fileName) {
    if (!fileName) return;
    try {
        // basename() keeps the path inside UPLOADS_DIR whatever the stored value is.
        await fs.rm(path.join(UPLOADS_DIR, path.basename(fileName)), { force: true });
    } catch (error) {
        console.error(`Could not delete the image ${fileName}:`, error);
    }
}

module.exports = {
    IMAGE_ACCEPT,
    IMAGE_MAX_MB,
    UPLOADS_DIR,
    deleteImage,
    imageUpload,
    uploadErrorMessage
};
