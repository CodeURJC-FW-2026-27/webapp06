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
- **MongoDB Community Server** (v9.0+, listening on `127.0.0.1:27017`)

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

On first run the database is seeded automatically with the 9 example players
and 2 sample reviews.  Subsequent restarts do not duplicate data.

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
| `package.json` | npm dependencies (Express, Mustache, MongoDB) and `npm start` script. |
| `app.js` | Express server entry point: view engine, static assets, body parser, MongoDB init, route mounting. |
| `db.js` | MongoDB connection helper (`connectDB`). |
| `seed.js` | Inserts the 9 example players and 2 reviews when the database is empty. |
| `routes/mainRouter.js` | `GET /` – home page with pagination (6/page), name search, and position category filter. |
| `routes/secondaryRouter.js` | *(Person 4 – unchanged)* Secondary-entity CRUD routes. |
| `utils/validator.js` | *(Person 4 – unchanged)* Review validation logic. |
| `views/index.mustache` | Home page template: player cards grid, pagination, search/category state. |
| `views/partials/header.mustache` | Shared header partial: search form + category buttons with active state. |
| `views/partials/footer.mustache` | Shared footer partial. |
| `views/detail.mustache` | *(Person 4 – unchanged)* Player detail page template. |
| `views/secondaryForm.mustache` | *(Person 4 – unchanged)* Review edit form template. |
| `views/secondaryResult.mustache` | *(Person 4 – unchanged)* Review operation result template. |
| `views/partials/secondaryFields.mustache` | *(Person 4 – unchanged)* Reusable review form fields partial. |
| `.gitignore` | Ignores `node_modules/` and `uploads/`. |

---

Practica 1.

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
  
