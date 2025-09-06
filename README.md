# dia intergaláctico da mulher — MVP (Login + Feed protegido)

## Lista S/N:O (prioritário)
- **S** `firebase-config.js` presente na raiz e **carregado antes** dos módulos em `index.html` e `feed.html`.
- **S** `firebase-init.js` inicializa com `initializeApp(window.firebaseConfig)`.
- **S** Authentication: **Email/Senha** e **Google** **ativados**; **e-mail de suporte** definido.
- **S** Authentication → **Domínios autorizados**: incluir **localhost** e (depois do deploy) o **domínio do site**.
- **O** Se algo falhar, ver **Solução de Problemas** ao fim.

---

## 1) Estrutura de pastas
