# Import de partitions pour le karaoké

## Formats utiles

- **MuseScore (`.mscz` / `.mscx`)** : contient les portées, notes, durées, paroles attachées aux notes, nuances et changements de tempo.
- **MusicXML (`.musicxml`, `.xml`, `.mxl`)** : format d’échange adapté à l’association voix, hauteur, durée, liaison et syllabe.
- **MIDI karaoké (`.kar`, `.mid`)** : MIDI accompagné d’événements texte synchronisés ; la qualité des paroles dépend du fichier.
- **LRC** : paroles horodatées, généralement sans hauteur musicale.
- **MP3+CDG** : piste audio accompagnée de graphismes et paroles synchronisés, mais sans partition exploitable directement pour noter la justesse.
- **UltraStar (`.txt`)** : paroles, hauteurs et temps dans un format textuel orienté jeu de chant.

## Architecture prévue

1. Extraire le parseur MuseScore/MusicXML déjà utilisé par Rhythm Lab dans un module partagé.
2. Produire une chronologie commune par voix : début, durée, hauteur réelle/écrite, syllabe, liaison, nuance et tempo.
3. Permettre de choisir une portée et une voix lorsqu’une partition en contient plusieurs.
4. Fusionner les syllabes liées et prolonger leur objectif sur les notes tenues ou liées.
5. Convertir les nuances et crescendos en plage de volume cible plutôt qu’en volume absolu.
6. Comparer le microphone à la hauteur, la durée et l’intensité attendues après calibration de latence.
7. Réutiliser ultérieurement cette chronologie avec une piste audio ou des stems séparés localement.

Les paroles MuseScore sont attachées aux notes. Elles peuvent donc être synchronisées précisément avec la hauteur et la durée de la voix, à condition de conserver les reprises, changements de tempo, liaisons et silences lors du déroulage de la partition.
