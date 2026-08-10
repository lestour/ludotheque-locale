# Ludothèque locale

Le point d’entrée est `index.html` à la racine.

## Lancement multiplateforme

- macOS : double-cliquer sur `Lancer le Hub.command` ; le navigateur par défaut est utilisé. Garder la fenêtre Terminal du serveur ouverte pendant la partie.
- Windows : double-cliquer sur `Lancer le Hub Windows.bat` ; Python est utilisé s’il est installé, sinon le serveur PowerShell inclus prend le relais.
- Linux : lancer `sh "Lancer le Hub Linux.sh"` et garder ce terminal ouvert pendant la partie.

Un petit serveur HTTP local est nécessaire pour les modules audio, les AudioWorklets et le chargement de `games/rhythm/assets/MS-Basic.sf3`. Il ne faut pas ouvrir directement `index.html` avec une adresse `file://`. Les lanceurs cherchent Python 3, puis une solution locale de repli selon le système.

Pour partager l’application, compresser le dossier complet sous le nom `Ludotheque-locale`, sans retirer `vendor`, `games/rhythm/assets/MS-Basic.sf3` ni les quatre fichiers `Lancer le Hub…`. L’application ne dépend plus des liens symboliques pour charger ses scripts partagés.

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
