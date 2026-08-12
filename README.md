# Ludothèque locale

Le point d’entrée est `index.html` à la racine.

## Lancement multiplateforme

- macOS : double-cliquer sur `Lancer le Hub.command` ; le navigateur par défaut est utilisé. Garder la fenêtre Terminal du serveur ouverte pendant la partie.
- Windows : double-cliquer sur `Lancer le Hub Windows.bat` ; Python est utilisé s’il est installé, sinon le serveur PowerShell inclus prend le relais.
- Linux : lancer `sh "Lancer le Hub Linux.sh"` et garder ce terminal ouvert pendant la partie.

Pour jouer sur le même réseau, utiliser le lanceur `Lancer le Hub LAN` adapté au
système. Il démarre un serveur distinct, affiche l’adresse privée à partager et
active le bouton **Jouer en LAN** dans chaque jeu. Le lanceur local classique reste limité
à cet ordinateur. Le fonctionnement et les protections sont détaillés dans
`docs/LAN.md`.

Les salons utilisent un WebSocket authentifié avec repli HTTP automatique.
Dernière Couleur dispose en plus d’un moteur serveur : les mains adverses et la
graine secrète du paquet ne sont jamais envoyées aux navigateurs.

## Téléphones et tablettes

- Android et iPhone/iPad peuvent ouvrir directement l’adresse affichée par le
  lanceur LAN dans Chrome, Safari ou Firefox.
- Les interfaces utilisent des cibles tactiles agrandies, des panneaux
  responsive et des mains de cartes défilables horizontalement.
- Le Nonogram possède des outils tactiles séparés pour remplir, barrer, gommer
  et déplacer sa grille, avec zoom par boutons, molette ou pincement.
- L’installation comme application et l’accès au microphone nécessitent une
  origine sécurisée. `localhost` fonctionne sur l’ordinateur serveur ; depuis
  un téléphone du LAN, il faut lancer le serveur avec un certificat HTTPS
  accepté par le téléphone.

Pour préparer HTTPS, lancer `python3 tools/create_lan_certificate.py`, installer
le fichier `.runtime/tls/lan.crt` comme certificat de confiance sur les
appareils concernés, puis relancer le lanceur LAN. Les lanceurs détectent alors
automatiquement le certificat et passent en HTTPS. La clé privée reste locale,
hors Git et hors des archives.

Le nombre de places d’un salon peut être supérieur au nombre de personnes
connectées : les sièges libres, puis les sièges temporairement déconnectés, sont
pris en charge par des bots jusqu’à l’arrivée ou au retour de leur joueur.

Un petit serveur HTTP local est nécessaire pour les modules audio, les AudioWorklets et le chargement de `games/rhythm/assets/MS-Basic.sf3`. Il ne faut pas ouvrir directement `index.html` avec une adresse `file://`. Les lanceurs cherchent Python 3, puis une solution locale de repli selon le système.

Depuis un navigateur compatible, la ludothèque peut aussi être installée comme application. Les pages déjà visitées restent disponibles hors ligne ; la volumineuse banque sonore MS Basic reste chargée directement depuis le dossier local afin de ne pas saturer le cache du navigateur.

Le bouton **Accessibilité** présent sur chaque page règle localement la taille du
texte, le thème clair/sombre, le contraste renforcé et la réduction des
animations. Les profils du hub séparent les records, statistiques, options et
sauvegardes. Échecs/Dames, Go et Klondike reprennent automatiquement leur
position locale, sauf en LAN. Depuis le hub,
**Exporter mes données** crée une sauvegarde JSON des records, préférences et
sauvegardes de jeu. Les codes, jetons et identifiants des salons LAN sont
volontairement exclus de ce fichier.

Pour partager l’application, compresser le dossier complet sous le nom `Ludotheque-locale`, sans retirer `vendor`, `games/rhythm/assets/MS-Basic.sf3` ni les quatre fichiers `Lancer le Hub…`. L’application ne dépend plus des liens symboliques pour charger ses scripts partagés.

Un paquet propre et multiplateforme peut être généré avec
`python3 tools/package_release.py`. Il est créé dans
`dist/Ludotheque-locale.zip`, inclut les lanceurs macOS, Windows et Linux ainsi
que les ressources audio, mais exclut Git, les caches et les fichiers compilés.
Le workflow GitHub `Validation locale` reconstruit et vérifie ce paquet à chaque
push et pull request. Il exécute également le diagnostic complet dans Chrome
headless, avec des vues téléphone sur les principaux jeux.

Les lanceurs vérifient désormais les cinq fichiers indispensables au moteur MS Basic avant d’ouvrir le hub. Dans Rhythm Lab, le bouton **Tester MS Basic** contrôle aussi le protocole, Web Audio, AudioWorklet, les modules locaux et le SoundFont ; son message indique précisément l’élément absent ou incompatible.

Les licences et attributions des composants redistribués sont regroupées dans `THIRD_PARTY_NOTICES.md`. Le fichier `games/rhythm/assets/MS-Basic-LICENSE.md` doit toujours accompagner `MS-Basic.sf3`.

Le code original est publié sous licence MIT (`LICENSE`). Cette licence ne
s'applique pas aux composants et ressources tiers. Les règles de contribution
et de publication sont détaillées dans `CONTRIBUTING.md` et `LEGAL.md`.

Rhythm Lab utilise les positions physiques standard du clavier (`KeyboardEvent.code`) et propose une sélection explicite AZERTY, QWERTY ou QWERTZ. Le panneau **Mapper les commandes** permet de remplacer chaque touche.

Le dépôt ne contient aucune partition ou image utilisateur. Les imports restent
locaux au navigateur et ne doivent être ajoutés au dépôt que si leur licence ou
une autorisation explicite permet leur publication.

- `games/grid` : Sudoku, Nonogram et Démineur.
- `games/cards/classic` : Bataille, Bataille Corse et Klondike.
- `games/cards/modern` : Symbole Unique, Totem Réflexe, Dernière Couleur, Grille Zéro, Sixième Carte, Course 1000, Roi Pirate et Chatastrophe.
- `games/board` : Empire Immobilier, Marchés du Monde, Fin de Mois, Échecs, Dames, Rami Tuiles et Mahjong Solitaire.
- `games/rhythm` : Rhythm Lab.
- `shared` : utilitaires partagés pour cartes et effets.
- `engine/cpp` : prototype C++ historique du solveur Sudoku. Les exécutables
  compilés localement dans `build` ne sont pas publiés.

Les éventuels liens symboliques historiques présents dans certains sous-dossiers ne sont plus requis au fonctionnement du paquet partagé.

## Diagnostic et reproduction

- Ouvrir `http://127.0.0.1:PORT/tests/index.html` depuis le serveur local pour contrôler toutes les pages, leurs scripts et les invariants des principaux moteurs. Le passage complet peut durer quelques minutes, notamment pour Rhythm Lab et les générateurs certifiés.
- Le bouton **Campagne générateurs** du diagnostic répète Sudoku, Sudoku combiné, Nonogram, Mahjong et Klondike avec plusieurs graines reproductibles.
- Ajouter `?seed=ma-graine` à l’adresse d’un jeu pour rendre les appels à `Math.random()` reproductibles pendant cette session.
- Le runtime commun `shared/game-runtime.js` fournit aussi un historique annuler/rétablir, un stockage versionné et un exécuteur Web Worker pour les solveurs et bots lourds.
- Le hub mémorise automatiquement la dernière route visitée, y compris sa variante, et propose de reprendre directement cette partie.
- Les records et statistiques sont séparés selon les paramètres influençant la partie. Une défaite compte comme partie terminée mais ne remplace jamais un meilleur record.
