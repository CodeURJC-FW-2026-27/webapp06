'use strict';

/**
 * seed.js – Insert example data when the database is empty.
 *
 * Reuses the nine players shown in Assignment 1's index.html and the two
 * example reviews from detalle.html.  Calling `seedIfEmpty(db)` is safe on
 * every restart: it only inserts when the `players` collection has zero
 * documents.
 */

/**
 * Example players extracted from index.html and detalle.html.
 * Field names match the README and Person 4's templates exactly:
 *   player_name, team, image, description, photographer, price,
 *   date_of_birth, league, position.
 */
const PLAYERS = [
    {
        player_name: 'Joan García',
        team: 'FC Barcelona',
        image: '/images/01-Joan_Garcia.webp',
        description:
            'Jugador con gran proyección internacional, excelente reflejo en el área y capacidad para salir con seguridad desde el fondo. Perfil completo para una plantilla competitiva con gran control bajo presión.',
        photographer: 'Enrique Rodriguez',
        price: '79.000.000',
        date_of_birth: '04/05/2001',
        league: 'LaLiga',
        position: 'Portero'
    },
    {
        player_name: 'Lamine Yamal',
        team: 'FC Barcelona',
        image: '/images/10-Lamine.webp',
        description:
            'Joven extremo con un talento generacional. Regate eléctrico, visión de juego y capacidad goleadora desde la banda derecha. Una de las mayores promesas del fútbol mundial.',
        photographer: 'Getty Images',
        price: '180.000.000',
        date_of_birth: '13/07/2007',
        league: 'LaLiga',
        position: 'Delantero'
    },
    {
        player_name: 'Marc Cucurella',
        team: 'Chelsea FC',
        image: '/images/CUCURELLA_POSE_1500X2000.webp',
        description:
            'Lateral izquierdo muy ofensivo con gran capacidad de despliegue físico. Destaca por su intensidad defensiva y su aporte en ataque por la banda.',
        photographer: 'Chelsea FC Media',
        price: '35.000.000',
        date_of_birth: '22/07/1998',
        league: 'Premier League',
        position: 'Defensa'
    },
    {
        player_name: 'Kylian Mbappé',
        team: 'Real Madrid',
        image: '/images/MBAPPE_POSE_1500X2000.webp',
        description:
            'Delantero explosivo con una velocidad demoledora y gran capacidad goleadora. Referencia del fútbol francés y una de las estrellas del Real Madrid.',
        photographer: 'Real Madrid CF',
        price: '200.000.000',
        date_of_birth: '20/12/1998',
        league: 'LaLiga',
        position: 'Delantero'
    },
    {
        player_name: 'Aubameyang',
        team: 'Al-Qadsiah FC',
        image: '/images/aubameyang-deportivo-fantasy.webp',
        description:
            'Delantero rápido y letal dentro del área. Con experiencia en las principales ligas europeas, aporta olfato goleador y veteranía al equipo.',
        photographer: 'AFP',
        price: '15.000.000',
        date_of_birth: '18/06/1989',
        league: 'Saudi Pro League',
        position: 'Delantero'
    },
    {
        player_name: 'Héctor Bellerín',
        team: 'FC Barcelona',
        image: '/images/foto-curriculum-hector-bellerin.webp',
        description:
            'Lateral derecho con gran velocidad y compromiso social. Tras años en el Arsenal, regresó al fútbol español aportando experiencia y liderazgo.',
        photographer: 'FC Barcelona',
        price: '5.000.000',
        date_of_birth: '19/03/1995',
        league: 'LaLiga',
        position: 'Defensa'
    },
    {
        player_name: 'Antoine Griezmann',
        team: 'Atlético de Madrid',
        image: '/images/griezmann.jpg',
        description:
            'Delantero versátil con gran inteligencia táctica. Capaz de jugar como mediapunta, extremo o segundo delantero, aportando goles y asistencias con regularidad.',
        photographer: 'Atlético de Madrid',
        price: '25.000.000',
        date_of_birth: '21/03/1991',
        league: 'LaLiga',
        position: 'Delantero'
    },
    {
        player_name: 'Unai Simón',
        team: 'Athletic Club',
        image: '/images/imageskjnj.jpeg',
        description:
            'Portero titular de la selección española. Destaca por su juego con los pies y su capacidad para realizar paradas decisivas en los grandes partidos.',
        photographer: 'Athletic Club',
        price: '40.000.000',
        date_of_birth: '11/06/1997',
        league: 'LaLiga',
        position: 'Portero'
    },
    {
        player_name: 'Iñigo Vicente',
        team: 'Athletic Club',
        image: '/images/p242833_t189_2026_1_002_000.jpg',
        description:
            'Centrocampista técnico con gran capacidad para organizar el juego. Hábil con ambas piernas, destaca por su visión de pase y su disparo desde fuera del área.',
        photographer: 'LaLiga',
        price: '20.000.000',
        date_of_birth: '23/01/1997',
        league: 'LaLiga',
        position: 'Centrocampista'
    }
];

/**
 * Example reviews extracted from detalle.html (belong to the first player,
 * Joan García).  Field names match Person 4's secondary entity:
 *   nickname, review_date, opinion, rating.
 */
const REVIEWS = [
    {
        nickname: 'Anónimo',
        review_date: '2026-10-08',
        opinion:
            'Como experto en futbol es mejor jugador Zak. Nadie mas arrasaria como el en Masara',
        rating: 4
    },
    {
        nickname: 'Tú',
        review_date: '2026-10-13',
        opinion: 'not bad, buen portero con proyección internacional',
        rating: 5
    }
];

/**
 * Seed the database only when the `players` collection is empty.
 * Reviews are linked to the first player via `playerId`.
 *
 * @param {import('mongodb').Db} db
 */
async function seedIfEmpty(db) {
    const players = db.collection('players');
    const count = await players.countDocuments();
    if (count > 0) {
        console.log(`Seed skipped – ${count} player(s) already in database.`);
        return;
    }

    const result = await players.insertMany(PLAYERS);
    console.log(`Seed: inserted ${result.insertedCount} players.`);

    // Link reviews to the first player (Joan García).
    const firstPlayerId = result.insertedIds[0];
    const reviewDocs = REVIEWS.map((r) => ({ ...r, playerId: firstPlayerId }));

    const reviews = db.collection('reviews');
    const rr = await reviews.insertMany(reviewDocs);
    console.log(`Seed: inserted ${rr.insertedCount} reviews.`);
}

module.exports = { seedIfEmpty };
