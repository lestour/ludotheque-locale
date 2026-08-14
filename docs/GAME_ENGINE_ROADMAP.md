# Feuille de route des moteurs de jeu

Les briques communes déjà disponibles sont le hasard reproductible, les profils,
les records, les sauvegardes, les options documentées, les commandes tactiles,
les salons LAN, les replays et les résultats coopératifs ou par équipes.

## Moteur d’aventure vue du dessus — disponible

`Chroniques d’Asteria` fournit désormais une carte procédurale validée, des
biomes, collisions en perspective, combats, donjons principaux et annexes,
objets ouvrant progressivement le monde, énigmes spécialisées, sauvegarde avec
migration, brouillard de guerre, records et profils multijoueurs par score.

Les prochaines extensions de ce moteur sont facultatives : atlas de sprites
original, éditeur local de cartes JSON et coopération simultanée avec caméra
partagée. Elles ne bloquent plus une campagne solo complète.

## Moteur d’exploration latérale — disponible

`Profondeurs d’Éclipse` génère des salles de dimensions variables, plateformes,
portes spécialisées, passages de boule, bombes, grappin, vitesse, dangers et
défis de maîtrise. La génération valide les accès et la campagne peut être
terminée sans traverser les obstacles ni contourner les capacités requises.

Les extensions facultatives concernent surtout de nouveaux ensembles de salles,
des boss supplémentaires et des graphismes originaux.

## Projet ultérieur : jeu de tir pseudo-3D

Le moteur pseudo-3D pourra utiliser un raycaster Canvas sans dépendance réseau :

1. carte 2D transformée en murs, portes et zones secrètes ;
2. rendu des murs texturés, sol, plafond et sprites orientés ;
3. armes, munitions, impacts, ennemis et navigation ;
4. niveaux validés, clés, interrupteurs, ascenseurs et sortie ;
5. difficulté adaptant quantité, agressivité et ressources ;
6. coopération et duel LAN avec serveur autoritaire pour les positions et tirs ;
7. éditeur de niveau et import d’assets locaux.

Assets utiles à fournir : textures carrées de murs et sols, sprites ennemis sous
plusieurs angles, armes vues à la première personne, objets, portes et sons.

## Autres jeux compatibles avec les moteurs actuels

- plateforme : contre-la-montre à plusieurs, collecte coopérative et relais ;
- spatial : duel d’arènes, escorte coopérative et défense d’un objectif commun ;
- arcade : course verticale, jeu de chars, grenouille routière et défense de base ;
- grille : Picross compétitif, 2048 quotidien et puzzles en relais ;
- rythme : orchestre coopératif, duel de précision et équipes par pupitres.

Chaque nouveau jeu doit fournir une graine reproductible, un diagnostic local,
des commandes clavier/tactiles, un mode nuit, des records signés par les options
de difficulté et au moins un profil multijoueur lorsque ses règles le permettent.
