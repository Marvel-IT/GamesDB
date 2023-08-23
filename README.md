# GamesDB
Backendové API pro správu videoher v Node.js

API spravuje filmy, režiséry a herce. Routování je RESTful (posíláme tedy požadavky typu GET, POST, PUT a DELETE). Komunikace probíhá ve formátu JSON. V případě chyby API vrátí chybový kód 4XX.

Čtení dat z API je vždy povoleno.

Editace dat v API je podmíněna přihlášením uživatele s rolí administrátora.

