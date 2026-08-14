# Ressources graphiques d’Asteria

Le jeu fonctionne actuellement sans ressource externe grâce à un rendu Canvas original. Un futur habillage dessiné peut remplacer ce rendu sans modifier les règles ni les générateurs.

## Profondeur du monde

Le rendu trie les personnages, arbres, bâtiments et falaises selon leur
coordonnée verticale. Une canopée masque donc un personnage placé derrière
l’arbre, tandis que seule la petite zone du tronc bloque le déplacement. Les
falaises utilisent un sommet, un flanc et une hauteur variables ; les échelles
ouvrent un passage et les parois fissurées deviennent des grottes après une
bombe. Les futurs sprites devront conserver un point d’ancrage au niveau des
pieds pour préserver cet effet.

Le générateur certifie également un itinéraire depuis Clairval jusqu’à chacun
des six donjons principaux avec l’inventaire disponible à cette étape. Les
falaises, arbres et obstacles décoratifs ne peuvent pas recouvrir ces chemins.
Les ennemis, le joueur et les projectiles partagent les mêmes collisions pour
les murs, bâtiments et troncs.

Les sauvegardes conservent aussi l’exploration, le score et la puissance des
bombes. Les anciennes listes d’obstacles indexées sont converties vers des
identifiants stables lors du premier chargement. Dans les donjons, l’épreuve
placée après un objet principal privilégie désormais cet objet au lieu d’une
énigme générique sans rapport.

## Format conseillé

- PNG avec transparence, palette sRGB et pixels nets sans interpolation.
- Tuiles du monde : `32 × 32 px`, regroupées dans des atlas de `512 × 512 px` avec une marge transparente de `1 px` autour de chaque tuile.
- Sols animés (eau, lave, herbes) : quatre images consécutives par animation.
- Personnage : cellules de `48 × 48 px`, quatre directions, six images de marche, quatre d’attaque et deux d’utilisation d’objet.
- Ennemis ordinaires : cellules de `48 × 48 px`, quatre directions ou animation symétrique, quatre images minimum.
- Mini-boss : cellules de `96 × 96 px`. Boss : cellules de `128 × 128 px` ou `192 × 192 px`.
- Objets au sol et inventaire : `32 × 32 px`. Portraits et dialogues : `256 × 256 px`.
- Éléments de donjon : tuiles `32 × 32 px`, portes de largeur variable et variantes nord, sud, est et ouest.

## Atlas attendus

- `world-terrain.png` : plaines, forêt, montagne, plage, mer, lac, marais, ruines et volcan.
- `world-objects.png` : arbres, rochers fissurés, blocs, gouffres, ponts, coffres, tentes et entrées.
- `hero.png`, `enemies.png`, `bosses.png`, `items.png` et `dungeon-tiles.png`.
- Tous les dessins doivent rester originaux et ne pas reprendre les sprites ou personnages d’une licence existante.

Une définition JSON précisera ensuite les coordonnées de chaque animation. Les proportions ci-dessus permettent déjà de préparer les dessins indépendamment du moteur.
