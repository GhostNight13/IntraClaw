# Skill — Prospect Scraper

## Description
Scraping et qualification de prospects PME à Bruxelles.

## Déclencheurs
- "trouve des prospects"
- "scrape [catégorie] à Bruxelles"
- "cherche des entreprises qui ont besoin d'un site"

## Méthode
1. Scraper Google Maps / Pages Jaunes via Puppeteer
2. Filtrer : pas de site ou site obsolète
3. Vérifier email (Hunter.io / Abstract Email)
4. Audit PageSpeed automatique
5. Scorer le prospect (0-100)
6. Ajouter au CRM (Notion)

## Contraintes
- Alterner les catégories (restaurants, avocats, cliniques, etc.)
- Vérifier doublons avant ajout
- Respecter rate limits
