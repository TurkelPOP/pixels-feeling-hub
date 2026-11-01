// Point d'entrée du serveur en production (alwaysdata ou tout hébergeur Node).
// Il reprend l'adresse et le port que l'hébergeur impose, puis lance le serveur produit par `bun run build:node`.
// alwaysdata les fournit dans l'environnement ; selon la version de la plateforme les noms varient, on les accepte tous.
process.env.PORT ||= process.env.ALWAYSDATA_HTTPD_PORT || "";
process.env.HOST ||= process.env.IP || process.env.ALWAYSDATA_HTTPD_IP || "";
if (!process.env.PORT) delete process.env.PORT;
if (!process.env.HOST) delete process.env.HOST;

await import("./.output/server/index.mjs");
