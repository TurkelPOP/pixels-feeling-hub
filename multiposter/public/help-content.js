// Contenu de l'aide de PTZ Posting : une seule source, utilisée par le volet d'aide de l'app,
// la page de connexion, la page /aide et les cartes de connexion des réseaux.
// Contenu statique écrit ici (jamais de données venant d'un utilisateur ou d'une API).
// {{origin}} est remplacé par l'adresse du site (ex. https://ptzcorp.alwaysdata.net).
(() => {
  const OWNER = '<span class="tag">Propriétaire</span>';
  const cb = (id) => `<code class="cb">{{origin}}/oauth/${id}/callback</code>`;

  /** Tutos par réseau : `user` = connecter son compte (tout le monde), `owner` = activer le réseau (une fois). */
  const networks = {
    canva: {
      title: "Canva",
      user: `
<ol class="steps">
  <li>Onglet <strong>Comptes</strong>, carte <strong>Canva</strong> : clique sur <strong>« Connecter Canva »</strong>.</li>
  <li>Canva s'ouvre : connecte-toi au compte Canva qui contient tes designs (avec Google si c'est comme ça que tu te connectes d'habitude).</li>
  <li>Canva demande si tu autorises « PTZ Posting » à <strong>lire</strong> tes designs : clique sur <strong>Autoriser</strong>.</li>
  <li>Tu reviens dans PTZ Posting : la carte affiche « Connecté : ton nom ».</li>
</ol>
<p class="tip">L'app peut seulement <strong>voir et exporter</strong> tes designs. Elle ne peut ni les modifier ni les supprimer.</p>
<p class="warn">Canva répond « app non disponible » ou « accès refusé » ? Tant que l'intégration n'est pas publiée, seules les personnes ajoutées par le propriétaire peuvent se connecter : demande-lui de t'ajouter (voir la partie « Activer »).</p>`,
      owner: `
<ol class="steps">
  <li>Va sur <a href="https://www.canva.com/developers/integrations" target="_blank" rel="noopener">canva.com/developers</a> et connecte-toi avec ton compte Canva. Canva exige la <strong>double authentification</strong> sur ton compte : s'il te renvoie en boucle vers la connexion, active-la dans Canva → Paramètres → Connexion et sécurité, puis recommence.</li>
  <li><strong>Your integrations</strong> → <strong>Create an integration</strong>. Choisis <strong>Private</strong> (réservée à ton équipe) si on te le propose, sinon <strong>Public</strong> : tant que tu ne la soumets pas à Canva, elle reste privée. Nom : <em>PTZ Posting</em>.</li>
  <li>Menu <strong>Scopes</strong> : coche en lecture (<em>Read</em>) <code>design:meta</code>, <code>design:content</code> et <code>profile</code>. Rien d'autre.</li>
  <li>Menu <strong>Authentication</strong> → <strong>Add redirect URL</strong> : colle ${cb("canva")}, puis enregistre.</li>
  <li>Menu <strong>Configuration</strong> (ou <em>Credentials</em>) : copie le <strong>Client ID</strong>, puis clique sur <strong>Generate secret</strong> et copie le <strong>Client secret</strong> (il ne s'affiche qu'une fois).</li>
  <li>Reviens dans PTZ Posting, carte Canva → <strong>« Activer ce réseau »</strong> : colle les deux, <strong>Enregistrer</strong>. Le bouton « Connecter Canva » apparaît.</li>
</ol>
<p class="tip">Pour que papa_subway (ou une autre personne) puisse se connecter avant toute publication de l'intégration, elle doit faire partie de ton <strong>équipe Canva</strong>, ou être ajoutée comme collaborateur de l'intégration.</p>`,
    },

    meta: {
      title: "Facebook + Instagram",
      user: `
<p><strong>Avant de commencer</strong>, vérifie deux choses (5 minutes, une seule fois) :</p>
<ul>
  <li>Tu publies sur une <strong>Page Facebook</strong> (pas sur un profil perso) dont tu es <strong>administrateur</strong>.</li>
  <li>Ton Instagram est un compte <strong>professionnel</strong> (Créateur ou Entreprise) <strong>relié à cette Page</strong>. Dans l'appli Instagram : Paramètres → <em>Type de compte et outils</em> → <em>Passer à un compte professionnel</em>. Puis sur Facebook, dans ta Page : Paramètres → <em>Comptes liés</em> → <em>Instagram</em> → Connecter.</li>
</ul>
<ol class="steps">
  <li>Onglet <strong>Comptes</strong>, carte <strong>Facebook / Instagram</strong> : clique sur <strong>« Connecter Facebook + Instagram »</strong>. Un seul bouton pour les deux.</li>
  <li>Facebook s'ouvre : connecte-toi, puis clique sur <strong>« Continuer en tant que … »</strong>.</li>
  <li>Facebook demande <strong>quelles Pages</strong> autoriser : choisis <strong>« Toutes les Pages actuelles et futures »</strong> ou coche tes Pages, puis <strong>Continuer</strong>.</li>
  <li>Même chose pour <strong>les comptes Instagram</strong> : coche-les tous, <strong>Continuer</strong>.</li>
  <li>Laisse <strong>toutes les autorisations activées</strong> (publier, lire la Page…) et clique sur <strong>Enregistrer</strong>. Si tu en décoches une, la publication échouera.</li>
  <li>Tu reviens dans PTZ Posting : ta Page et ton Instagram apparaissent dans « Comptes connectés ».</li>
</ol>
<p class="tip">Ton Instagram n'apparaît pas ? Il n'est pas professionnel ou pas relié à la Page. Corrige-le (voir plus haut), puis reclique sur « Connecter ».</p>
<p class="warn">« Fonctionnalité non disponible », « app en développement » ? Tant que Meta n'a pas validé l'app, seules les personnes ajoutées comme <strong>testeurs</strong> peuvent se connecter. Demande au propriétaire de t'ajouter, puis accepte l'invitation sur <a href="https://developers.facebook.com/requests" target="_blank" rel="noopener">developers.facebook.com/requests</a>.</p>`,
      owner: `
<ol class="steps">
  <li>Va sur <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener">developers.facebook.com/apps</a> avec ton compte Facebook. La première fois, Meta te fait créer un compte développeur (gratuit, avec ton numéro de téléphone).</li>
  <li><strong>Créer une app</strong>. Nom : <em>PTZ Posting</em>, ton e-mail. Cas d'utilisation : choisis <strong>« Autre »</strong>, puis le type <strong>« Entreprise »</strong> (Business). Relie ton portefeuille business si Meta le propose (facultatif).</li>
  <li>Dans le tableau de bord de l'app, <strong>Ajouter un produit</strong> → <strong>Facebook Login for Business</strong> → Configurer. Dans ses <strong>Paramètres</strong>, champ <strong>« URI de redirection OAuth valides »</strong> : colle ${cb("meta")}, puis <strong>Enregistrer les modifications</strong>.</li>
  <li>Ajoute aussi le produit <strong>Instagram</strong> (API Instagram avec Facebook Login), pour la publication sur Instagram.</li>
  <li><strong>Paramètres de l'app → Général</strong> : dans <em>Domaines de l'app</em>, mets <code>{{host}}</code>. Dans <em>URL de la politique de confidentialité</em>, mets <code>{{origin}}/confidentialite</code>, et dans <em>Conditions d'utilisation</em>, <code>{{origin}}/conditions</code>. Enregistre.</li>
  <li>Toujours dans <strong>Général</strong> : copie l'<strong>ID de l'app</strong>, clique sur <strong>Afficher</strong> à côté de <strong>Clé secrète</strong> (Meta redemande ton mot de passe) et copie-la.</li>
  <li>Dans PTZ Posting, carte Facebook / Instagram → <strong>« Activer ce réseau »</strong> : colle les deux, <strong>Enregistrer</strong>.</li>
  <li><strong>Les autres personnes</strong> : <em>Rôles de l'app → Rôles → Ajouter des personnes → Testeur</em>, avec leur nom ou e-mail Facebook. Elles doivent accepter sur <a href="https://developers.facebook.com/requests" target="_blank" rel="noopener">developers.facebook.com/requests</a>. Toi, en tant qu'administrateur de l'app, tu peux te connecter tout de suite.</li>
</ol>
<p class="tip">Tant que l'app est « en développement », tout fonctionne pour toi et tes testeurs : c'est suffisant pour vous deux. La validation par Meta (« App Review ») n'est utile que pour ouvrir l'app à d'autres personnes.</p>
<h3>Les autorisations demandées par PTZ Posting</h3>
<p>Elles doivent toutes être disponibles dans ton app Meta (menu <em>Cas d'utilisation → Personnaliser → Autorisations</em>, ou <em>Examen de l'app → Autorisations et fonctionnalités</em>). En mode développement, l'« accès standard » suffit, sans validation de Meta :</p>
<ul>
  <li><strong>Publier</strong> : <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>pages_manage_posts</code>, <code>business_management</code>, <code>instagram_basic</code>, <code>instagram_content_publish</code>.</li>
  <li><strong>Premier commentaire</strong> : <code>instagram_manage_comments</code>, <code>pages_manage_engagement</code>.</li>
  <li><strong>Statistiques</strong> : <code>instagram_manage_insights</code>, <code>read_insights</code>.</li>
</ul>
<p class="warn">Message « Invalid Scopes » (ou « autorisation non valide ») à la connexion : une de ces autorisations manque dans l'app Meta. Ajoute-la, puis reclique sur « Connecter ».</p>
<p class="tip">Après un ajout d'autorisations (nouvelle version de PTZ Posting), chacun doit <strong>recliquer une fois sur « Connecter Facebook + Instagram »</strong> et accepter les nouvelles cases. Sans ça, la publication continue de marcher, seuls le premier commentaire et les statistiques ne fonctionnent pas.</p>`,
    },

    threads: {
      title: "Threads",
      user: `
<p>Il faut un profil Threads (créé avec ton compte Instagram).</p>
<ol class="steps">
  <li>Onglet <strong>Comptes</strong>, carte <strong>Threads</strong> : clique sur <strong>« Connecter Threads »</strong>.</li>
  <li>Threads s'ouvre : connecte-toi avec ton compte Instagram/Threads.</li>
  <li>Clique sur <strong>Autoriser</strong> pour laisser PTZ Posting publier pour toi.</li>
  <li>Tu reviens dans PTZ Posting : ton profil Threads apparaît dans « Comptes connectés ».</li>
</ol>
<p class="tip">L'accès dure 60 jours et se renouvelle tout seul tant que l'app tourne. Si le propriétaire a ajouté des autorisations (réponse automatique, statistiques), reclique une fois sur « Connecter Threads ».</p>
<p class="warn">« Utilisateur non autorisé » ? Tant que l'app n'est pas validée par Meta, il faut être <strong>testeur Threads</strong> : demande au propriétaire de t'ajouter, puis accepte dans l'appli Threads → Paramètres → <em>Compte</em> → <em>Autorisations du site web</em> → <em>Invitations</em>.</p>`,
      owner: `
<p>Threads se règle <strong>dans la même app Meta</strong> que Facebook/Instagram, mais a <strong>ses propres clés</strong>.</p>
<ol class="steps">
  <li>Sur <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener">developers.facebook.com/apps</a>, ouvre ton app (ou crée-en une avec le cas d'utilisation <strong>« Accéder à l'API Threads »</strong>).</li>
  <li><strong>Cas d'utilisation</strong> → <strong>Accéder à l'API Threads</strong> → <strong>Personnaliser</strong>. Dans <em>Autorisations</em>, ajoute <code>threads_basic</code>, <code>threads_content_publish</code>, <code>threads_manage_replies</code> (réponse automatique sous le post) et <code>threads_manage_insights</code> (statistiques).</li>
  <li>Dans <em>Paramètres</em> de ce cas d'utilisation : <strong>URL de rappel de redirection</strong> = ${cb("threads")}. Remplis aussi <em>Désinstaller</em> et <em>Supprimer</em> avec la même adresse. Enregistre.</li>
  <li>Toujours dans ces paramètres, copie l'<strong>ID de l'app Threads</strong> et la <strong>clé secrète de l'app Threads</strong> (différents de ceux de Facebook !).</li>
  <li>Dans PTZ Posting, carte Threads → <strong>« Activer ce réseau »</strong> : colle les deux, <strong>Enregistrer</strong>.</li>
  <li><strong>Testeurs</strong> (toi compris) : <em>Rôles de l'app → Rôles → Ajouter des personnes → Testeur Threads</em>, avec le nom d'utilisateur Threads. Chacun accepte dans l'appli Threads → Paramètres → Compte → <em>Autorisations du site web</em> → <em>Invitations</em>.</li>
</ol>`,
    },

    google: {
      title: "YouTube",
      user: `
<ol class="steps">
  <li>Onglet <strong>Comptes</strong>, carte <strong>YouTube</strong> : clique sur <strong>« Connecter YouTube »</strong>.</li>
  <li>Choisis le <strong>compte Google qui possède la chaîne</strong>. Si ta chaîne est un « compte de marque », Google te demandera ensuite de choisir la chaîne : prends la bonne.</li>
  <li>Écran « <strong>Google n'a pas validé cette application</strong> » : c'est normal. Clique sur <strong>Paramètres avancés</strong> (ou <em>Avancé</em>) puis <strong>Accéder à PTZ Posting (non sécurisé)</strong>. L'app est la vôtre, pas une app inconnue.</li>
  <li><strong>Coche toutes les cases</strong> d'autorisation (gérer tes vidéos YouTube…) puis <strong>Continuer</strong>.</li>
  <li>Tu reviens dans PTZ Posting : ta chaîne apparaît dans « Comptes connectés ».</li>
</ol>
<p class="warn">Tant que Google n'a pas audité l'app, YouTube publie les vidéos <strong>en privé</strong> : tu les passes en public dans YouTube Studio. « Accès bloqué : l'app n'a pas terminé la validation » ? Demande au propriétaire de t'ajouter comme <strong>utilisateur test</strong>.</p>`,
      owner: `
<ol class="steps">
  <li>Va sur <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">console.cloud.google.com</a> avec ton compte Google, et crée un <strong>projet</strong> (en haut à gauche → Nouveau projet → <em>PTZ Posting</em>). C'est gratuit, aucune carte bancaire nécessaire.</li>
  <li>Menu <strong>API et services → Bibliothèque</strong> : cherche <strong>YouTube Data API v3</strong> → <strong>Activer</strong>.</li>
  <li>Menu <strong>Google Auth Platform</strong> (ou <em>Écran de consentement OAuth</em>) → <strong>Commencer</strong> : nom <em>PTZ Posting</em>, ton e-mail d'assistance, audience <strong>Externe</strong>, ton e-mail de contact, accepte, <strong>Créer</strong>.</li>
  <li><strong>Accès aux données</strong> → <em>Ajouter ou supprimer des niveaux d'accès</em> : coche <code>…/auth/youtube.upload</code> et <code>…/auth/youtube.readonly</code> (tape « youtube » dans le filtre), <strong>Mettre à jour</strong>, puis <strong>Enregistrer</strong>.</li>
  <li><strong>Audience</strong> → <em>Utilisateurs test</em> → <strong>Ajouter des utilisateurs</strong> : ton adresse Google et celles des autres personnes (celle de la chaîne de chacun).</li>
  <li><strong>Clients</strong> → <strong>Créer un client</strong> : type <strong>Application Web</strong>, nom <em>PTZ Posting</em>. Dans <em>URI de redirection autorisés</em>, <strong>Ajouter un URI</strong> : ${cb("google")}. <strong>Créer</strong>.</li>
  <li>Google affiche l'<strong>ID client</strong> et le <strong>code secret du client</strong> : copie les deux <strong>tout de suite</strong> (le secret ne sera plus réaffiché ; sinon, crée-en un nouveau dans le client).</li>
  <li>Dans PTZ Posting, carte YouTube → <strong>« Activer ce réseau »</strong> : colle les deux, <strong>Enregistrer</strong>.</li>
</ol>
<p class="warn"><strong>Important :</strong> en mode « Test », Google déconnecte les comptes au bout de <strong>7 jours</strong>. Pour éviter de reconnecter chaque semaine : <em>Audience</em> → <strong>Publier l'application</strong> (« En production »). Pas besoin de la faire valider : vous verrez juste l'écran « app non validée » à la connexion, et vous serez limités à 100 personnes, largement assez.</p>`,
    },

    tiktok: {
      title: "TikTok",
      user: `
<ol class="steps">
  <li>Onglet <strong>Comptes</strong>, carte <strong>TikTok</strong> : clique sur <strong>« Connecter TikTok »</strong>.</li>
  <li>TikTok s'ouvre : connecte-toi (sur téléphone, l'appli TikTok peut s'ouvrir pour confirmer).</li>
  <li>Clique sur <strong>Autoriser</strong> : PTZ Posting pourra voir ton nom et publier des vidéos.</li>
  <li>Tu reviens dans PTZ Posting : ton compte TikTok apparaît dans « Comptes connectés ».</li>
</ol>
<p class="tip">TikTok n'accepte que des <strong>vidéos</strong> (MP4 de préférence).</p>
<p class="warn">Tant que TikTok n'a pas audité l'app, les vidéos sont publiées en <strong>« Moi uniquement »</strong> (privé), et ton compte TikTok doit être en <strong>compte privé</strong> pendant ce temps. Tu changes ensuite la visibilité dans l'appli. « Client non autorisé » ? Demande au propriétaire de t'ajouter comme utilisateur cible de la sandbox.</p>`,
      owner: `
<ol class="steps">
  <li>Va sur <a href="https://developers.tiktok.com/" target="_blank" rel="noopener">developers.tiktok.com</a> → <strong>Log in</strong> avec ton compte TikTok, puis accepte les conditions développeur.</li>
  <li><strong>Manage apps</strong> → <strong>Connect an app</strong> (créer une app). Type : <em>Individual</em> ou ton organisation. Nom : <em>PTZ Posting</em>.</li>
  <li>Fiche de l'app : ajoute une <strong>icône</strong> (le logo PTZ Corp, 1024 × 1024), une catégorie, une courte description, et ces liens : <em>Terms of Service URL</em> = <code>{{origin}}/conditions</code>, <em>Privacy Policy URL</em> = <code>{{origin}}/confidentialite</code>. Plateforme : <strong>Web</strong>, adresse <code>{{origin}}</code>.</li>
  <li><strong>Add products</strong> : ajoute <strong>Login Kit</strong> et <strong>Content Posting API</strong>. Dans Content Posting API, active <strong>Direct Post</strong>.</li>
  <li><strong>Login Kit</strong> → <em>Redirect URI</em> (Web) : colle ${cb("tiktok")}.</li>
  <li><strong>Scopes</strong> : vérifie que <code>user.info.basic</code>, <code>video.publish</code> et <code>video.list</code> (statistiques) sont présents. Après l'ajout de <code>video.list</code>, reconnecte TikTok une fois.</li>
  <li>En haut de la page, bascule sur <strong>Sandbox</strong> → <em>Create Sandbox</em>, refais les étapes 4 à 6 dans la sandbox, puis <strong>Target users</strong> → ajoute ton compte TikTok et ceux des autres personnes. La sandbox fonctionne tout de suite, sans validation.</li>
  <li>En haut de la page (sandbox ou production), copie le <strong>Client key</strong> et le <strong>Client secret</strong>.</li>
  <li>Dans PTZ Posting, carte TikTok → <strong>« Activer ce réseau »</strong> : colle les deux, <strong>Enregistrer</strong>.</li>
</ol>
<p class="tip">Plus tard, pour publier en public directement : <em>Submit for review</em> en production (TikTok vérifie l'app, avec une courte vidéo de démonstration), puis remplace les clés sandbox par celles de production.</p>`,
    },

    gdrive: {
      title: "Google Drive",
      user: `
<h3>Le plus simple : coller un lien (rien à connecter)</h3>
<ol class="steps">
  <li>Dans Google Drive (appli ou site), sur le fichier : <strong>⋮</strong> → <strong>Partager</strong> → accès général « <strong>Tous les utilisateurs disposant du lien</strong> », puis <strong>Copier le lien</strong>.</li>
  <li>Dans PTZ Posting, <strong>Nouveau post</strong> → <strong>« Importer depuis Google Drive »</strong> → colle le lien → <strong>Importer</strong>.</li>
</ol>
<p class="tip">Sur téléphone, « Choisir dans ma galerie » donne aussi accès à Google Drive : sur Android dans le menu du sélecteur, sur iPhone via « Choisir un fichier » → Google Drive (appli Drive installée).</p>
<h3>Pour parcourir tes dossiers : connecter ton Drive</h3>
<ol class="steps">
  <li>Onglet <strong>Comptes</strong>, carte <strong>Google Drive</strong> : clique sur <strong>« Connecter Google Drive »</strong>.</li>
  <li>Choisis le <strong>compte Google</strong> qui contient tes photos et vidéos.</li>
  <li>Écran « <strong>Google n'a pas validé cette application</strong> » : normal. <strong>Paramètres avancés</strong> → <strong>Accéder à PTZ Posting</strong>.</li>
  <li><strong>Coche la case</strong> « Afficher et télécharger tous les fichiers de Google Drive » puis <strong>Continuer</strong>. C'est une lecture seule : l'app ne peut rien modifier ni supprimer dans ton Drive.</li>
  <li>Tu reviens dans PTZ Posting : la carte affiche « Connecté » avec ton adresse.</li>
</ol>
<h3>Importer depuis le Drive</h3>
<ol class="steps">
  <li>Dans <strong>Nouveau post</strong>, sous les médias : <strong>« Importer depuis Google Drive »</strong>.</li>
  <li><strong>Récents</strong> montre tes dernières photos et vidéos ; <strong>Dossiers</strong> permet de parcourir ton Drive ; la recherche trouve un fichier par son nom.</li>
  <li>Touche les fichiers voulus (une coche verte apparaît, jusqu'à 20), puis <strong>« Importer »</strong>.</li>
</ol>
<p class="tip">Depuis ton téléphone, c'est le plus pratique pour les grosses vidéos : le fichier passe <strong>directement de Google au serveur</strong>, sans être téléchargé sur ton téléphone ni consommer ton forfait.</p>
<p class="tip">Formats pris en charge : JPG, PNG, WebP, GIF, MP4, MOV, WebM. Les photos HEIC (iPhone en « Haute efficacité ») sont grisées : exporte-les en JPG, ou règle ton iPhone sur « Le plus compatible ».</p>
<p class="warn">« Accès bloqué » ou « app non validée » sans bouton pour continuer ? Demande au propriétaire de t'ajouter comme <strong>utilisateur test</strong> dans Google Cloud.</p>`,
      owner: `
<p>Drive utilise <strong>le même projet, les mêmes clés et la même adresse de retour que YouTube</strong> : fais d'abord le tuto YouTube. Ensuite, une seule chose :</p>
<ol class="steps">
  <li>Ouvre <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener">Google Drive API</a> (connecté avec le compte Google du projet) et clique sur <strong>Activer</strong>. C'est tout.</li>
</ol>
<p class="tip">Si tu l'oublies, l'app te le dira à la première ouverture du Drive, avec un bouton qui mène directement au bon projet.</p>
<p class="tip">Facultatif : dans <em>Google Auth Platform → Accès aux données</em>, tu peux déclarer <code>…/auth/drive.readonly</code> pour que l'écran de Google l'affiche proprement. Si Google bloque la connexion avec un message sur un « niveau d'accès » (scope), c'est cette étape qu'il faut faire.</p>
<p class="tip">Pas de nouvelle clé à coller dans PTZ Posting : le bouton « Connecter Google Drive » apparaît dès que YouTube est activé. Les personnes qui se connectent doivent être dans les <strong>utilisateurs test</strong> (Audience), comme pour YouTube.</p>
<p class="tip">Sécurité : l'accès est en lecture seule, chaque personne ne voit que son propre Drive, et les jetons d'accès sont chiffrés. « Déconnecter » retire aussi l'autorisation chez Google.</p>`,
    },

    x: {
      title: "X (Twitter)",
      user: `
<ol class="steps">
  <li>Onglet <strong>Comptes</strong>, carte <strong>X</strong> : clique sur <strong>« Connecter X »</strong>.</li>
  <li>X s'ouvre : connecte-toi au compte sur lequel tu veux publier.</li>
  <li>Clique sur <strong>Autoriser l'application</strong>.</li>
  <li>Tu reviens dans PTZ Posting : ton compte X apparaît dans « Comptes connectés ».</li>
</ol>
<p class="tip">L'accès se renouvelle tout seul. Textes limités à 280 caractères, 4 images maximum.</p>`,
      owner: `
<p class="warn">L'API de X est <strong>payante</strong> (crédits à l'usage, quelques centimes par post). Si tu ne publies pas sur X, ne l'active pas.</p>
<ol class="steps">
  <li>Va sur <a href="https://developer.x.com/en/portal/dashboard" target="_blank" rel="noopener">developer.x.com</a> avec ton compte X, inscris-toi au portail développeur et ajoute des crédits si X le demande.</li>
  <li>Crée un <strong>Project</strong>, puis une <strong>App</strong> dedans (nom : <em>PTZ Posting</em>).</li>
  <li>Dans l'app : <strong>User authentication settings</strong> → <strong>Set up</strong>. <em>App permissions</em> : <strong>Read and write</strong>. <em>Type of App</em> : <strong>Web App, Automated App or Bot</strong>.</li>
  <li><em>Callback URI / Redirect URL</em> : colle ${cb("x")}. <em>Website URL</em> : <code>{{origin}}</code>. Enregistre.</li>
  <li>X affiche le <strong>Client ID</strong> et le <strong>Client Secret</strong> (OAuth 2.0) : copie-les. Tu les retrouves ensuite dans <strong>Keys and tokens</strong> (le secret peut être régénéré, pas réaffiché).</li>
  <li>Dans PTZ Posting, carte X → <strong>« Activer ce réseau »</strong> : colle les deux, <strong>Enregistrer</strong>.</li>
</ol>`,
    },
  };

  const networkTopic = (id) => ({
    id: `net-${id}`,
    title: `Connecter ${networks[id].title}`,
    html: `
<h3>Connecter ton compte</h3>${networks[id].user}
<h3>Activer ${networks[id].title} dans l'app ${OWNER}</h3>
<p class="muted small">À faire une seule fois, par le propriétaire de l'app, pour tout le monde. Ensuite, chacun connecte son propre compte avec les étapes du dessus.</p>
${networks[id].owner}`,
  });

  const topics = [
    {
      id: "principe",
      title: "Comment marche PTZ Posting",
      html: `
<p>Tu écris un post <strong>une seule fois</strong>, tu choisis sur quels réseaux il part (Instagram, Facebook, Threads, YouTube, TikTok, X), et l'app le publie <strong>tout de suite</strong> ou <strong>à l'heure que tu choisis</strong>, même si ton ordinateur est éteint.</p>
<p><strong>Chacun son espace</strong> : chaque personne a ses propres réseaux, ses posts, son Canva et son planning. Personne ne voit ni ne touche le contenu d'un autre.</p>
<p>Pour bien démarrer : <a data-help="reseaux" href="#">connecte tes réseaux</a>, crée un <a data-help="profils" href="#">profil</a>, puis <a data-help="publier" href="#">programme ton premier post</a>.</p>`,
    },
    {
      id: "connexion",
      title: "Se connecter",
      html: `
<h3>Tu as reçu une invitation</h3>
<ol class="steps">
  <li>Ouvre le lien d'invitation (il ne marche qu'<strong>une fois</strong> et pendant <strong>48 h</strong>).</li>
  <li>Tape ton <strong>adresse e-mail</strong> : elle te servira d'identifiant.</li>
  <li>Choisis un <strong>mot de passe</strong> d'au moins 12 caractères. Astuce : une phrase facile à retenir, par exemple « MonChatAime2Croquettes ».</li>
  <li>Passe à la <strong>double authentification</strong> (juste en dessous).</li>
</ol>
<h3>La double authentification, c'est quoi ?</h3>
<p>En plus du mot de passe, l'app te demande un <strong>code à 6 chiffres</strong> qui change toutes les 30 secondes et qui s'affiche <strong>uniquement sur ton téléphone</strong>. Même si quelqu'un vole ton mot de passe, il ne peut pas entrer sans ton téléphone.</p>
<h3>L'activer (une seule fois)</h3>
<ol class="steps">
  <li>Installe sur ton téléphone une appli gratuite d'authentification : <strong>Google Authenticator</strong>, Microsoft Authenticator ou 2FAS.</li>
  <li>Dans cette appli, appuie sur <strong>+</strong> puis <strong>Scanner un QR code</strong>, et vise le QR code affiché par PTZ Posting.</li>
  <li>Une ligne « PTZ Posting » apparaît dans l'appli avec un code à 6 chiffres : tape-le dans PTZ Posting et clique sur <strong>Activer</strong>.</li>
  <li>L'app affiche <strong>10 codes de secours</strong> : note-les <strong>tout de suite</strong> dans un endroit sûr (gestionnaire de mots de passe, papier rangé). Ils ne seront plus jamais affichés.</li>
</ol>
<p class="warn">Ne partage jamais le QR code, sa clé ni tes codes de secours, même en capture d'écran. Si c'est arrivé avant l'activation, clique sur <strong>« Générer un nouveau QR code »</strong>.</p>
<p class="tip">À ta toute première connexion, <strong>laisse le champ « Code » vide</strong> : l'app te fera activer la double authentification juste après.</p>
<h3>Les connexions suivantes</h3>
<p>Identifiant (ton e-mail) + mot de passe + le code à 6 chiffres affiché par l'appli de ton téléphone. Tu restes connecté 7 jours sur cet appareil.</p>
<p>Après 5 essais ratés, l'app bloque l'adresse pendant 15 minutes : c'est une protection contre les pirates, pas une panne.</p>
<p>Un souci ? Voir <a data-help="secours" href="#">téléphone perdu, mot de passe oublié</a>.</p>`,
    },
    {
      id: "secours",
      title: "Téléphone perdu, mot de passe oublié",
      html: `
<ul>
  <li><strong>Téléphone perdu ou changé</strong> : connecte-toi avec un de tes <strong>codes de secours</strong> à la place du code à 6 chiffres (chaque code ne marche qu'une fois). Ensuite, demande à un administrateur de <strong>réinitialiser ta double authentification</strong> (Comptes → Personnes ayant accès) pour l'activer sur ton nouveau téléphone.</li>
  <li><strong>Astuce</strong> : active la sauvegarde dans ton appli d'authentification (dans Google Authenticator, la synchronisation avec ton compte Google). Changer de téléphone devient alors transparent.</li>
  <li><strong>Mot de passe oublié</strong> : demande à un administrateur un <strong>lien de nouveau mot de passe</strong> (Comptes → Personnes ayant accès → « Nouveau mot de passe »). Tes réseaux, tes posts et ta double authentification sont conservés.</li>
  <li><strong>Propriétaire</strong> : voir <a data-help="proprietaire" href="#">réglages du propriétaire</a>.</li>
</ul>
<h3>« Identifiants incorrects »</h3>
<p>Vérifie ton e-mail (les majuscules ne comptent pas), ton mot de passe, et que le code n'a pas expiré (il change toutes les 30 s). Vérifie aussi que l'heure de ton téléphone est réglée en automatique : un téléphone à l'heure fausse donne des codes faux.</p>`,
    },
    {
      id: "reseaux",
      title: "Connecter ses réseaux sociaux",
      html: `
<p>Dans l'onglet <strong>Comptes</strong>, chaque réseau a sa carte avec un bouton <strong>« Connecter »</strong>. Le principe est toujours le même :</p>
<ol class="steps">
  <li>Tu cliques sur « Connecter » : tu arrives <strong>sur le site du réseau</strong> (Facebook, Google, TikTok…), pas sur PTZ Posting. Tu n'y tapes donc jamais ton mot de passe dans PTZ Posting.</li>
  <li>Tu te connectes à <strong>ton</strong> compte sur ce site, s'il le demande.</li>
  <li>Le réseau te demande si tu autorises « PTZ Posting » à publier pour toi : <strong>accepte toutes les autorisations</strong> proposées, sinon la publication échouera.</li>
  <li>Tu reviens automatiquement dans PTZ Posting, avec le message « compte(s) connecté(s) ».</li>
</ol>
<p class="tip">Chacun connecte <strong>ses propres</strong> comptes : les autres personnes ne voient ni tes réseaux ni tes posts. Tes réseaux restent connectés ; si un réseau te déconnecte (mot de passe changé, accès retiré), reclique simplement sur « Connecter ».</p>
<h3>Le tuto de chaque réseau</h3>
<ul class="net-links">
  ${Object.keys(networks).map((id) => `<li><a data-help="net-${id}" href="#">${networks[id].title}</a></li>`).join("")}
</ul>
<p class="tip">Pas de bouton « Connecter » mais « Pas encore activé » ? Le propriétaire de l'app doit d'abord activer ce réseau, une seule fois pour tout le monde (c'est expliqué en bas de chaque tuto).</p>
<p class="warn">« Lien de connexion expiré » : tu as mis plus de 15 minutes, ou ouvert le lien dans un autre navigateur. Reclique simplement sur « Connecter ».</p>`,
    },
    ...Object.keys(networks).map(networkTopic),
    {
      id: "profils",
      title: "Les profils",
      html: `
<p>Un profil regroupe les comptes d'une même identité. Exemple : « Pixels Perspective » = Instagram + Facebook + Threads ; « FC Subway » = TikTok + YouTube.</p>
<ol class="steps">
  <li><strong>Comptes → Profils</strong> : tape un nom, clique sur « Créer le profil », puis clique sur ses comptes pour les cocher.</li>
  <li>Dans <strong>Nouveau post</strong>, un clic sur le profil coche tous ses comptes d'un coup.</li>
  <li>Dans <strong>Planning</strong>, le menu « Tous les profils » permet de n'afficher qu'un profil.</li>
</ol>`,
    },
    {
      id: "publier",
      title: "Créer et programmer un post",
      html: `
<ol class="steps">
  <li><strong>Publier sur</strong> : clique sur un profil ou coche des comptes.</li>
  <li>Écris ton texte : les compteurs montrent la limite de chaque réseau (500 caractères pour Threads, 280 pour X…).</li>
  <li>Ajoute tes images ou vidéos : galerie ou glisser-déposer, <a data-help="canva" href="#">Canva</a>, <a data-help="net-gdrive" href="#">Google Drive</a>, ou <a data-help="photo" href="#">appareil photo</a>.</li>
  <li>Sous les médias, chaque réseau a sa <strong>carte d'options</strong> : « Prêt » en vert, sinon ce qui bloque en rouge. Tu peux y choisir le format (carrousel, story…), les médias envoyés à ce réseau, ou un texte différent.</li>
  <li>Dans <strong>Quand ?</strong>, choisis la date et l'heure, puis <strong>Programmer</strong>. Ou <strong>Publier maintenant</strong>, ou <strong>Enregistrer en brouillon</strong>.</li>
</ol>
<h3>Mettre ta propre musique sur les slides (programmable)</h3>
<ol class="steps">
  <li>Ajoute tes images au post, puis touche <strong>« ♫ Musique sur les slides »</strong> sous les médias.</li>
  <li>La première fois, ajoute une musique (MP3, M4A, AAC ou WAV) : elle reste dans ta bibliothèque pour les prochaines fois.</li>
  <li>Écoute-la, choisis le <strong>début</strong> (ou « Prendre la position du lecteur »), puis : <strong>toutes les slides</strong> (5 s chacune par défaut, la musique continue d'une slide à l'autre) ou <strong>seulement la 1re</strong>.</li>
  <li><strong>Créer les vidéos</strong> : les images sont remplacées par des vidéos avec la musique. Le post se programme normalement.</li>
</ol>
<p class="warn">Utilise une musique à toi ou libre de droits : Instagram peut couper le son d'une musique protégée. Facebook n'accepte pas un mélange photos + vidéos : retire-le de ce post ou garde-lui une seule vidéo.</p>
<h3>Ajouter une musique Instagram (« Finir dans Instagram »)</h3>
<p>Instagram ne laisse utiliser sa bibliothèque musicale que dans son appli. Pour un carrousel avec musique :</p>
<ol class="steps">
  <li><strong>Sur ton téléphone</strong>, dans le Planning (ou dans les options Instagram de l'éditeur), touche <strong>« 📲 Finir dans Instagram »</strong>.</li>
  <li><strong>Ouvrir Instagram</strong> : tes images partent dans l'appli Instagram, dans l'ordre, et la légende est copiée.</li>
  <li>Dans Instagram : Publication → <strong>♫ Ajouter de la musique</strong> → colle la légende → Publier.</li>
  <li>Reviens dans PTZ Posting : <strong>« C'est publié sur Instagram »</strong>. Instagram est marqué publié et ne sera pas publié une deuxième fois ; les autres réseaux du post partent comme prévu.</li>
</ol>
<h3>Même post, texte adapté à un réseau</h3>
<ul>
  <li>Quand plusieurs comptes sont cochés, des <strong>onglets</strong> apparaissent au-dessus du texte : « Tous les réseaux », puis un par compte.</li>
  <li>Un onglet de réseau montre d'abord un <strong>aperçu</strong> (le texte commun, mentions adaptées). <strong>« ✏️ Modifier pour ce réseau »</strong> crée un texte propre à ce réseau, à partir du texte commun : tu changes juste le détail voulu. Un point orange signale les réseaux personnalisés.</li>
  <li><strong>« ↺ Revenir au texte commun »</strong> annule la personnalisation. Les slides restent toujours les mêmes pour tous.</li>
</ul>
<h3>Mentions (@)</h3>
<ul>
  <li><strong>« @ Mentionner »</strong> sous le texte : crée un contact une fois (ex. « Nintendo France ») avec son compte sur chaque réseau (nom du compte ou lien du profil ; pour Facebook, le nom exact de la Page).</li>
  <li>Un clic sur le contact insère <code>@[Nintendo France]</code> dans le texte. À la publication, l'app écrit <strong>le bon compte sur chaque réseau</strong> (@nintendofrance sur Instagram, @NintendoFrance sur X…). Sur un réseau laissé vide, le nom est écrit en texte simple.</li>
  <li>Sous le texte, une ligne montre comment chaque mention sera écrite sur les réseaux cochés. Le crayon ✎ à côté d'un contact permet de le modifier.</li>
</ul>
<h3>Premier commentaire</h3>
<p>Dans les options d'Instagram ou Facebook (« 💬 Premier commentaire »), ou de X et Threads (réponse sous le post) : ce texte est publié juste après le post. « ↧ Déplacer les hashtags » les retire du texte de ce réseau seulement et les met en commentaire. La première fois, reconnecte le compte dans Comptes (nouvelle autorisation). Si le commentaire échoue, le post reste publié et une note l'indique.</p>
<h3>Hashtags</h3>
<ul>
  <li>Sous le texte, l'app liste les hashtags trouvés et prévient selon les réseaux cochés : <strong>Instagram</strong> 30 maximum (au-delà le post est refusé), <strong>Threads</strong> un seul tag par post (le premier devient le sujet), <strong>YouTube</strong> les ignore tous au-delà de 15, <strong>X</strong> les compte dans les 280 caractères.</li>
  <li><strong>Insérer</strong> : un clic ajoute un de tes jeux de hashtags, ou un de tes hashtags les plus utilisés, à la fin du texte (sans doublon).</li>
  <li><strong>Jeux de hashtags</strong> : « Gérer mes jeux de hashtags » pour en créer (nom + hashtags). Lié à un profil, un jeu n'est proposé que quand ce profil est coché.</li>
  <li>Astuce : pour un texte différent sur un réseau (moins de hashtags sur X ou Threads), utilise « Texte différent pour ce réseau » dans ses options.</li>
</ul>
<h3>Formats acceptés</h3>
<ul>
  <li><strong>Instagram</strong> : images JPG (carrousel jusqu'à 10), vidéo MP4 (Reel), story. Pas de post texte seul.</li>
  <li><strong>Facebook</strong> : texte seul, images, ou une vidéo.</li>
  <li><strong>Threads</strong> : texte (500 caractères), images, vidéo MP4.</li>
  <li><strong>YouTube</strong> et <strong>TikTok</strong> : une vidéo.</li>
  <li><strong>X</strong> : texte (280 caractères), jusqu'à 4 images ou une vidéo MP4.</li>
</ul>
<p class="tip">Après publication, chaque réseau affiche « Publié » avec un lien « Voir ». En cas d'échec, le message explique pourquoi, et « Réessayer les échecs » relance seulement les réseaux qui ont raté.</p>`,
    },
    {
      id: "canva",
      title: "Canva et les brouillons automatiques",
      html: `
<ul>
  <li><strong>Importer depuis Canva</strong> (dans Nouveau post) : tes designs les plus récents s'affichent en premier. « Importer » ajoute toutes les pages du design. Choisis le format <strong>JPG</strong> pour les carrousels, <strong>MP4</strong> pour une vidéo.</li>
  <li><strong>Brouillons automatiques</strong> (Comptes → carte Canva) : crée une règle, par exemple « titre commençant par NEWZ » vers ton profil Pixels Perspective. Chaque fois qu'un design NEWZ est mis à jour (par toi ou par la tâche planifiée), l'app prépare un <strong>brouillon</strong> avec ses pages. Elle ne publie jamais toute seule : c'est toi qui relis et programmes.</li>
  <li>Un brouillon par design <strong>et par jour</strong> : le brouillon d'hier garde ses images, même quand le design est réécrit aujourd'hui.</li>
</ul>
<p>Pas encore connecté à Canva ? Voir <a data-help="net-canva" href="#">le tuto Canva</a>.</p>`,
    },
    {
      id: "photo",
      title: "Photos et vidéos (téléphone, galerie, webcam)",
      html: `
<ul>
  <li><strong>Photos et vidéos déjà sur ton téléphone</strong> : touche <strong>« Choisir dans ma galerie »</strong>. Tu peux en sélectionner plusieurs d'un coup (carrousel).</li>
  <li><strong>En prendre une maintenant</strong> : <strong>📷 Prendre une photo</strong> ou <strong>🎥 Filmer une vidéo</strong> ouvrent directement l'appareil photo du téléphone. Une fois validée, elle s'ajoute au post.</li>
  <li>Sur téléphone, l'ordre des médias se change avec les flèches ← → sous chaque vignette, et ✕ en retire un.</li>
  <li><strong>Webcam</strong> : le navigateur demande l'autorisation la première fois : réponds <strong>Autoriser</strong>. Si tu as refusé par erreur, clique sur l'icône à gauche de l'adresse du site pour changer.</li>
  <li><strong>Sur ordinateur</strong>, les mêmes boutons ouvrent la webcam dans l'app.</li>
  <li>Avec certains navigateurs d'ordinateur (Firefox, par exemple), la vidéo est enregistrée en WebM : acceptée par YouTube, TikTok et Facebook, pas par Instagram, Threads ni X. Avec Chrome, Edge ou Safari, c'est du MP4, accepté partout.</li>
</ul>
<h3>Réglage conseillé sur iPhone</h3>
<p>Réglages → <strong>Appareil photo</strong> → <strong>Formats</strong> → <strong>« Le plus compatible »</strong>. Tes vidéos sont alors lisibles par tous les réseaux, X compris, qui refuse le format HEVC « Haute efficacité ». Les photos, elles, sont converties en JPG automatiquement.</p>
<p>Dans Réglages → Appareil photo → <strong>Enregistrement vidéo</strong>, choisis <strong>1080p à 30 i/s</strong> : la qualité reste très bonne sur les réseaux, et une minute pèse environ 60 Mo au lieu de 400 Mo en 4K, donc l'envoi est bien plus rapide.</p>
<p class="tip">Garde l'écran allumé et l'app ouverte pendant l'envoi d'une longue vidéo : une barre de progression s'affiche sur la vignette.</p>`,
    },
    {
      id: "planning",
      title: "Le planning et les brouillons oubliés",
      html: `
<ul>
  <li><strong>Planning</strong> en liste ou en <strong>calendrier</strong>. Dans le calendrier, le <strong>+</strong> d'un jour crée un post à cette date.</li>
  <li>La pastille à côté de « Planning » indique le nombre de brouillons à programmer. Elle devient <strong>orange</strong> s'il en reste des jours précédents.</li>
  <li>L'onglet <strong>Brouillons</strong> les range par jour (Aujourd'hui, Hier…). « Relire et programmer » ouvre le brouillon.</li>
  <li><strong>Un brouillon ni modifié ni programmé pendant 7 jours est supprimé automatiquement</strong>, avec ses images et vidéos. Sous chaque brouillon, un compte à rebours indique le temps restant : en jours, puis en heures et minutes (en orange) pendant les dernières 24 h. Pour le garder, il suffit de l'ouvrir et de l'enregistrer.</li>
  <li>Les images et vidéos d'un post publié sont effacées du serveur au bout de 3 jours. Pour republier le même post après, réajoute les médias.</li>
  <li>La <strong>recherche</strong> retrouve n'importe quel post par son texte, par exemple « NEWZ 3 ».</li>
  <li>Un post en <strong>Échec</strong> : lis le message sous le réseau, il dit quoi corriger (format d'image, texte trop long, compte à reconnecter…). Corrige, puis « Réessayer les échecs ».</li>
</ul>`,
    },
    {
      id: "appli",
      title: "Appli sur le téléphone et notifications",
      html: `
<h3>Installer PTZ Posting comme une appli</h3>
<ul>
  <li><strong>iPhone / iPad</strong> : ouvre le site dans <strong>Safari</strong> → bouton <strong>Partager ⬆️</strong> → <strong>« Sur l'écran d'accueil »</strong> → Ajouter.</li>
  <li><strong>Android</strong> : dans Chrome, menu <strong>⋮</strong> → <strong>« Installer l'application »</strong> (ou le bouton « Installer l'appli » dans Comptes → Appli et notifications).</li>
  <li><strong>Ordinateur</strong> : icône d'installation à droite de la barre d'adresse (Chrome, Edge).</li>
</ul>
<p>L'icône PTZ Posting ouvre l'app en plein écran, sans barre d'adresse. Tu restes connecté 7 jours, comme dans le navigateur.</p>
<h3>Notifications</h3>
<ol class="steps">
  <li>Comptes → <strong>Appli et notifications</strong> → <strong>« Activer les notifications sur cet appareil »</strong>, puis <strong>Autoriser</strong>.</li>
  <li><strong>Tester</strong> pour vérifier.</li>
</ol>
<p>Tu es prévenu quand un post est publié, quand un réseau échoue, et chaque matin avec le récap de la journée. À activer sur chaque appareil voulu.</p>
<p class="warn">Sur iPhone, les notifications ne marchent que depuis l'appli installée sur l'écran d'accueil (iOS 16.4 ou plus récent) : installe-la d'abord, ouvre-la depuis l'icône, puis active les notifications.</p>`,
    },
    {
      id: "securite",
      title: "Sécurité : qui voit quoi",
      html: `
<ul>
  <li><strong>Ton espace est privé</strong> : tes réseaux, posts, images, Canva et profils ne sont visibles que par toi. Un administrateur ne peut ni les voir ni publier à ta place.</li>
  <li><strong>Les accès à tes réseaux</strong> (créés quand tu cliques sur « Connecter ») sont chiffrés et ne sont jamais affichés, à personne.</li>
  <li><strong>Les clés de l'application</strong>, saisies une fois par le propriétaire, servent juste à présenter PTZ Posting aux réseaux. Elles ne donnent accès au compte de personne.</li>
  <li><strong>Tes images</strong> ne sont visibles que par toi, et par Instagram ou Threads au moment de la publication, via un lien qui expire au bout de 24 h.</li>
  <li><strong>Suppression de tes médias</strong> : une photo ou vidéo retirée avec ✕ (ou avec « Vider le formulaire ») est <strong>effacée du serveur tout de suite</strong>, ainsi que celles d'un post que tu supprimes. Celles d'un post publié (ou en échec) sont gardées <strong>3 jours</strong>, le temps de réessayer un réseau en échec, puis effacées automatiquement. Le texte du post et ses liens « Voir » restent dans le planning. Une photo ou vidéo envoyée puis abandonnée sans enregistrer le post est effacée au bout de 12 h. Ce qui est sur ton téléphone n'est jamais touché.</li>
  <li>Chaque connexion est notée dans le <strong>journal de sécurité</strong> (carte Sécurité). Si tu vois une connexion qui n'est pas la tienne, clique sur <strong>« Déconnecter tous les appareils »</strong> et préviens un administrateur.</li>
</ul>`,
    },
    {
      id: "utilisateurs",
      title: "Personnes ayant accès",
      html: `
<p>Réservé aux administrateurs. Chaque personne a son propre espace.</p>
<ul>
  <li><strong>Inviter</strong> : « Inviter une personne » (coche « administrateur » si besoin), puis envoie le lien affiché. Il ne marche qu'une fois, pendant 48 h. L'adresse e-mail doit être en @ptzcorp.fr.</li>
  <li><strong>Nouveau mot de passe</strong> : crée un lien pour que la personne choisisse un nouveau mot de passe ; ses données sont conservées.</li>
  <li><strong>Réinitialiser la double authentification</strong> : pour un téléphone perdu ; la personne la réactive à sa prochaine connexion.</li>
  <li><strong>Retirer</strong> : supprime l'accès <strong>et tout l'espace</strong> de la personne (réseaux, posts, profils).</li>
</ul>
<p class="tip">Pour qu'une nouvelle personne puisse connecter ses réseaux, le propriétaire doit aussi l'ajouter comme testeur dans les apps développeur (voir le tuto de chaque réseau).</p>`,
    },
    {
      id: "equipe",
      title: "Travailler à deux (profil partagé, validation)",
      html: `
<h3>Partager un profil</h3>
<ol class="steps">
  <li>Comptes → <strong>Profils</strong> → sous ton profil (ex. Pixels Perspective), <strong>« Partager avec : »</strong> → touche le nom de la personne.</li>
  <li>Elle voit alors ces comptes dans son éditeur (marqués « ↗ ton nom ») et peut préparer des posts pour eux.</li>
</ol>
<p class="tip">Elle ne voit <strong>jamais</strong> les accès des comptes, ni tes autres posts, et <strong>rien n'est publié sans ta validation</strong>. Un nouveau toucher sur son nom retire le partage.</p>
<h3>Proposer un post (personne invitée)</h3>
<p>Coche les comptes du profil partagé : le bouton devient <strong>« 📤 Proposer à … »</strong>. Le post part « À valider » ; tu peux le modifier tant qu'il n'est pas validé.</p>
<h3>Valider (propriétaire du profil)</h3>
<ul>
  <li>Planning → filtre <strong>« À valider »</strong> (avec une notification à chaque proposition).</li>
  <li><strong>✅ Valider</strong> : programmé à la date proposée (ou publié tout de suite si elle est passée).</li>
  <li><strong>↩ Demander des modifications</strong> : le post revient en brouillon chez l'auteur, avec ton message.</li>
  <li><strong>💬 Commentaires</strong> sur chaque post : visibles seulement par vous deux, avec notification.</li>
</ul>`,
    },
    {
      id: "alertes",
      title: "Alertes de sécurité",
      html: `
<p>L'app peut t'envoyer un message (Discord, Slack ou ntfy) à chaque connexion, tentative suspecte, publication en échec ou réglage modifié.</p>
<h3>Avec Discord ${OWNER}</h3>
<ol class="steps">
  <li>Sur ton serveur Discord, crée un salon privé (ex. <em>#alertes-ptz</em>).</li>
  <li>Paramètres du salon (roue dentée) → <strong>Intégrations</strong> → <strong>Webhooks</strong> → <strong>Nouveau webhook</strong> → <strong>Copier l'URL du webhook</strong>.</li>
  <li>Dans PTZ Posting, carte <strong>Alertes de sécurité</strong> : colle l'adresse, <strong>Enregistrer</strong>.</li>
</ol>`,
    },
    {
      id: "proprietaire",
      title: "Réglages du propriétaire",
      html: `
<p>${OWNER} Ces points ne concernent que la personne qui gère le serveur.</p>
<h3>Activer un réseau (une seule fois, depuis le site)</h3>
<p>Un réseau social n'accepte de publier que pour une application qu'il connaît. Il faut donc « présenter » PTZ Posting une fois à chaque réseau, exactement comme Fedica ou Buffer l'ont fait pour leurs clients. Dans l'onglet <strong>Comptes</strong>, la carte de chaque réseau affiche <strong>« Activer ce réseau »</strong> avec le tuto pas à pas. Ensuite, chaque personne connecte ses propres comptes d'un clic.</p>
<p class="tip">Les clés secrètes sont chiffrées et ne sont plus jamais réaffichées, même à toi : pour les changer, colle simplement la nouvelle (« Clés de l'app » sous le bouton Connecter). Chaque modification est notée dans le journal et envoyée en alerte.</p>
<h3>Autres réglages (sur le serveur)</h3>
<ul>
  <li><strong>Nouveau mot de passe propriétaire</strong> : dans la console SSH, <code>node scripts/hash-password.ts</code>, puis remplacer la valeur de <code>ADMIN_PASSWORD_HASH</code> dans alwaysdata (sans espace, sans &lt; &gt;) et redémarrer.</li>
  <li><strong>Téléphone perdu et plus de codes de secours</strong> : ajouter <code>TWOFA_RESET=1</code>, redémarrer, se reconnecter pour réactiver la double authentification, puis <strong>retirer</strong> <code>TWOFA_RESET</code> et redémarrer.</li>
  <li><strong>Mettre à jour l'app</strong> : dans la console SSH, <code>cd pixels-feeling-hub/multiposter</code> puis <code>git pull</code>, puis redémarrer le site.</li>
  <li><strong>Protéger le serveur</strong> : double authentification sur les comptes alwaysdata, GitHub, Meta et Google.</li>
</ul>`,
    },
  ];

  window.PTZ_HELP = { topics, networks };
})();
