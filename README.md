# **LALIGA SHOP**

| Name  | Adress | Github |
| :-------------:|:-------------:| :-------------: |
|Carlos Sanchez Gavilán|c.sanchezga.2024@alumnos.urjc.es|carloosanch|
|Sara El Moussaoui Houlbi|s.elmoussaoui.2024@alumnos.urjc.es|sara2000006|
|Diego Ezquerra Barroso|d.ezquerra.2024@alumnos.urjc.es|DiegoEzquerra1|
|Javier Rodríguez Gil|j.rodriguezgi.2024@alumnos.urjc.es|javrodr19|

## **Functionality**
### Entities
Main Entity: `LaLiga Card`

Main Entity Attributes: 
* `player_name`
* `card_price`
* `card_image`
* `description`
* `illustrator`
* `release_date`
* `collection` (LaLiga, LaLiga Hypermotion, LaLiga Genuine...)

Secondary Entity: `LaLiga Card Review`

Secondary Entity Attributes: 
* `nickname`
* `review_date`
* `opinion`
* `rating`

### Images
Each main entity will have a single associated `card_image`.

### Categorization
Each card will be divided according to its `collection_number`.

You can filter each card by `player_name`.
