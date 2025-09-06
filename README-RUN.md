# MVP — Dia Intergaláctico da Mulher (Pacote Essencial)

## 1) Pré-requisitos
- Node.js 18+
- Firebase CLI: `npm i -g firebase-tools`

## 2) Preparar admin
- Abra `firestore.rules` e `storage.rules` e troque `admin@example.com` pelo seu e-mail.
- Salve.

## 3) Subir emuladores
- No terminal, nesta pasta: `firebase emulators:start`
- Painel: http://localhost:4000

## 4) Abrir o app
- Público: abra `feed.html`
- Admin/Associado: `index.html` (Google ou e-mail/senha)

## Notas
- Feed em **tempo real** (TV-style) e **infinito**.
- Upload de mídia em post e comentário (Storage emulador).
- Comentários sem login no MVP (ajuste as regras se quiser exigir auth).