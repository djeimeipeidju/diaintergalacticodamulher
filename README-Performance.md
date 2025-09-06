# Guia de Performance — MVPs (Firebase + Netlify)

## 1. Emulador Local (sem custos)
```bash
npx firebase-tools login
npx firebase-tools emulators:start --only auth,firestore,hosting
```
- Usa `firebase.json` e `firestore.rules` já incluídos.
- Permite testar login, feed e comentários localmente.

## 2. Deploy Rápido (Netlify)
- O arquivo `netlify.toml` já está configurado (redirect SPA + cache agressivo).
- Basta rodar `netlify deploy` ou usar integração automática do repositório.

## 3. Snapshots do Emulador
```bash
# Exportar estado atual
npx firebase-tools emulators:export ./_snapshots/$(date +%Y%m%d-%H%M)

# Restaurar snapshot
npx firebase-tools emulators:start --import ./_snapshots/<pasta>
```

## 4. Firebase Blaze
- Cadastre o cartão virtual Mastercard (Mercado Pago ou outro).
- Ative o Blaze: recebe **US$300 de crédito grátis** por 90 dias.
- A cobrança teste (~R$1) é estornada depois.

## 5. Checklist Rápido
- [ ] Código corrigido (firebase-init.js, app.js, styles.css).
- [ ] Emulador funcionando com `firebase.json`.
- [ ] Deploy Netlify com cache ativo.
- [ ] Snapshots para backup de dados.
- [ ] Blaze ativo com créditos liberados.
