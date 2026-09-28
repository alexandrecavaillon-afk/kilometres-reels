# Kilomètres réels

Un site d'une seule page qui classe des adresses selon la distance par la route et le temps de trajet depuis un point de départ, et calcule une tournée optimisée. Pas de compte, pas de serveur, pas de cookie.

## Mettre le site en ligne sur GitHub Pages

1. Créez un dépôt sur GitHub (par exemple `kilometres-reels`).
2. Déposez le fichier `index.html` à la racine du dépôt (bouton « Add file » puis « Upload files »).
3. Allez dans Settings, puis Pages. Dans « Build and deployment », choisissez « Deploy from a branch », branche `main`, dossier `/ (root)`, puis Save.
4. Après une ou deux minutes, le site est disponible à l'adresse `https://votre-nom.github.io/kilometres-reels/`.

Sur un compte GitHub gratuit, le dépôt doit être public : le code est visible, mais il ne contient aucune donnée. Vos adresses ne sont jamais écrites dans le dépôt.

Vous pouvez aussi simplement ouvrir `index.html` en double-cliquant dessus, sans rien mettre en ligne.

## Utilisation

- Point de départ : une adresse, ou des coordonnées au format `48.8704, 2.3167`.
- Adresses : une par ligne. Pour donner un nom, écrivez `Nom ; adresse`. Un fichier CSV exporté d'Excel (séparateur point-virgule, première colonne = nom) peut être importé directement.
- Jusqu'à 500 adresses par calcul. Les tournées vont jusqu'à 99 arrêts.
- Onglet « Plus courts » : classement par kilomètres. « Plus rapides » : par temps. « Tournée » : ordre de passage optimisé parmi les N adresses les plus proches.
- Cliquez sur une ligne pour voir le tracé sur la carte et l'itinéraire détaillé.
- Les exports CSV s'ouvrent directement dans Excel.

## Ce qui est envoyé, et à qui

| Donnée | Envoyée à | Pourquoi |
|---|---|---|
| Le texte de chaque adresse | Géoplateforme IGN (data.geopf.fr) ou OpenStreetMap Nominatim, selon le réglage | Trouver ses coordonnées GPS |
| Les coordonnées GPS | Le serveur OSRM choisi | Calculer les kilomètres et temps de trajet |
| La zone affichée sur la carte | tile.openstreetmap.org | Afficher le fond de carte |

Rien d'autre. La page contient une règle de sécurité (Content-Security-Policy) qui interdit au navigateur de contacter tout autre site. Les noms que vous donnez aux adresses (avant le point-virgule) ne sont jamais envoyés. Le lien « Comparer sur Google Maps » n'envoie des coordonnées à Google que si vous cliquez dessus.

## Pour que rien ne quitte votre ordinateur

Installez votre propre serveur de calcul d'itinéraires avec Docker. Exemple pour l'Île-de-France (la France entière demande plus de 16 Go de mémoire) :

```
wget https://download.geofabrik.de/europe/france/ile-de-france-latest.osm.pbf
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-extract -p /opt/car.lua /data/ile-de-france-latest.osm.pbf
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-partition /data/ile-de-france-latest.osrm
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-customize /data/ile-de-france-latest.osrm
docker run -t -p 5000:5000 -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-routed --algorithm mld --max-table-size 1000 /data/ile-de-france-latest.osrm
```

Dans les réglages du site, choisissez « Mon propre serveur OSRM » et laissez `http://localhost:5000`. Si vous saisissez vos adresses sous forme de coordonnées GPS, plus aucune donnée ne sort de votre machine (hors fond de carte).

Pour utiliser un autre serveur que ceux prévus, ajoutez son adresse dans la ligne `connect-src` de la balise `Content-Security-Policy`, en haut de `index.html`.

## Limites à connaître

- Les kilomètres sont ceux de l'itinéraire le plus rapide, comme un GPS ou Mappy par défaut, calculés sur les données OpenStreetMap. Les temps sont sans trafic : prévoyez une marge aux heures de pointe.
- Les serveurs OSRM publics sont gratuits et partagés, sans garantie de disponibilité. Le site espace ses demandes d'une seconde pour les respecter. Pour un usage quotidien intensif, un serveur personnel est préférable.
- Vérifiez les adresses marquées « À vérifier » : la position trouvée peut être approximative.
- La tournée est optimisée par une méthode heuristique : très proche de l'optimum pour quelques dizaines d'arrêts, sans garantie mathématique d'être la meilleure possible.
