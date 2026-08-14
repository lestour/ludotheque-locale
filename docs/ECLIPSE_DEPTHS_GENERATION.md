# Génération des Profondeurs de l’Éclipse

Le générateur est séparé du moteur de jeu dans
`games/arcade/eclipse-depths-world.js`. Une graine et une taille produisent
toujours la même station.

## Contrat de progression

- Le Noyau compact reste la première capacité et le Cœur plasma la dernière.
- Les Bottes gravitationnelles, le Propulseur de phase et le Filin quantique
  changent d’ordre selon la graine.
- Une porte de progression n’est placée qu’après le gardien qui remet la
  capacité correspondante.
- Chaque branche bonus exige uniquement une capacité déjà récupérable depuis
  son point d’entrée.
- Les raccourcis demandent une capacité tardive : ils accélèrent le retour sans
  permettre de sauter un gardien principal.
- Une station de sauvegarde est placée au début de chaque nouveau secteur.
- Les cinq capacités sont aussi utilisées dans une épreuve physique : tunnel,
  mur vertical, rideau de phase, gouffre magnétique ou blindage plasma.
- Les salles ont des largeurs et hauteurs variables. La caméra suit le joueur
  sans modifier les coordonnées utilisées par la simulation ou le LAN.
- Toutes les portes reçoivent un verrou tirable ; les blindages avancés
  distinguent impulsion, plasma, rayon chargé et missile.
- Les nœuds de navigation utilisent des relais ordonnés. Ils verrouillent les
  issues indépendamment des combats et annoncent chaque étape résolue.
- Les branches bonus peuvent remettre rayon chargé, missiles, bombes compactes,
  accélérateur ou armure tellurique, puis proposent une salle de maîtrise qui
  vérifie immédiatement la nouvelle mécanique.
- Les grandes salles reçoivent des ascenseurs verticaux ou plateformes sur
  rails qui transportent réellement l’armure. Certains relais doivent être
  activés dans un ordre donné avant expiration du chronomètre.
- Les plateformes sont générées intégralement dans les limites de leur salle.
  Les ascenseurs démarrent sans saut visuel et les créatures terrestres ne
  peuvent ni traverser les blindages ni marcher au-dessus d’un gouffre.
- La réussite d’une épreuve de maîtrise augmente désormais la réserve maximale
  d’énergie, afin que les détours aient un bénéfice durable. Cette récompense
  n’est accordée qu’après destruction du verrou avec le bon module ou traversée
  complète des pics avec l’armure adaptée ; elle est partagée en coopération.

`validateWorld()` simule l’exploration en ajoutant les capacités à l’inventaire
au moment où leur salle devient accessible. La génération n’est valide que si
la salle finale, toutes les capacités principales, toutes les branches bonus et
leurs salles de maîtrise sont atteignables. Les diagnostics vérifient aussi la
présence de salles variables et de puzzles sur chaque format de station. Chaque
géométrie est contrôlée séparément : plateformes, course des éléments mobiles,
obstacle de capacité et relais doivent tous être cohérents.

## Assets remplaçables

Le rendu actuel est volontairement réalisé en Canvas sans ressources externes.
Un futur pack graphique peut remplacer indépendamment :

- l’armure normale et compacte ;
- les quatre ennemis communs et les six gardiens ;
- les cinq portes et obstacles de capacité ;
- les plateformes des cinq secteurs ;
- les tirs, explosions, impacts, modules et stations de sauvegarde.

Des sprites PNG transparents en multiples de 32 pixels ou une spritesheet JSON
conviennent au moteur actuel.
