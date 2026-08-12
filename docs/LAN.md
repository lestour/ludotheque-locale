# Mode LAN

Le mode LAN est séparé du lanceur local. Le lanceur normal reste lié à
`127.0.0.1` et n’accepte aucune connexion provenant du réseau.

Le lanceur LAN démarre `server/lan_server.py` sur toutes les interfaces du
poste. Il affiche l’adresse privée à partager avec les autres joueurs du même
réseau Wi-Fi ou Ethernet.

## Salons

- Un salon privé utilise un code aléatoire de six caractères.
- Un salon public peut être rejoint aléatoirement par un joueur ayant choisi le
  même jeu.
- Chaque joueur reçoit un jeton aléatoire conservé dans `sessionStorage`.
- Seul l’hôte peut modifier les options et lancer la partie.
- Tous les joueurs doivent être prêts avant le lancement.
- Le nombre de places est indépendant du nombre de navigateurs connectés. Les
  places restantes deviennent des bots au lancement.
- La graine de génération et les options ne sont révélées qu’au démarrage.
- Pause, résultats et vote de revanche sont communs au salon.
- La fenêtre finale affiche le classement et permet d’exporter un replay JSON
  des événements publics. Les jetons et mains privées n’y figurent pas.
- Les mises à jour utilisent un WebSocket authentifié. Si le navigateur ou le
  réseau le bloque, le client revient automatiquement aux requêtes HTTP.
- Rhythm Lab conserve les partitions sur chaque appareil et compare leur
  empreinte SHA-256 avant d’autoriser le départ ; aucun fichier musical n’est
  envoyé au serveur.
- Rhythm Lab précharge aussi son moteur sonore et demande les autorisations
  MIDI ou microphone nécessaires au moment où le joueur se déclare prêt.
- Karaoké compare localement les empreintes de la partition et de
  l’accompagnement, puis demande l’accès au microphone avant le départ.

Les salons actifs sont enregistrés dans `.runtime/lan-rooms.json` avec des
jetons uniquement hachés. Ils peuvent donc être repris après un redémarrage du
serveur ; ce fichier local est exclu de Git et des archives de distribution.
L’option `--no-persist` restaure le fonctionnement uniquement en mémoire.
Après le lancement, aucun nouveau joueur ne peut entrer. Un joueur déjà inscrit
peut revenir avec son jeton de session ; son siège est piloté par un bot pendant
son absence. L’hôte est transféré au premier joueur encore connecté. Un salon
sans aucun joueur est détruit après 90 secondes, afin de tolérer une brève coupure
Wi-Fi sans conserver indéfiniment une partie abandonnée.

## Jeux actuellement synchronisés

- Sudoku, Nonogram, Démineur, Mahjong Solitaire et Klondike : même graine et mêmes options. Le premier
  joueur qui termine correctement clôt la course pour tous et déclenche la
  fenêtre de résultat commune. Au Démineur, le premier clic d’un joueur est
  relayé par le serveur : il initialise la même grille sur chaque appareil.
- Pour un Nonogram issu d’une image, chaque appareil charge localement le même
  fichier et sélectionne le même bloc, la même résolution et la même palette.
  Seule leur empreinte est comparée : l’image ne quitte jamais les appareils.
- Rhythm Lab : départ, options, pause et résultats communs. Une partition
  importée doit être chargée localement par chaque joueur avec la même empreinte.
- Karaoké : partition, accompagnement, départ, pause et résultat communs ;
  l’analyse du microphone reste locale à chaque appareil.
- Échecs/Dames et Go : deux sièges synchronisés, validation locale des coups,
  résultat commun et remplacement temporaire d’un joueur déconnecté par le bot
  de l’hôte.
- Bataille : paquet, plis, animations, noms et résultat synchronisés entre les
  navigateurs.
- Bataille Corse : cartes, tours et tapes passent par l’ordre du serveur afin
  que deux tapes presque simultanées donnent le même gagnant sur chaque écran.
- Totem Réflexe : retournements, duels et prise du totem sont ordonnés par le
  serveur ; seuls les joueurs concernés peuvent gagner un duel.
- Symbole Unique : le retournement initial et le premier symbole valide reçu
  par le serveur sont appliqués dans le même ordre chez tous les joueurs.
- Dernière Couleur : paquet, tours, pénalités et bots sont arbitrés par le
  serveur. Chaque navigateur ne reçoit que sa propre main et le nombre de
  cartes des adversaires. La graine secrète du paquet n’est jamais transmise.
- Sixième Carte : les mains et choix simultanés restent privés sur le serveur.
  Les cartes ne sont révélées qu’au moment de leur résolution croissante ; le
  choix d’une rangée et les scores sont également arbitrés côté serveur.
- Roi Pirate : les mains et enchères restent secrètes jusqu’à leur révélation ;
  plis, bonus, créatures marines, scores et bots sont calculés par le serveur.
- Course 1000 : pioche, mains, attaques, parades, bottes, coups fourrés et
  progression sont validés côté serveur. Seul le nombre de cartes adverses est
  communiqué aux navigateurs.
- Chatastrophe : incidents, protections et ordre de pioche restent privés. Une
  Prémonition n’est envoyée qu’au joueur qui l’a jouée et les bots reprennent
  automatiquement un siège déconnecté.
- Grille Zéro : les cartes face cachée ne transmettent ni valeur ni identifiant.
  Le mode classique, les retraits de lignes/colonnes, les étoiles, le marché
  d’actions et les scores sont arbitrés par le serveur. Une inspection ou un
  choix de trois cartes n’est envoyé qu’au joueur concerné ; les adversaires ne
  reçoivent que le nombre d’actions conservées.
- Rami Cartes et Rami Tuiles : mains et chevalets restent privés. Le serveur
  vérifie les groupes, suites, jokers, minimums d’ouverture, annulations et la
  conservation de chaque carte ou tuile avant d’accepter un tour.
- Empire Immobilier, Marchés du Monde et Fin de Mois : le serveur produit les
  résultats de roue et ordonne achats, enchères, cartes, échanges et décisions.
  Les navigateurs utilisent la même graine pour rejouer les paquets dans un
  ordre déterministe ; seul l’hôte peut faire agir un siège bot.

Le protocole d’adaptateur reste disponible pour les futurs jeux. Un jeu à
information privée n’est déclaré jouable en LAN qu’après ajout d’un moteur
serveur propre à ses règles ; le serveur ne diffuse jamais une main privée par
simple copie du DOM.

## Sécurité

Le serveur refuse les origines et noms d’hôte inconnus, limite la taille et la
fréquence des requêtes, valide les codes, jeux, noms et options, interdit les
chemins cachés ainsi que son propre dossier, et ajoute des en-têtes CSP,
`nosniff` et `same-origin`.

Le mode HTTP convient aux jeux classiques sur un réseau de confiance. Les
microphones des modules Rythme et Karaoké nécessitent `localhost` ou HTTPS. Le
serveur accepte `--cert` et `--key` pour utiliser un certificat TLS local.
