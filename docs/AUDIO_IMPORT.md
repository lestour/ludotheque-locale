# Import audio et séparation locale

`Audio Lab` accepte les fichiers MP3, MP4, FLAC, WAV et MIDI sans les envoyer sur Internet.

- Le navigateur utilise Web Audio pour décoder les codecs qu’il prend en charge et afficher une forme d’onde.
- Un fichier MIDI est analysé piste par piste : il contient des événements musicaux, pas un signal acoustique à séparer.
- Une piste audio mixée nécessite un modèle de séparation. Le script facultatif `tools/separate_audio.py` appelle Demucs localement et FFmpeg pour les conteneurs vidéo lorsque nécessaire.

## Installation facultative

Utilisez de préférence un environnement Python séparé :

```sh
python3 -m venv .audio-tools
source .audio-tools/bin/activate
python3 -m pip install demucs
```

FFmpeg doit être installé séparément pour MP4/MOV. Aucune commande n’est exécutée par le serveur LAN et aucun chemin fourni par un autre ordinateur n’est accepté : la séparation reste une action locale explicite.

## Exemples

```sh
python3 tools/separate_audio.py morceau.mp3
python3 tools/separate_audio.py morceau.wav --two-stems vocals
python3 tools/separate_audio.py concert.mp4 --model htdemucs_6s
```

Les sorties sont créées sous `separated/`, dossier ignoré lors de la publication.
