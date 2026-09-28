# Kilomètres réels

Trouvez l'établissement de santé ou gériatrique le plus proche d'une adresse, classé par kilomètres et temps de trajet réels par la route.

Site : https://alexandrecavaillon-afk.github.io/kilometres-reels/

## Utilisation

1. Tapez une adresse de départ (des suggestions s'affichent), ou cliquez sur « Ma position ».
2. Choisissez un type d'établissement.
3. Les plus proches s'affichent sur la carte et dans la liste. Cliquez sur l'un d'eux pour voir le trajet, l'ouvrir dans Plans ou Google Maps, ou appeler.

Pour un simple trajet : onglet « Trajet de A à B », saisissez deux adresses ou deux codes postaux. Le site donne les kilomètres et le temps de l'itinéraire le plus rapide, le tracé sur la carte et l'itinéraire détaillé. Pour un code postal seul, le site prend la plus grande commune de ce code et part de son centre.

Pays des adresses : le bouton « Adresses en … » (sous les onglets, et dans le panneau de résultats) permet de chercher les adresses dans un pays, plusieurs, ou le monde entier. La France utilise la Géoplateforme IGN, les autres pays OpenStreetMap (Photon pour les suggestions, Nominatim pour la recherche). Le choix est mémorisé dans votre navigateur.

Pour plusieurs adresses de départ : « Plusieurs départs depuis Excel », puis déposez un fichier .xlsx ou .csv (ou collez des cellules copiées depuis Excel dans la barre de recherche). Indiquez les colonnes du nom et de l'adresse, choisissez le type d'établissement : vous obtenez les 1, 3, 5 ou 10 plus proches de chaque départ, et un fichier Excel filtrable.

## Vérification des affectations

Onglet « Vérification » : importez un fichier avec une ligne par établissement, la localisation de l'établissement (code postal ou adresse) et celle du médecin qui le suit, et si vous les avez, la distance et le temps déclarés, le statut, les noms. Le site :

- recalcule chaque trajet (itinéraire le plus rapide, sans trafic) et classe les lignes en conformes, en écart (au-delà de 15 % ou 5 km, et 20 % ou 8 min, réglables) ou non vérifiables (code postal introuvable, par exemple un CEDEX, ou deux codes de la même ville) ;
- trouve le médecin le plus proche de chaque établissement ;
- propose une répartition qui réduit au minimum le temps (ou la distance) total, en gardant le même nombre d'établissements par médecin, ou au plus N ;
- affiche la carte (médecins en bleu, établissements en rouge) et, pour chaque médecin, ses établissements et les plus proches de lui ;
- produit un rapport Excel en trois onglets : Vérification, Propositions, Médecins.

Sans colonne de nom, un code postal de médecin correspond à un médecin.

## Types d'établissements

- Personnes âgées : EHPAD, soins de longue durée (USLD), résidences autonomie et EHPA, accueil de jour, soins infirmiers à domicile (SSIAD, SAAS), aide à domicile.
- Hôpitaux et cliniques : CHU et CHR, centres hospitaliers, cliniques, soins de suite et réadaptation, psychiatrie, hospitalisation à domicile, dialyse, centres de lutte contre le cancer.
- Soins de ville : centres de santé, maisons de santé, laboratoires, soins non programmés.

## D'où viennent les données

- France (outre-mer compris) : fichier FINESS des établissements géolocalisés, publié par le ministère de la Santé sur data.gouv.fr. Les noms de communes viennent de l'API Découpage administratif.
- Pays frontaliers (Belgique, Luxembourg, Allemagne, Suisse, Italie, Monaco, Andorre, Espagne) : OpenStreetMap, pour les établissements situés à moins de 60 km de la frontière. Ces données sont plus inégales que FINESS : adresses parfois incomplètes.

La base se met à jour seule le 3 de chaque mois (onglet Actions du dépôt, « Mettre à jour la base des établissements »). On peut aussi la relancer à la main avec le bouton « Run workflow ».

## Ce qui est envoyé, et à qui

| Donnée | Envoyée à | Pourquoi |
|---|---|---|
| Le texte des adresses saisies | Géoplateforme IGN (data.geopf.fr) pour la France ; OpenStreetMap Photon (photon.komoot.io) et Nominatim pour les autres pays | Trouver leurs coordonnées |
| Les coordonnées GPS | Serveur OSRM public (router.project-osrm.org, ou routing.openstreetmap.de en secours) | Calculer kilomètres et temps de trajet |
| La zone affichée | tile.openstreetmap.org | Afficher le fond de carte |

Les fichiers Excel importés sont lus dans le navigateur et ne sont envoyés nulle part. Aucun compte, cookie ni statistique de visite. Les liens Plans et Google Maps ne transmettent des coordonnées qu'au clic.

## Limites

- Les kilomètres sont ceux de l'itinéraire le plus rapide, sans trafic.
- Le site présélectionne les 99 établissements les plus proches à vol d'oiseau, puis les classe par la route : un établissement plus lointain à vol d'oiseau mais plus rapide par la route peut, rarement, être manqué.
- Les serveurs d'itinéraires publics sont gratuits et partagés ; le site espace ses demandes d'une seconde. Un fichier de 200 départs prend environ 4 minutes.

## Organisation du dépôt

- `index.html` : le site, produit par `python build/assembler_page.py` à partir du dossier `src/`.
- `build/construire_base.py` : construit la base dans `data/` (lancé par GitHub Actions).
- `data/` : la base, un fichier par type d'établissement.
