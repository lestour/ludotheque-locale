# Composants tiers

Ce projet distribue les composants tiers suivants. Leurs licences restent
applicables indépendamment de la licence MIT choisie pour le code original de
la ludothèque.

## MuseScore General HQ SoundFont

- Fichier : `games/rhythm/assets/MS-Basic.sf3`
- Empreinte SHA-256 : `5ea2375e8bd7d8e71def1036978c1621e85b66934169b6a2744b27b9b3c2d99c`
- Identification interne : `MuseScore_General_HQ v0.2`.
- Origine locale : ressource distribuée sous le nom MS Basic avec MuseScore 4
  pour macOS.
- Licence et attributions : `games/rhythm/assets/MS-Basic-LICENSE.md`.
- Référence officielle de licence :
  <https://musescore.org/fr/manuel/soundfonts-et-fichiers-sfz>.

Le nom public MS Basic utilisé par MuseScore 4 diffère du nom interne conservé
dans la banque. Le manuel MuseScore indique que `MuseScore_General_HQ v0.2`
est publié sous licence MIT avec l'autorisation de S. Christian Collins. Le
fichier d'attributions livré avec la ressource conserve historiquement le nom
`MuseScore_General.sf2` ; son texte original est préservé avec une note
d'identification.

## SpessaSynth

- `vendor/spessasynth_core` 4.3.17 : Apache License 2.0, source
  <https://github.com/spessasus/spessasynth_core>, licence dans
  `vendor/spessasynth_core/LICENSE`.
- `vendor/spessasynth_lib` 4.3.13 : Apache License 2.0, source
  <https://github.com/spessasus/spessasynth_lib>, licence dans
  `vendor/spessasynth_lib/LICENSE`.
- `vendor/stb-vorbis` 0.0.5 : Apache License 2.0, source
  <https://github.com/spessasus/stb-vorbis>, licence dans
  `vendor/stb-vorbis/LICENSE`.

Modifications locales : les spécificateurs d'import de
`vendor/spessasynth_lib/dist/index.js` et
`vendor/spessasynth_core/dist/index.js` ont été remplacés par des chemins
relatifs afin de permettre une distribution locale sans registre de modules.
Le processeur AudioWorklet est distribué sans modification fonctionnelle.

## Marques

MuseScore est une marque de son titulaire. Sa mention dans Rhythm Lab décrit uniquement la compatibilité avec les fichiers MuseScore et l’origine de la SoundFont. Elle n’implique aucune affiliation ni validation du projet.

Les noms propres conservés dans ce document et dans les chemins des composants
tiers servent uniquement à l'identification, à l'interopérabilité et au respect
des licences. Les modules originaux de la ludothèque emploient des noms publics
et techniques génériques et ne supposent aucune affiliation.
