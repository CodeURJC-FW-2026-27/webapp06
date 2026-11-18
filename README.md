# **LEAGUES MARKET**

| Name  | Address | Github |
| :-------------:|:-------------:| :-------------: |
|Carlos Sanchez Gavilán|c.sanchezga.2024@alumnos.urjc.es|carloosanch|
|Sara El Moussaoui Houlbi|s.elmoussaoui.2024@alumnos.urjc.es|sara2000006|
|Diego Ezquerra Barroso|d.ezquerra.2024@alumnos.urjc.es|DiegoEzquerra1|
|Javier Rodríguez Gil|j.rodriguezgi.2024@alumnos.urjc.es|javrodr19|

## **Functionality**
### Entities
Main Entity: `LaLiga Player`

Main Entity Attributes: 
* `player_name`
* `team`
* `image`
* `description`
* `photographer`
* `price` 
* `date_of_birth`
* `league`
* `position`

Secondary Entity: `LaLiga Card Review`

Secondary Entity Attributes: 
* `nickname`
* `review_date`
* `opinion`
* `rating`

### Images
Each main entity will have a single associated `image`.

### Categorization
Each card will be divided according to its `position` (Porteros, Defensas, Centrocampistas, Delanteros), selectable in the header and as a dropdown when creating a player.

You can filter each card by `player_name`.

<img width="948" height="503" alt="image" src="https://github.com/user-attachments/assets/c073372a-3f07-4d5d-91bf-63957a9436ae" />
<img width="944" height="501" alt="image" src="https://github.com/user-attachments/assets/20ff1a21-be34-4442-ad70-4969826e7d56" />
<img width="944" height="501" alt="image" src="https://github.com/user-attachments/assets/c3c1463b-7d9e-4daf-89c6-54b0c8bd8b1b" />
<img width="949" height="503" alt="image" src="https://github.com/user-attachments/assets/a1650e84-362c-4f49-a8e0-18f1b78580bf" />
<img width="941" height="499" alt="image" src="https://github.com/user-attachments/assets/290fbf1c-d634-4a42-a26f-9d0b4bb2b943" />





---

## **Setup & Run (Práctica 2)**

### Prerequisites
- **Node.js** (v18 or later, tested on Node v26)
- **MongoDB Community Server** (v8.0 or later, listening on `127.0.0.1:27017`)

### MongoDB Service Management (Windows)
MongoDB runs as a standard Windows service (`MongoDB`):
- **Check status:**
  ```powershell
  Get-Service -Name MongoDB
  ```
- **Start service:**
  ```powershell
  Start-Service -Name MongoDB
  ```
- **Stop service:**
  ```powershell
  Stop-Service -Name MongoDB
  ```
- **Configuration file:** `C:\Program Files\MongoDB\Server\9.0\bin\mongod.cfg` (bound strictly to `127.0.0.1:27017` for local-only connections).

### Installation
```bash
npm install
```

### Start the server
```bash
npm start
```
The application will be available at **http://localhost:3000**.

Every time the server starts, the demo data is loaded again:
- the database is emptied and filled with the 9 example players and their
  6 reviews from `data/data.json`;
- the `uploads/` folder is emptied and the example images are copied into it
  from `data/images/`. Images uploaded through the forms are also stored in
  `uploads/`, which is not tracked by Git.

So the demo always starts from the same state, and restarting the server
undoes any change made while testing.

### Environment variables (optional)
| Variable   | Default                      | Description            |
|------------|------------------------------|------------------------|
| `PORT`     | `3000`                       | Server listening port  |
| `MONGO_URI`| `mongodb://localhost:27017`  | MongoDB connection URI |
| `MONGO_DB` | `leaguesmarket`              | Database name          |

---

## **Project file reference (Práctica 2)**

| File | Responsibility |
|------|----------------|
| `package.json` | npm dependencies (Express, Mustache, MongoDB, Multer) and `npm start` script. |
| `app.js` | Express server entry point: Mustache view engine (`.html` templates), static files, form parsing, demo data, routers and the 404/500 error pages. |
| `db.js` | MongoDB connection helper (`connectDB`). |
| `store.js` | Data access layer: every MongoDB query for players and reviews. |
| `seed.js` | Loads the demo data on every start (database + images copied from `data/images` to `uploads/`). |
| `data/data.json` | Example players, each one with its example reviews. |
| `data/images/` | Example player images. |
| `routes/homeRouter.js` | `GET /`: home page with pagination (6 per page), search by name and filter by position (category). |
| `routes/playerRouter.js` | Player pages: create, detail, edit and delete. Create and edit share the form and the handler (`savePlayer`). |
| `routes/reviewRouter.js` | Review routes: create, edit and delete. Create and edit share the handler (`saveReview`). |
| `utils/validator.js` | Server-side validation of players and reviews. |
| `utils/images.js` | Image upload (Multer), deletion and the `uploads/` folder. |
| `utils/viewHelpers.js` | Data formatting for the views and rendering of the confirmation and error pages. |
| `views/index.html` | Home page: player cards, pagination. |
| `views/playerDetail.html` | Player detail page with its reviews and the form to add a review. |
| `views/playerForm.html` | Player form, used to create and to edit. |
| `views/reviewForm.html` | Review edit form. |
| `views/confirmation.html` | Confirmation page shown after adding, editing or deleting a player or a review. |
| `views/error.html` | Error page (invalid form data, missing elements, failed uploads, unexpected errors). |
| `views/partials/head.html` | Shared `<head>` content (metadata, fonts, styles). |
| `views/partials/header.html` | Shared header: search form and category buttons. |
| `views/partials/footer.html` | Shared footer and scripts. |
| `views/partials/reviewFields.html` | Review form fields, used to create and to edit. |
| `public/` | Static files: CSS, JS and favicon. |
| `.gitignore` | Ignores `node_modules/` and `uploads/`. |

---

## **Demo (Práctica 2)**

### Before the defense
1. Start MongoDB (on Windows: `Start-Service -Name MongoDB`).
2. Run `npm install` (first time only) and `npm start`, then open **http://localhost:3000**.
   Every start reloads the demo data: 9 players and 6 reviews.
3. Have two images ready (JPG, PNG, WEBP, GIF or AVIF, up to 5 MB): one to create a
   player and another one to change it when editing.

### Steps
1. **Demo data and pagination**: the home page shows 6 of the 9 players; the
   pagination (numbers, « and ») shows the other 3 on page 2.
2. **Search by name**: type `garcia` in the search box of the header to find
   *Joan García* (case and accents are ignored).
3. **Categories**: click *Porteros* to see only Joan García and Unai Simón. The
   category and the search can be combined (*Porteros* + `unai`).
4. **Detail page**: click a card; the URL contains the player's id
   (`/player/<id>`). It shows every attribute (image, photographer, price, team,
   position, league, date of birth and description) and the player's reviews
   (e.g. *Lamine Yamal* has two).
5. **Create a player**: *Crear nuevo elemento*, fill in the form (example data
   below) and press *Guardar*. A confirmation page is shown; *Ver jugador* opens
   the new player, which also appears on page 2 and in its category.
6. **Validation in the browser**: a name starting with a lowercase letter or a
   description shorter than 20 characters is not accepted by the form. A name
   that already exists (e.g. `Lamine Yamal`) is rejected by the server.
7. **Validation in the server**: with the browser's developer tools, add the
   attribute `novalidate` to the `<form>` element (or remove `required`,
   `pattern`, `minlength`...) and submit the form empty. The error page lists one
   problem per field, the image included; *Volver a intentarlo* goes back to the form.
8. **Edit a player**: *Editar* on the detail page opens the same form filled in
   with its data and its current image. Change, for instance, the price and the
   image and press *Guardar cambios*.
9. **Reviews**: at the bottom of a detail page, add a review (confirmation page).
   *Editar* on a review opens its form with its data; *Borrar* deletes it. A
   nickname already used for that player, a future date or a rating outside 1–5
   lead to the error page.
10. **Delete a player**: *Borrar* on its detail page deletes the player, its
    reviews and its image, and shows a confirmation page.
11. **Same look everywhere**: every page, the confirmation and error pages
    included (e.g. `/player/abc`), shares the header and the footer.
12. Restarting the server (`Ctrl+C` and `npm start`) restores the demo data.

### Example data
| Field | Player to create |
|-------|------------------|
| Nombre del jugador | `Pedri González` |
| Fecha de nacimiento | `25/11/2002` |
| Equipo del jugador | `FC Barcelona` |
| Categoría | `Centrocampista` |
| Liga | `LaLiga` |
| Descripción | `Centrocampista creativo con una visión de juego excepcional y gran control del balón.` |
| Imagen | any JPG, PNG, WEBP, GIF or AVIF image up to 5 MB |
| Fotógrafo | `Getty Images` |
| Precio | `100000000` |

Review: nickname `Tester`, today's date, rating `4 - Muy buena`, opinion
`Muy buena carta para la colección.`

### Where each requirement is implemented
- **Shared header and footer**: Mustache partials in `views/partials/`
  (`header.html`, `footer.html` and `head.html`), included by every view.
- **One confirmation page and one error page** for every operation:
  `views/confirmation.html` and `views/error.html`, rendered through
  `renderConfirmation` and `renderError` (`utils/viewHelpers.js`).
- **Same form and handler to create and edit**: `views/playerForm.html` and
  `savePlayer` (`routes/playerRouter.js`); reviews share
  `views/partials/reviewFields.html` and `saveReview` (`routes/reviewRouter.js`).
- **Server-side validation**: `utils/validator.js`. The forms use HTML5
  attributes with the same limits.
- **Sample images**: `data/images/`, copied into `uploads/` on every start by
  `seed.js`. `uploads/` and `node_modules/` are listed in `.gitignore`.

---

## PRÁCTICA 1

Javi :
  Description  : I set up the project from the Bootstrap template (styles, favicon, scripts), added the example player images and implemented the main page (`index.html`): a Bootstrap grid with 9 player cards that link to the detail page, plus the "Crear nuevo elemento" button.

  Significant commits :
  [3d733fc91bd949c285ff232426cbcd8944fb6f8e](https://github.com/CodeURJC-FW-2026-27/webapp06/commit/3d733fc91bd949c285ff232426cbcd8944fb6f8e),
  [a930b491455d797970ce417566dd17c029f848fd](https://github.com/CodeURJC-FW-2026-27/webapp06/commit/a930b491455d797970ce417566dd17c029f848fd)

  Relevant Files : index.html
  
Carlos :
  Description  : Participado en detalle.html
  Significant commits : https://github.com/CodeURJC-FW-2026-27/webapp06/commit/6adb200a68d7ed014147818ce33cbbc65c55489e
  Relevant Files : detalle.html
  
Sara :

  Description : I implemented the header, footer and the searchbar.css.
  
  Significant commits : 
  [c36f8d4288afebc2bf83f429cad470ee32bb30f1](https://github.com/CodeURJC-FW-2026-27/webapp06/commit/c36f8d4288afebc2bf83f429cad470ee32bb30f1)

  Relevant Files : searchbar.css
  
Diego : 
  Description  : Creation page, creation review and details
  
  Significant commits : a8ff2671caedd371237ae59b930b91340b5dd4b5, 5f542cbb9f219f063332cd2fb21898a97cdea8f4, 0a03d4f385f4b116bf5f92c38996ca90ee71e15b, 89bb9aa237e6721306081a2a9a851711bfb1bd9d
  
  Relevant Files : newelem.html, newcomen.html

## PRÁCTICA 2.

Javier :
  Description  : I implemented the secondary entity (LaLiga Card Review): its server-side validation, the routes to create, edit and delete reviews, the review edit form, the form fields shared by creating and editing, and the list of reviews on the player detail page.

  Significant commits :
  [c7460180ce14c297f43d9030d451bf7c04829816](https://github.com/CodeURJC-FW-2026-27/webapp06/commit/c7460180ce14c297f43d9030d451bf7c04829816),
  [8a2cfa996435bf788589e4e46653e2a4b6b6aace](https://github.com/CodeURJC-FW-2026-27/webapp06/commit/8a2cfa996435bf788589e4e46653e2a4b6b6aace),
  [f33a09709f10a849ee341098974ca6260cce80bf](https://github.com/CodeURJC-FW-2026-27/webapp06/commit/f33a09709f10a849ee341098974ca6260cce80bf),
  [21297fe182adf642775dbb221bafa6be55e13a7b](https://github.com/CodeURJC-FW-2026-27/webapp06/commit/21297fe182adf642775dbb221bafa6be55e13a7b),
  [97e1cf80869b0991ed6a46a287bb6a95fa59b53b](https://github.com/CodeURJC-FW-2026-27/webapp06/commit/97e1cf80869b0991ed6a46a287bb6a95fa59b53b)

  Relevant Files : routes/reviewRouter.js, utils/validator.js, store.js, views/playerDetail.html, views/partials/reviewFields.html
  
Sara :

  Description : I implemented the player creation and editing routes (GET/POST), the reusable Mustache form view, image upload and cleanup using Multer, and client/server-side data validation.
  
  Significant commits : a96b0da, fbde250, 93382fc, 946a89a, 9630901, e5bdec7
  
  Relevant Files : routes/playerRouter.js, views/playerForm.html
