# À faire plus tard

## Espace disque (hébergement 1 Go)
- Limites actuelles : 600 Mo pour tout le site, 400 Mo par personne, 300 Mo par fichier
  (variables `STORAGE_TOTAL_MB`, `MEDIA_QUOTA_MB`, `MAX_UPLOAD_MB`). À ajuster à l'usage.
- Si ça ne suffit pas : stocker les médias sur **Cloudflare R2** (10 Go gratuits, sortie gratuite,
  compatible S3, liens signés lisibles par Meta/Threads). Plan B : Backblaze B2 (10 Go gratuits).

## Sécurité
- Revue : étapes 7 (dépendances), 8 (hébergement).
- À la fin : passer le repo en privé + clé de déploiement SSH (adapter `remoteOk` à l'URL SSH GitHub).
